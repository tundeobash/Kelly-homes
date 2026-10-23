export type ProviderDecision =
  | { ok: true; provider: "openai"; planner: "none" }
  | { ok: true; provider: "stability"; planner: "gemini" | "none" }
  | {
      ok: false
      errorCode: "MOCK_DISABLED" | "NO_AI_PROVIDER"
      errorMessage: string
      stage: "provider-selection"
    }

/**
 * Choose an image provider from which keys exist.
 *
 * OpenAI image editing is the default: it won the 24 Oct 2026 comparison.
 * The older Stability two-pass pipeline runs only when IMAGE_PROVIDER=stability,
 * or when no OpenAI key is set. A missing provider or an explicit mock flag is
 * a failure, never a placeholder image.
 */
export function decideImageProvider(input: {
  forceMock: boolean
  hasStability: boolean
  hasGemini: boolean
  hasOpenAI: boolean
  preferred?: string | null
}): ProviderDecision {
  if (input.forceMock) {
    return {
      ok: false,
      errorCode: "MOCK_DISABLED",
      stage: "provider-selection",
      errorMessage:
        "Mock generation is turned off. A placeholder image is not returned as a finished design.",
    }
  }

  const preferred = (input.preferred || "").trim().toLowerCase()
  const stability = {
    ok: true as const,
    provider: "stability" as const,
    planner: input.hasGemini ? ("gemini" as const) : ("none" as const),
  }

  if (preferred === "stability" && input.hasStability) return stability
  if (input.hasOpenAI) return { ok: true, provider: "openai", planner: "none" }
  if (input.hasStability) return stability

  return {
    ok: false,
    errorCode: "NO_AI_PROVIDER",
    stage: "provider-selection",
    errorMessage:
      "No image provider is configured. Set OPENAI_API_KEY to generate a redesign. A placeholder image was not created.",
  }
}

export function stageLabel(stage: string): string {
  switch (stage) {
    case "render":
      return "creating the design"
    case "pass1":
      return "the whole-room pass"
    case "pass2":
      return "the furniture pass"
    case "inpaint":
      return "the furniture pass"
    case "mask":
      return "preparing the edit area"
    case "validation":
      return "checking the result"
    case "provider-selection":
      return "choosing an image service"
    default:
      return "image generation"
  }
}
