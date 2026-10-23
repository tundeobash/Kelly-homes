import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import sharp from "sharp"
import { decideImageProvider } from "../lib/ai/generationPolicy"
import {
  InvalidImageError,
  UnchangedImageError,
  validateGeneratedImage,
} from "../lib/ai/generationValidation"
import {
  buildStabilityFields,
  renderWithStability,
  sanitizeProviderError,
  stabilityEndpoint,
  StabilityGenerationError,
} from "../lib/ai/stabilityRenderer"
import { runTwoPassStability } from "../lib/ai/twoPassGeneration"

const FAKE_KEY = "sk-test-only-not-a-real-key"
const originalKey = process.env.STABILITY_API_KEY
const originalStrength = process.env.STABILITY_STRENGTH

afterEach(() => {
  if (originalKey === undefined) delete process.env.STABILITY_API_KEY
  else process.env.STABILITY_API_KEY = originalKey
  if (originalStrength === undefined) delete process.env.STABILITY_STRENGTH
  else process.env.STABILITY_STRENGTH = originalStrength
})

async function makePng(seed: number): Promise<Buffer> {
  const width = 640
  const height = 480
  const raw = Buffer.alloc(width * height * 3)
  let state = seed || 1
  for (let i = 0; i < raw.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    raw[i] = state & 0xff
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 0 })
    .toBuffer()
}

async function makeTinyPng(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer()
}

function fieldNames(fields: { name: string }[]): string[] {
  return fields.map((field) => field.name)
}

describe("Stability request construction", () => {
  it("builds an image-to-image request with the required mode and strength", () => {
    const image = Buffer.from("room")
    const fields = buildStabilityFields({
      mode: "image-to-image",
      prompt: "Add a sofa",
      imageBuffer: image,
      strength: 0.35,
      maskBuffer: Buffer.from("should-not-be-sent"),
    })

    assert.equal(
      stabilityEndpoint("image-to-image"),
      "https://api.stability.ai/v2beta/stable-image/generate/sd3"
    )
    assert.deepEqual(fieldNames(fields), [
      "image",
      "prompt",
      "strength",
      "mode",
      "output_format",
    ])
    assert.equal(fields.find((field) => field.name === "mode")?.value, "image-to-image")
    assert.equal(fields.find((field) => field.name === "strength")?.value, "0.35")
    assert.equal(fields.find((field) => field.name === "output_format")?.value, "png")
    assert.equal(fields.some((field) => field.name === "aspect_ratio"), false)
    assert.equal(fields.some((field) => field.name === "guidance_scale"), false)
    assert.equal(fields.some((field) => field.name === "mask"), false)
  })

  it("builds an inpaint request with a mask and without strength or mode", () => {
    const fields = buildStabilityFields({
      mode: "inpaint",
      prompt: "Add a sofa",
      imageBuffer: Buffer.from("room"),
      strength: 0.75,
      maskBuffer: Buffer.from("mask"),
    })

    assert.equal(
      stabilityEndpoint("inpaint"),
      "https://api.stability.ai/v2beta/stable-image/edit/inpaint"
    )
    assert.deepEqual(fieldNames(fields), ["image", "prompt", "mask", "output_format"])
    assert.equal(fields.find((field) => field.name === "output_format")?.value, "png")
  })
})

describe("Stability API failures", () => {
  it("reports the HTTP status and does not return or log the input image or the API key", async () => {
    process.env.STABILITY_API_KEY = FAKE_KEY
    const input = await makePng(20)
    const logs: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      logs.push(args.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join(" "))
    }

    try {
      await assert.rejects(
        () =>
          renderWithStability({
            imageBuffer: input,
            prompt: "Restyle this room",
            mode: "image-to-image",
            stage: "pass1",
            requestId: "test-failure",
            fetchImpl: async (_url, init) => {
              const headers = new Headers(init?.headers)
              assert.equal(headers.get("authorization"), `Bearer ${FAKE_KEY}`)
              assert.equal(headers.get("accept"), "image/*")
              const body = Buffer.from(init?.body as Buffer).toString("latin1")
              assert.match(body, /name="mode"/)
              assert.doesNotMatch(body, /name="aspect_ratio"/)
              assert.doesNotMatch(body, /name="guidance_scale"/)
              return new Response(
                JSON.stringify({ errors: [`rejected ${FAKE_KEY}`] }),
                { status: 400, headers: { "content-type": "application/json" } }
              )
            },
          }),
        (error: unknown) => {
          assert.ok(error instanceof StabilityGenerationError)
          assert.equal(error.status, 400)
          assert.equal(error.stage, "pass1")
          assert.match(error.message, /HTTP 400/)
          assert.equal(error.message.includes(FAKE_KEY), false)
          assert.equal(Buffer.isBuffer(error) && error.equals(input), false)
          return true
        }
      )
    } finally {
      console.error = originalError
    }

    assert.equal(logs.some((line) => line.includes(FAKE_KEY)), false)
    assert.equal(logs.some((line) => line.includes("HTTP 400")), true)
  })

  it("does not continue to the furniture pass or reuse the original photo when the first pass fails", async () => {
    const original = Buffer.from("original-room-photo")
    let maskCalls = 0
    let pass2Calls = 0

    await assert.rejects(
      () =>
        runTwoPassStability({
          imageBuffer: original,
          pass1Prompt: "Soften the light",
          pass2Prompt: "Add a sofa",
          pass1Strength: 0.35,
          requestId: "test-pass1",
          createMask: async () => {
            maskCalls += 1
            return Buffer.from("mask")
          },
          render: async (params) => {
            if (params.mode === "inpaint") pass2Calls += 1
            throw new StabilityGenerationError("Stability AI returned HTTP 422: image rejected", {
              stage: "pass1",
              status: 422,
            })
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof StabilityGenerationError)
        assert.equal(error.stage, "pass1")
        assert.equal(error.status, 422)
        assert.equal(error.message.includes("original"), false)
        return true
      }
    )

    assert.equal(maskCalls, 0)
    assert.equal(pass2Calls, 0)
  })
})

