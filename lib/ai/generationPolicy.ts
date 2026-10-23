export type ProviderDecision =
  | { ok: true; provider: "stability"; planner: "gemini" | "none" }
  | { ok: true; provider: "openai"; planner: "none" }
  | {
      ok: false
      errorCode: "MOCK_DISABLED" | "NO_AI_PROVIDER"
      errorMessage: string
      stage: "provider-selection"
    }

/**
 * Choose an image provider from which keys exist.
 * A missing provider or an explicit mock flag is a failure, not a placeholder image.
 * OpenAI is selected only when Stability is not configured. It is not a silent
 * backup after a Stability failure.
 */
export function decideImageProvider(input: {
  forceMock: boolean
  hasStability: boolean
  hasGemini: boolean
  hasOpenAI: boolean
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

  if (input.hasStability) {
    return {
      ok: true,
      provider: "stability",
      planner: input.hasGemini ? "gemini" : "none",
    }
  }

  if (input.hasOpenAI) {
    return {
      ok: true,
      provider: "openai",
      planner: "none",
    }
  }

  return {
    ok: false,
    errorCode: "NO_AI_PROVIDER",
    stage: "provider-selection",
    errorMessage:
      "No image provider is configured. Set STABILITY_API_KEY to generate a redesign. A placeholder image was not created.",
  }
}

export function stageLabel(stage: string): string {
  switch (stage) {
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
