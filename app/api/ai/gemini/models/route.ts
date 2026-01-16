import { NextResponse } from "next/server"
import { listModels, getGeminiConfig } from "@/lib/ai/gemini"
import { randomBytes } from "crypto"

// Ensure Node.js runtime
export const runtime = "nodejs"

// Generate a unique request ID for logging
function generateRequestId(): string {
  return `req_${Date.now()}_${randomBytes(4).toString("hex")}`
}

export async function GET() {
  // Skip during build phase to prevent side effects
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-production-export") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          name: "BuildPhase",
          message: "Models endpoint not available during build phase",
        },
      },
      { status: 503 }
    )
  }

  const requestId = generateRequestId()

  try {
    const config = getGeminiConfig()
    if (!config) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            name: "MissingApiKey",
            message: "GEMINI_API_KEY not configured",
          },
        },
        { status: 500 }
      )
    }

    console.log(`[GEMINI MODELS] [${requestId}] Fetching available models`, {
      textModel: config.textModel,
      imageModel: config.imageModel || "not configured",
    })

    const models = await listModels(requestId)

    // Filter and organize models
    const textModels = models.filter(
      (m) =>
        m.supportedGenerationMethods?.generateContent ||
        m.supportedGenerationMethods?.generateText
    )
    const imageModels = models.filter((m) => m.supportedGenerationMethods?.generateImage)

    return NextResponse.json({
      ok: true,
      config: {
        textModel: config.textModel, // Already shortName
        imageModel: config.imageModel || null,
      },
      models: {
        all: models.map((m) => ({
          shortName: m.shortName,
          fullName: m.fullName,
          displayName: m.displayName,
          supportsText: !!(m.supportedGenerationMethods?.generateContent || m.supportedGenerationMethods?.generateText),
          supportsImage: !!m.supportedGenerationMethods?.generateImage,
        })),
        text: textModels.map((m) => m.shortName),
        image: imageModels.map((m) => m.shortName),
      },
      requestId,
    })
  } catch (error: any) {
    const errorName = error.name || "UnknownError"
    const errorMessage = error.message || "Unknown error occurred"
    const statusCode = error.status || error.statusCode || 500

    console.error(`[GEMINI MODELS] [${requestId}] Failed to list models`, {
      error: {
        name: errorName,
        message: errorMessage,
      },
      status: statusCode,
      stack: error.stack?.substring(0, 300),
    })

    return NextResponse.json(
      {
        ok: false,
        error: {
          name: errorName,
          message: errorMessage,
        },
      },
      { status: statusCode }
    )
  }
}