describe("mock behavior", () => {
  it("rejects an explicit mock request instead of pretending a design was created", () => {
    const decision = decideImageProvider({
      forceMock: true,
      hasStability: true,
      hasGemini: true,
      hasOpenAI: true,
    })

    assert.equal(decision.ok, false)
    if (!decision.ok) {
      assert.equal(decision.errorCode, "MOCK_DISABLED")
      assert.match(decision.errorMessage, /placeholder image is not returned/i)
    }
  })

  it("rejects a request with no provider instead of using a placeholder", () => {
    const decision = decideImageProvider({
      forceMock: false,
      hasStability: false,
      hasGemini: false,
      hasOpenAI: false,
    })

    assert.equal(decision.ok, false)
    if (!decision.ok) {
      assert.equal(decision.errorCode, "NO_AI_PROVIDER")
      assert.match(decision.errorMessage, /placeholder image was not created/i)
    }
  })

  it("keeps OpenAI as a separate provider only when Stability is absent", () => {
    const openaiOnly = decideImageProvider({
      forceMock: false,
      hasStability: false,
      hasGemini: true,
      hasOpenAI: true,
    })
    const stability = decideImageProvider({
      forceMock: false,
      hasStability: true,
      hasGemini: true,
      hasOpenAI: true,
    })

    assert.deepEqual(openaiOnly, { ok: true, provider: "openai", planner: "none" })
    assert.deepEqual(stability, { ok: true, provider: "stability", planner: "gemini" })
  })
})

describe("response validation", () => {
  it("accepts a changed PNG and rejects an identical or invalid result", async () => {
    const input = await makePng(11)
    const changed = await makePng(99)
    const tiny = await makeTinyPng()
    assert.ok(input.length > 200 * 1024)
    assert.ok(changed.length > 200 * 1024)

    validateGeneratedImage(changed, [input], { minBytes: 200 * 1024 })

    assert.throws(() => validateGeneratedImage(input, [input]), UnchangedImageError)
    assert.throws(
      () => validateGeneratedImage(Buffer.from("not-an-image-but-long-enough"), [input], { minBytes: 8 }),
      InvalidImageError
    )
    assert.throws(
      () => validateGeneratedImage(tiny, [input], { minBytes: 200 * 1024 }),
      InvalidImageError
    )
  })

  it("rejects a successful Stability response that matches the uploaded photo", async () => {
    process.env.STABILITY_API_KEY = FAKE_KEY
    const input = await makePng(8)

    await assert.rejects(
      () =>
        renderWithStability({
          imageBuffer: input,
          prompt: "Add furniture",
          mode: "inpaint",
          stage: "pass2",
          maskBuffer: Buffer.from("mask"),
          fetchImpl: async () =>
            new Response(input, {
              status: 200,
              headers: { "content-type": "image/png" },
            }),
        }),
      (error: unknown) => {
        assert.ok(error instanceof StabilityGenerationError)
        assert.equal(error.stage, "pass2")
        assert.match(error.message, /identical to the input/)
        assert.match(error.message, /not saved/i)
        return true
      }
    )
  })

  it("returns the new image when Stability sends a different PNG", async () => {
    process.env.STABILITY_API_KEY = FAKE_KEY
    const input = await makePng(3)
    const output = await makePng(240)
    let sawInpaintBody = false

    const result = await renderWithStability({
      imageBuffer: input,
      prompt: "Add furniture",
      mode: "inpaint",
      stage: "pass2",
      strength: 0.75,
      maskBuffer: Buffer.from("mask-bytes"),
      fetchImpl: async (url, init) => {
        assert.equal(url, "https://api.stability.ai/v2beta/stable-image/edit/inpaint")
        const body = Buffer.from(init?.body as Buffer).toString("latin1")
        sawInpaintBody = body.includes('name="mask"')
        assert.equal(body.includes('name="strength"'), false)
        assert.equal(body.includes('name="mode"'), false)
        return new Response(output, {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      },
    })

    assert.equal(sawInpaintBody, true)
    assert.equal(result.equals(output), true)
  })
})

describe("error sanitizing", () => {
  it("removes key-like values from provider errors", () => {
    const cleaned = sanitizeProviderError(
      `rejected ${FAKE_KEY} and Bearer ${FAKE_KEY} with api_key=${FAKE_KEY}`
    )
    assert.equal(cleaned.includes(FAKE_KEY), false)
    assert.match(cleaned, /\[redacted\]/)
  })
})
