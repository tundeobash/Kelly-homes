import { NextResponse } from "next/server"
import { listModels, validateModel, generateText, getGeminiConfig } from "@/lib/ai/gemini"
import { randomBytes } from "crypto"

// Ensure Node.js runtime for Gemini calls
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
          message: "Health check not available during build phase",
        },
      },
      { status: 503 }
    )
  }

  const requestId = generateRequestId()

  try {
    const config = getGeminiConfig()
    if (!config) {
      console.error(`[GEMINI HEALTH] [${requestId}] GEMINI_API_KEY not set`)
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

    const configuredModelShort = config.textModel
    console.log(`[GEMINI HEALTH] [${requestId}] Starting health check`, {
      configuredModelShort,
      imageModel: config.imageModel || "not configured",
    })

    // Step 1: List available models
    let availableModels: any[]
    try {
      availableModels = await listModels(requestId)
      console.log(`[GEMINI HEALTH] [${requestId}] Found ${availableModels.length} available models`)
    } catch (listError: any) {
      const statusCode = listError.status || listError.statusCode || 500
      const errorMessage = listError.message || "Unknown error"
      console.error(`[GEMINI HEALTH] [${requestId}] Failed to list models`, {
        status: statusCode,
        message: errorMessage,
      })
      return NextResponse.json(
        {
          ok: false,
          error: {
            name: "ListModelsFailed",
            message: `Failed to list models: ${errorMessage}`,
            status: statusCode,
          },
        },
        { status: statusCode }
      )
    }

    // Step 2: Validate text model exists and supports generateContent
    const validationResult = await validateModel(configuredModelShort, "generateContent", requestId)
    if (!validationResult.valid) {
      const suggestedModels = validationResult.availableModels.slice(0, 10)

      console.log(`[GEMINI HEALTH] [${requestId}] Model validation failed`, {
        configuredModelShort,
        resolvedModelShort: validationResult.matchedModel || null,
        first10Available: suggestedModels,
        totalAvailable: validationResult.availableModels.length,
      })

      return NextResponse.json(
        {
          ok: false,
          error: {
            name: "ModelNotFound",
            message: `Text model "${configuredModelShort}" not found or does not support generateContent`,
            configuredModel: configuredModelShort,
            matchedModel: validationResult.matchedModel || null,
            suggestedModels,
            totalAvailable: validationResult.availableModels.length,
          },
        },
        { status: 500 }
      )
    }

    const resolvedModelShort = validationResult.matchedModel || configuredModelShort
    console.log(`[GEMINI HEALTH] [${requestId}] Model validated`, {
      configuredModelShort,
      resolvedModelShort,
      first10Available: validationResult.availableModels.slice(0, 10),
    })

    // Step 3: Make a test call with "ping"
    try {
      const text = await generateText("ping", undefined, requestId)

      console.log(`[GEMINI HEALTH] [${requestId}] Health check succeeded`, {
        textModel: config.textModel,
        responseLength: text.length,
      })

      return NextResponse.json({
        ok: true,
        textModel: resolvedModelShort,
        imageModel: config.imageModel || null,
        responseLength: text.length,
      })
    } catch (generateError: any) {
      const statusCode = generateError.status || generateError.statusCode || 500
      const errorMessage = generateError.message || "Unknown error"

      console.error(`[GEMINI HEALTH] [${requestId}] Generate test failed`, {
        status: statusCode,
        message: errorMessage,
      })

      return NextResponse.json(
        {
          ok: false,
          error: {
            name: "GenerateFailed",
            message: `Test generation failed: ${errorMessage}`,
            status: statusCode,
          },
        },
        { status: statusCode }
      )
    }
  } catch (error: any) {
    const errorName = error.name || "UnknownError"
    const errorMessage = error.message || "Unknown error occurred"
    const statusCode = error.status || error.statusCode || 500

    console.error(`[GEMINI HEALTH] [${requestId}] Health check failed`, {
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
