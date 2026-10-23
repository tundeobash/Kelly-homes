import { randomBytes } from "crypto"
import {
  InvalidImageError,
  UnchangedImageError,
  validateGeneratedImage,
} from "@/lib/ai/generationValidation"

export type StabilityRenderMode = "inpaint" | "image-to-image"

export const STABILITY_IMAGE_TO_IMAGE_URL =
  "https://api.stability.ai/v2beta/stable-image/generate/sd3"
export const STABILITY_INPAINT_URL =
  "https://api.stability.ai/v2beta/stable-image/edit/inpaint"

export class StabilityGenerationError extends Error {
  readonly provider = "stability" as const
  readonly stage: string
  readonly status?: number

  constructor(message: string, options: { stage: string; status?: number }) {
    super(message)
    this.name = "StabilityGenerationError"
    this.stage = options.stage
    this.status = options.status
  }
}

export interface StabilityField {
  name: string
  value: string | Buffer
  filename?: string
  contentType?: string
}

export function sanitizeProviderError(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|authorization|token)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500)
}

export function stabilityEndpoint(mode: StabilityRenderMode): string {
  return mode === "inpaint" ? STABILITY_INPAINT_URL : STABILITY_IMAGE_TO_IMAGE_URL
}

export function clampStrength(value: number, fallback = 0.8): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

/**
 * Fields accepted by the current Stability v2beta endpoints.
 * Image-to-image (SD3) requires mode=image-to-image and strength, and rejects aspect_ratio.
 * Inpaint accepts image, prompt, and an optional mask. It does not accept strength, mode, or guidance_scale.
 * White mask pixels are edited. Black mask pixels are kept.
 */
export function buildStabilityFields(params: {
  mode: StabilityRenderMode
  prompt: string
  imageBuffer: Buffer
  strength?: number
  maskBuffer?: Buffer
}): StabilityField[] {
  const fields: StabilityField[] = [
    {
      name: "image",
      value: params.imageBuffer,
      filename: "room.png",
      contentType: "image/png",
    },
    { name: "prompt", value: params.prompt },
  ]

  if (params.mode === "image-to-image") {
    const strength = clampStrength(params.strength ?? 0.8)
    fields.push({ name: "strength", value: strength.toString() })
    fields.push({ name: "mode", value: "image-to-image" })
  } else if (params.maskBuffer) {
    fields.push({
      name: "mask",
      value: params.maskBuffer,
      filename: "mask.png",
      contentType: "image/png",
    })
  }

  fields.push({ name: "output_format", value: "png" })
  return fields
}

export function formatStabilityHttpError(status: number, body: string): string {
  let detail = ""
  try {
    const parsed = JSON.parse(body) as {
      message?: unknown
      error?: unknown
      name?: unknown
      errors?: unknown
    }
    const parts: string[] = []
    if (typeof parsed.message === "string") parts.push(parsed.message)
    if (typeof parsed.error === "string") parts.push(parsed.error)
    if (Array.isArray(parsed.errors)) {
      parts.push(parsed.errors.map((item) => String(item)).join("; "))
    }
    if (parts.length === 0 && typeof parsed.name === "string") parts.push(parsed.name)
    detail = parts.join("; ")
  } catch {
    detail = body
  }

  const sanitized = sanitizeProviderError(detail).slice(0, 300)
  return `Stability AI returned HTTP ${status}${sanitized ? `: ${sanitized}` : "."}`
}

