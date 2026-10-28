import {
  InvalidImageError,
  UnchangedImageError,
  validateGeneratedImage,
} from "@/lib/ai/generationValidation"
import { getRoomGuide, normalizeRoomType } from "@/lib/ai/roomFurnishing"
import { mustIncludeInstruction } from "@/lib/design/mustInclude"
import { aroundPieceLines } from "@/lib/design/pieces"
import type { StudioPiece } from "@/lib/design/pieces"
import { sanitizeProviderError } from "@/lib/ai/stabilityRenderer"
import { styleCardText } from "@/lib/stylePrompts"
import type { StyleCard } from "@/lib/stylePrompts"

/**
 * One-call room redesign with OpenAI's image editing model.
 * Chosen on 24 Oct 2026 after a side-by-side comparison: it kept the room's
 * architecture in 16 of 16 test images (6 sample rooms, 10 real phone photos).
 */

export const OPENAI_EDIT_URL = "https://api.openai.com/v1/images/edits"
export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst"
export const OPENAI_TIMEOUT_MS = 90_000
const MAX_CUSTOMER_REQUEST_CHARS = 500

// Prices per 1M tokens for the gpt-image-2.5 family (input image tokens, output tokens).
const PRICE_PER_MILLION = { input: 8, output: 30 }

export class OpenAIGenerationError extends Error {
  readonly provider = "openai" as const
  readonly stage: string
  readonly status?: number

  constructor(message: string, options: { stage: string; status?: number }) {
    super(message)
    this.name = "OpenAIGenerationError"
    this.stage = options.stage
    this.status = options.status
  }
}

/** Fitted parts of a home that a redesign must never alter. */
export const FIXTURE_RULE =
  "Keep every fitted part of the home unchanged: kitchen cabinets, counters, counter fronts and splashbacks, built-in wardrobes, doors and door frames, windows and window frames, air-conditioning vents, light switches, sockets, and safety equipment such as fire extinguishers."

/** Furniture must never block a way in or out of the room. */
export const CLEARANCE_RULE =
  "Keep doorways, the balcony door and walkways clear: place no furniture in front of a door, doorway or balcony door, and leave a clear path to each of them."

/** One ceiling light where the room already has one, not a second beside it. */
export const CEILING_LIGHT_RULE =
  "If the ceiling already has a light fitting, replace it at the same point with one that suits the style. Do not add a second ceiling light."

export function buildOpenAIEditInstruction(params: {
  roomType?: string | null
  style: StyleCard
  userPrompt?: string
  moreFurniture?: boolean
  /** Must-have piece ids (lib/design/mustInclude.ts). */
  mustInclude?: string[]
  /** A piece the customer loves, sent as the second image (lib/design/pieces.ts). */
  piece?: StudioPiece | null
}): string {
  const normalized = normalizeRoomType(params.roomType)
  const known = normalized !== "" && normalized !== "other"
  const guide = getRoomGuide(params.roomType)
  const roomLabel = known ? guide.label : "room"
  const customerRequest = (params.userPrompt || "").trim().slice(0, MAX_CUSTOMER_REQUEST_CHARS)

  const lines = [
    params.piece ? "The first image is the room to edit." : "",
    `Edit this photo of a room: furnish it as a ${roomLabel} in ${params.style.name} style.`,
    "Keep the room exactly as it is: the same walls, windows, doors and doorways, ceiling, floor and mouldings, the same camera position and lens, and the same daylight.",
    "Do not add, remove, move or resize any window, door, doorway or wall.",
    FIXTURE_RULE,
    CLEARANCE_RULE,
    CEILING_LIGHT_RULE,
    "Only add furniture, rugs, curtains, lamps, light fittings and decor.",
    known ? `Layout: ${guide.layout}` : "",
    mustIncludeInstruction(params.mustInclude || []),
    params.piece ? aroundPieceLines(params.piece) : "",
    params.moreFurniture ? "Furnish generously: include at least six pieces of furniture and decor." : "",
    `${params.style.name} style. ${styleCardText(params.style)} Avoid: ${params.style.avoid}.`,
    customerRequest ? `The customer also asked for: ${customerRequest}` : "",
    "Photorealistic interior photograph with realistic scale, shadows and materials. No text, logos or watermarks.",
  ]
  return lines.filter(Boolean).join("\n")
}

export function buildOpenAIEditForm(params: {
  imageBuffer: Buffer
  mimeType: string
  prompt: string
  model: string
  quality: string
  /** More pictures after the room, e.g. a piece the customer loves. */
  extraImages?: Array<{ buffer: Buffer; mimeType: string }>
}): FormData {
  const form = new FormData()
  const extension = params.mimeType === "image/jpeg" ? "jpg" : "png"
  form.append("model", params.model)
  form.append(
    "image[]",
    new Blob([new Uint8Array(params.imageBuffer)], { type: params.mimeType }),
    `room.${extension}`
  )
  ;(params.extraImages || []).forEach((image, index) => {
    const ext = image.mimeType === "image/jpeg" ? "jpg" : "png"
    form.append("image[]", new Blob([new Uint8Array(image.buffer)], { type: image.mimeType }), `piece-${index + 1}.${ext}`)
  })
  form.append("prompt", params.prompt)
  // "auto" keeps the photo's proportions.
  form.append("size", "auto")
  form.append("quality", params.quality)
  form.append("output_format", "png")
  return form
}

