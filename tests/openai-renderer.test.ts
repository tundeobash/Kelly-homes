import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { decideImageProvider } from "../lib/ai/generationPolicy"
import {
  buildOpenAIEditForm,
  buildOpenAIEditInstruction,
  CEILING_LIGHT_RULE,
  CLEARANCE_RULE,
  DEFAULT_OPENAI_IMAGE_MODEL,
  FIXTURE_RULE,
  formatOpenAIHttpError,
  OPENAI_EDIT_URL,
  OpenAIGenerationError,
  renderWithOpenAI,
} from "../lib/ai/openaiRenderer"
import { designStyles } from "../lib/mock/styles"
import { getStyleCard, getStylePrompt, STYLE_CARDS } from "../lib/stylePrompts"
import type { StyleCard } from "../lib/stylePrompts"

const FAKE_KEY = "sk-test-only-not-a-real-key"
const savedEnv = {
  model: process.env.OPENAI_IMAGE_MODEL,
  quality: process.env.OPENAI_IMAGE_QUALITY,
}

afterEach(() => {
  if (savedEnv.model === undefined) delete process.env.OPENAI_IMAGE_MODEL
  else process.env.OPENAI_IMAGE_MODEL = savedEnv.model
  if (savedEnv.quality === undefined) delete process.env.OPENAI_IMAGE_QUALITY
  else process.env.OPENAI_IMAGE_QUALITY = savedEnv.quality
})

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** PNG-looking bytes, large enough to pass the size check. Different seeds give different images. */
function fakePng(seed: number, size = 20 * 1024): Buffer {
  return Buffer.concat([PNG_SIGNATURE, Buffer.alloc(size, seed)])
}