function encodeMultipart(fields: StabilityField[]): { body: Buffer; contentType: string } {
  const boundary = `----KellyFormBoundary${randomBytes(16).toString("hex")}`
  const parts: Buffer[] = []

  for (const field of fields) {
    parts.push(Buffer.from(`--${boundary}\r\n`))
    if (typeof field.value === "string") {
      parts.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n`))
      parts.push(Buffer.from(field.value))
    } else {
      const filename = field.filename || "file.bin"
      const contentType = field.contentType || "application/octet-stream"
      parts.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${field.name}"; filename="${filename}"\r\n`
        )
      )
      parts.push(Buffer.from(`Content-Type: ${contentType}\r\n\r\n`))
      parts.push(field.value)
    }
    parts.push(Buffer.from("\r\n"))
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`))
  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

async function readStabilityImage(response: Response, stage: string): Promise<Buffer> {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { image?: unknown; base64?: unknown }
    const encoded = payload.image ?? payload.base64
    if (typeof encoded !== "string" || encoded.length === 0) {
      throw new StabilityGenerationError(
        "Stability AI returned JSON without an image.",
        { stage }
      )
    }
    return Buffer.from(encoded, "base64")
  }

  return Buffer.from(await response.arrayBuffer())
}

/**
 * Send one Stability image edit.
 * Image-to-image edits the whole photo. Inpaint edits only the white area of the mask.
 */
export async function renderWithStability(params: {
  imageBuffer: Buffer
  prompt: string
  strength?: number
  maskBuffer?: Buffer
  requestId?: string
  mode?: StabilityRenderMode
  stage?: string
  fetchImpl?: typeof fetch
}): Promise<Buffer> {
  const {
    imageBuffer,
    prompt,
    strength: providedStrength,
    maskBuffer,
    requestId,
    fetchImpl,
  } = params
  const mode = params.mode ?? (maskBuffer ? "inpaint" : "image-to-image")
  const stage = params.stage ?? (mode === "inpaint" ? "pass2" : "pass1")
  const requestLabel = requestId || "unknown"

  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) {
    throw new StabilityGenerationError("STABILITY_API_KEY is not set.", { stage })
  }

  if (!prompt || prompt.trim() === "") {
    throw new StabilityGenerationError("A design prompt is required.", { stage })
  }

  const defaultStrength = clampStrength(
    Number.parseFloat(process.env.STABILITY_STRENGTH || "0.8")
  )
  const strength = providedStrength ?? defaultStrength
  const endpoint = stabilityEndpoint(mode)
  const fields = buildStabilityFields({
    mode,
    prompt,
    imageBuffer,
    strength,
    maskBuffer,
  })
  const form = encodeMultipart(fields)

  console.log(`[STABILITY] [${requestLabel}] Sending request`, {
    provider: "stability",
    stage,
    endpoint,
    mode,
    fieldNames: fields.map((field) => field.name),
    strength: mode === "image-to-image" ? clampStrength(strength) : "omitted",
  })

  const fetchFn = fetchImpl ?? fetch
  let response: Response
  try {
    response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
        "Content-Type": form.contentType,
      },
      body: new Uint8Array(form.body),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error"
    const sanitized = sanitizeProviderError(message)
    console.error(`[STABILITY] [${requestLabel}] Request failed`, {
      provider: "stability",
      stage,
      mode,
      status: null,
      error: sanitized,
    })
    throw new StabilityGenerationError(
      `Stability AI could not be reached during ${stage}: ${sanitized}`,
      { stage }
    )
  }

  if (!response.ok) {
    const errorText = await response.text()
    const errorMessage = formatStabilityHttpError(response.status, errorText)
    console.error(`[STABILITY] [${requestLabel}] Request failed`, {
      provider: "stability",
      stage,
      mode,
      status: response.status,
      error: errorMessage,
    })
    throw new StabilityGenerationError(errorMessage, {
      stage,
      status: response.status,
    })
  }

  const outputBuffer = await readStabilityImage(response, stage)

  try {
    validateGeneratedImage(outputBuffer, [imageBuffer], { minBytes: 10 * 1024 })
  } catch (error) {
    const message =
      error instanceof UnchangedImageError || error instanceof InvalidImageError
        ? error.message
        : "Stability AI returned an image that could not be used."
    console.error(`[STABILITY] [${requestLabel}] Response rejected`, {
      provider: "stability",
      stage,
      mode,
      status: response.status,
      error: message,
    })
    throw new StabilityGenerationError(message, { stage, status: response.status })
  }

  return outputBuffer
}