export function formatOpenAIHttpError(status: number, body: string): string {
  let detail = ""
  let code = ""
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown; code?: unknown } }
    if (typeof parsed.error?.message === "string") detail = parsed.error.message
    if (typeof parsed.error?.code === "string") code = parsed.error.code
  } catch {
    detail = body
  }

  if (code === "moderation_blocked" || /safety system|content policy/i.test(detail)) {
    return "The image service declined this photo under its content rules. Try a different photo."
  }

  const sanitized = sanitizeProviderError(detail).slice(0, 300)
  return `OpenAI returned HTTP ${status}${sanitized ? `: ${sanitized}` : "."}`
}

function estimateCostUsd(usage: unknown): number | null {
  if (!usage || typeof usage !== "object") return null
  const u = usage as { input_tokens?: number; output_tokens?: number }
  if (typeof u.output_tokens !== "number") return null
  const input = typeof u.input_tokens === "number" ? u.input_tokens : 0
  return (input * PRICE_PER_MILLION.input + u.output_tokens * PRICE_PER_MILLION.output) / 1_000_000
}

export async function renderWithOpenAI(params: {
  imageBuffer: Buffer
  mimeType?: string
  prompt: string
  requestId?: string
  apiKey?: string
  fetchImpl?: typeof fetch
  extraImages?: Array<{ buffer: Buffer; mimeType: string }>
}): Promise<{ buffer: Buffer; model: string; costUsd: number | null }> {
  const stage = "render"
  const requestLabel = params.requestId || "unknown"
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new OpenAIGenerationError("OPENAI_API_KEY is not set.", { stage })
  }
  if (!params.prompt || params.prompt.trim() === "") {
    throw new OpenAIGenerationError("A design instruction is required.", { stage })
  }

  const model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL
  const quality = process.env.OPENAI_IMAGE_QUALITY || "high"
  const form = buildOpenAIEditForm({
    imageBuffer: params.imageBuffer,
    mimeType: params.mimeType || "image/png",
    prompt: params.prompt,
    model,
    quality,
    extraImages: params.extraImages,
  })

  console.log(`[OPENAI] [${requestLabel}] Sending edit request`, {
    provider: "openai",
    model,
    quality,
    promptLength: params.prompt.length,
  })

  const fetchFn = params.fetchImpl ?? fetch
  const started = Date.now()
  let response: Response
  try {
    response = await fetchFn(OPENAI_EDIT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    const message = timedOut
      ? `OpenAI did not respond within ${OPENAI_TIMEOUT_MS / 1000} seconds.`
      : `OpenAI could not be reached: ${sanitizeProviderError(error instanceof Error ? error.message : "unknown network error")}`
    console.error(`[OPENAI] [${requestLabel}] Request failed`, { provider: "openai", status: null, error: message })
    throw new OpenAIGenerationError(message, { stage })
  }

  const text = await response.text()
  if (!response.ok) {
    const message = formatOpenAIHttpError(response.status, text)
    console.error(`[OPENAI] [${requestLabel}] Request failed`, {
      provider: "openai",
      status: response.status,
      error: message,
    })
    throw new OpenAIGenerationError(message, { stage, status: response.status })
  }

  let payload: { data?: Array<{ b64_json?: unknown }>; usage?: unknown }
  try {
    payload = JSON.parse(text)
  } catch {
    throw new OpenAIGenerationError("OpenAI sent a reply that could not be read.", { stage })
  }

  const encoded = payload.data?.[0]?.b64_json
  if (typeof encoded !== "string" || encoded.length === 0) {
    throw new OpenAIGenerationError("OpenAI replied without an image.", { stage })
  }

  const buffer = Buffer.from(encoded, "base64")
  try {
    validateGeneratedImage(buffer, [params.imageBuffer], { minBytes: 10 * 1024 })
  } catch (error) {
    const message =
      error instanceof UnchangedImageError || error instanceof InvalidImageError
        ? error.message
        : "OpenAI returned an image that could not be used."
    throw new OpenAIGenerationError(message, { stage: "validation", status: response.status })
  }

  const costUsd = estimateCostUsd(payload.usage)
  console.log(`[OPENAI] [${requestLabel}] Edit finished`, {
    provider: "openai",
    model,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    outputBytes: buffer.length,
    estimatedCostUsd: costUsd === null ? "unknown" : Number(costUsd.toFixed(4)),
  })

  return { buffer, model, costUsd }
}