function card(id: string): StyleCard {
  const found = getStyleCard(id)
  assert.ok(found, `missing style card ${id}`)
  return found
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("style cards", () => {
  it("has a complete card for every style the app offers", () => {
    for (const style of designStyles) {
      const found = getStyleCard(style.id)
      assert.ok(found, `no style card for ${style.id}`)
      for (const field of ["name", "colours", "materials", "furniture", "decor", "avoid"] as const) {
        assert.ok(found[field].trim().length > 0, `${style.id} has an empty ${field}`)
      }
      const prompt = getStylePrompt(style.id)
      assert.ok(prompt && prompt.positive.includes(found.name))
    }
    assert.equal(Object.keys(STYLE_CARDS).length, 19)
  })

  it("includes the three Gulf styles", () => {
    for (const id of ["modern-arabic", "contemporary-majlis", "warm-modern-luxury"]) {
      assert.ok(getStyleCard(id), `missing ${id}`)
      assert.ok(designStyles.some((style) => style.id === id), `${id} is not offered in the app`)
    }
  })

  it("returns nothing for an unknown style instead of guessing", () => {
    assert.equal(getStyleCard("not-a-style"), null)
    assert.equal(getStylePrompt(""), null)
  })
})

describe("OpenAI design instruction", () => {
  it("keeps the room and its fitted parts, and carries the full style card", () => {
    const style = card("modern-arabic")
    const text = buildOpenAIEditInstruction({ roomType: "Living Room", style })

    assert.ok(text.includes(FIXTURE_RULE))
    assert.match(text, /kitchen cabinets, counters, counter fronts/)
    assert.match(text, /Do not add, remove, move or resize any window, door, doorway or wall/)
    assert.match(text, /furnish it as a living room in Modern Arabic style/)
    assert.ok(text.includes(style.colours))
    assert.ok(text.includes(style.materials))
    assert.ok(text.includes(style.furniture))
    assert.ok(text.includes(style.decor))
    assert.ok(text.includes(`Avoid: ${style.avoid}`))
    assert.match(text, /^Layout: /m)
  })

  it("keeps doorways and walkways clear and replaces the ceiling light instead of adding one", () => {
    const text = buildOpenAIEditInstruction({ roomType: "living room", style: card("contemporary-majlis") })
    assert.ok(text.includes(CLEARANCE_RULE))
    assert.ok(text.includes(CEILING_LIGHT_RULE))
    assert.match(text, /balcony door/)
    assert.match(text, /Do not add a second ceiling light/)
  })

  it("leaves out the layout line when the room type is unknown", () => {
    const text = buildOpenAIEditInstruction({ roomType: "", style: card("japandi") })
    assert.match(text, /furnish it as a room in Japandi style/)
    assert.doesNotMatch(text, /^Layout: /m)
  })

  it("adds the more-furniture line and caps the customer's request", () => {
    const longRequest = "a".repeat(800)
    const text = buildOpenAIEditInstruction({
      roomType: "bedroom",
      style: card("minimalist"),
      userPrompt: `  ${longRequest}  `,
      moreFurniture: true,
    })
    assert.match(text, /at least six pieces/)
    const line = text.split("\n").find((l) => l.startsWith("The customer also asked for: "))
    assert.ok(line)
    assert.equal(line.length, "The customer also asked for: ".length + 500)
  })
})

describe("OpenAI request", () => {
  it("sends the photo with size=auto so its proportions are kept", async () => {
    const form = buildOpenAIEditForm({
      imageBuffer: fakePng(1),
      mimeType: "image/png",
      prompt: "Furnish this room",
      model: "test-model",
      quality: "high",
    })
    assert.equal(form.get("model"), "test-model")
    assert.equal(form.get("prompt"), "Furnish this room")
    assert.equal(form.get("size"), "auto")
    assert.equal(form.get("quality"), "high")
    assert.equal(form.get("output_format"), "png")
    const image = form.get("image[]")
    assert.ok(image instanceof Blob)
    assert.equal(image.type, "image/png")
    assert.equal(image.size, fakePng(1).length)
  })

  it("returns the new image, the model used and an estimated cost", async () => {
    delete process.env.OPENAI_IMAGE_MODEL
    delete process.env.OPENAI_IMAGE_QUALITY
    const input = fakePng(1)
    const output = fakePng(2, 30 * 1024)
    let calledUrl = ""
    let sawAuth = false
    let sentModel: FormDataEntryValue | null = null

    const result = await renderWithOpenAI({
      imageBuffer: input,
      prompt: "Furnish this room",
      apiKey: FAKE_KEY,
      fetchImpl: async (url, init) => {
        calledUrl = String(url)
        sawAuth = (init?.headers as Record<string, string>).Authorization === `Bearer ${FAKE_KEY}`
        sentModel = (init?.body as FormData).get("model")
        return jsonResponse({
          data: [{ b64_json: output.toString("base64") }],
          usage: { input_tokens: 1000, output_tokens: 6000 },
        })
      },
    })

    assert.equal(calledUrl, OPENAI_EDIT_URL)
    assert.equal(sawAuth, true)
    assert.equal(sentModel, DEFAULT_OPENAI_IMAGE_MODEL)
    assert.equal(result.model, DEFAULT_OPENAI_IMAGE_MODEL)
    assert.equal(result.buffer.equals(output), true)
    assert.ok(result.costUsd !== null && Math.abs(result.costUsd - 0.188) < 1e-9)
  })

  it("uses the model named in OPENAI_IMAGE_MODEL", async () => {
    process.env.OPENAI_IMAGE_MODEL = "some-other-model"
    let sentModel: FormDataEntryValue | null = null
    const result = await renderWithOpenAI({
      imageBuffer: fakePng(1),
      prompt: "Furnish this room",
      apiKey: FAKE_KEY,
      fetchImpl: async (_url, init) => {
        sentModel = (init?.body as FormData).get("model")
        return jsonResponse({ data: [{ b64_json: fakePng(3).toString("base64") }] })
      },
    })
    assert.equal(sentModel, "some-other-model")
    assert.equal(result.model, "some-other-model")
    assert.equal(result.costUsd, null)
  })
})

describe("OpenAI failures", () => {
  it("refuses to call OpenAI without a key", async () => {
    let called = false
    await assert.rejects(
      () =>
        renderWithOpenAI({
          imageBuffer: fakePng(1),
          prompt: "Furnish this room",
          apiKey: "",
          fetchImpl: async () => {
            called = true
            return jsonResponse({})
          },
        }),
      (error: unknown) => error instanceof OpenAIGenerationError && /OPENAI_API_KEY/.test(error.message)
    )
    assert.equal(called, false)
  })

  it("reports the HTTP status without repeating the API key", async () => {
    await assert.rejects(
      () =>
        renderWithOpenAI({
          imageBuffer: fakePng(1),
          prompt: "Furnish this room",
          apiKey: FAKE_KEY,
          fetchImpl: async () =>
            jsonResponse({ error: { message: `Incorrect API key provided: ${FAKE_KEY}`, code: "invalid_api_key" } }, 401),
        }),
      (error: unknown) => {
        assert.ok(error instanceof OpenAIGenerationError)
        assert.equal(error.provider, "openai")
        assert.equal(error.stage, "render")
        assert.equal(error.status, 401)
        assert.match(error.message, /HTTP 401/)
        assert.equal(error.message.includes(FAKE_KEY), false)
        return true
      }
    )
  })

  it("explains a content-rules refusal in plain words", () => {
    const message = formatOpenAIHttpError(
      400,
      JSON.stringify({ error: { message: "Your request was rejected by the safety system.", code: "moderation_blocked" } })
    )
    assert.match(message, /declined this photo under its content rules/)
  })

  it("does not pass on network errors that contain the key", async () => {
    await assert.rejects(
      () =>
        renderWithOpenAI({
          imageBuffer: fakePng(1),
          prompt: "Furnish this room",
          apiKey: FAKE_KEY,
          fetchImpl: async () => {
            throw new Error(`socket hang up while sending Bearer ${FAKE_KEY}`)
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof OpenAIGenerationError)
        assert.match(error.message, /could not be reached/)
        assert.equal(error.message.includes(FAKE_KEY), false)
        return true
      }
    )
  })

  it("rejects a reply with no image", async () => {
    await assert.rejects(
      () =>
        renderWithOpenAI({
          imageBuffer: fakePng(1),
          prompt: "Furnish this room",
          apiKey: FAKE_KEY,
          fetchImpl: async () => jsonResponse({ data: [] }),
        }),
      (error: unknown) => error instanceof OpenAIGenerationError && /without an image/.test(error.message)
    )
  })

  it("rejects an image identical to the uploaded photo", async () => {
    const input = fakePng(5)
    await assert.rejects(
      () =>
        renderWithOpenAI({
          imageBuffer: input,
          prompt: "Furnish this room",
          apiKey: FAKE_KEY,
          fetchImpl: async () => jsonResponse({ data: [{ b64_json: input.toString("base64") }] }),
        }),
      (error: unknown) => {
        assert.ok(error instanceof OpenAIGenerationError)
        assert.equal(error.stage, "validation")
        assert.match(error.message, /identical to the input/)
        return true
      }
    )
  })

  it("rejects a reply that is not a usable image", async () => {
    await assert.rejects(
      () =>
        renderWithOpenAI({
          imageBuffer: fakePng(1),
          prompt: "Furnish this room",
          apiKey: FAKE_KEY,
          fetchImpl: async () => jsonResponse({ data: [{ b64_json: Buffer.from("tiny").toString("base64") }] }),
        }),
      (error: unknown) => error instanceof OpenAIGenerationError && error.stage === "validation"
    )
  })
})

describe("provider choice", () => {
  it("asks for an OpenAI key when no image service is set up", () => {
    const decision = decideImageProvider({
      forceMock: false,
      hasStability: false,
      hasGemini: true,
      hasOpenAI: false,
    })
    assert.equal(decision.ok, false)
    if (!decision.ok) {
      assert.equal(decision.errorCode, "NO_AI_PROVIDER")
      assert.match(decision.errorMessage, /OPENAI_API_KEY/)
    }
  })
})
