import { GoogleGenerativeAI } from "@google/generative-ai"

export interface GeminiModel {
  fullName: string // e.g. "models/gemini-2.5-flash"
  shortName: string // e.g. "gemini-2.5-flash"
  displayName: string
  supportedGenerationMethods?: {
    generateContent?: boolean
    generateText?: boolean
    generateImage?: boolean
  }
}

/**
 * Normalize model name: strip "models/" prefix if present
 */
export function toShort(name: string): string {
  if (!name) return ""
  return name.startsWith("models/") ? name.substring(7) : name
}

/**
 * Normalize model name: add "models/" prefix if missing
 */
export function toFull(name: string): string {
  if (!name) return ""
  return name.startsWith("models/") ? name : `models/${name}`
}

export interface GeminiConfig {
  apiKey: string
  textModel: string
  imageModel?: string
}

/**
 * Get Gemini configuration from environment variables
 */
export function getGeminiConfig(): GeminiConfig | null {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return null
  }

  // Normalize model names to short format (without "models/" prefix)
  const textModelEnv = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash"
  const imageModelEnv = process.env.GEMINI_IMAGE_MODEL

  return {
    apiKey,
    textModel: toShort(textModelEnv), // Always store as shortName
    imageModel: imageModelEnv ? toShort(imageModelEnv) : undefined,
  }
}

/**
 * Initialize Gemini client with configuration
 */
export function createGeminiClient(config?: GeminiConfig) {
  const cfg = config || getGeminiConfig()
  if (!cfg) {
    throw new Error("GEMINI_API_KEY not configured")
  }
  return new GoogleGenerativeAI(cfg.apiKey)
}

/**
 * List available Gemini models
 */
export async function listModels(requestId?: string): Promise<GeminiModel[]> {
  const config = getGeminiConfig()
  if (!config) {
    throw new Error("GEMINI_API_KEY not configured")
  }

  try {
    // Use REST API to list models (SDK doesn't expose listModels)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: any = {}
      try {
        errorData = JSON.parse(errorText)
      } catch {
        // Ignore parse error
      }

      const httpError: any = new Error(
        `HTTP ${response.status}: ${errorData.error?.message || errorText || response.statusText}`
      )
      httpError.status = response.status
      httpError.statusCode = response.status
      throw httpError
    }

    const data = await response.json()
    const models = data.models || []

    const modelList: GeminiModel[] = models
      .map((model: any) => {
        const originalName = model.name || ""
        const fullName = toFull(originalName) // Ensure it has "models/" prefix
        const shortName = toShort(originalName) // Strip "models/" if present
        
        return {
          fullName,
          shortName,
          displayName: model.displayName || shortName || fullName,
          supportedGenerationMethods: model.supportedGenerationMethods || {},
        }
      })
      .filter((m: GeminiModel) => m.shortName) // Filter out empty names

    console.log(`[GEMINI] [${requestId || "unknown"}] Listed ${modelList.length} models`, {
      first10: modelList.slice(0, 10).map((m: GeminiModel) => m.shortName),
    })
    return modelList
  } catch (error: any) {
    const errorName = error.name || "UnknownError"
    const errorMessage = error.message || "Unknown error"
    const statusCode = error.status || error.statusCode || "unknown"

    console.error(`[GEMINI] [${requestId || "unknown"}] listModels failed`, {
      name: errorName,
      message: errorMessage,
      status: statusCode,
      stack: error.stack?.substring(0, 300),
    })

    throw new Error(`Failed to list Gemini models: ${errorName} (status: ${statusCode}) - ${errorMessage}`)
  }
}

/**
 * Check if a model exists and supports a specific generation method
 * Returns the matched model name and available models for error messages
 */
export async function validateModel(
  modelName: string,
  method: "generateContent" | "generateText" | "generateImage",
  requestId?: string
): Promise<{ valid: boolean; matchedModel?: string; availableModels: string[] }> {
  try {
    const models = await listModels(requestId)
    // Normalize input to shortName for comparison
    const configuredModelShort = toShort(modelName).toLowerCase()
    
    console.log(`[GEMINI] [${requestId || "unknown"}] Validating model`, {
      configuredModelShort,
      method,
    })
    
    // Match using shortName (case-insensitive)
    let model = models.find(
      (m) => m.shortName.toLowerCase() === configuredModelShort
    )
    
    // If no exact match, try partial match
    if (!model) {
      model = models.find(
        (m) =>
          m.shortName.toLowerCase().includes(configuredModelShort) ||
          configuredModelShort.includes(m.shortName.toLowerCase())
      )
    }

    // Get available models that support the requested method (return shortNames)
    const supportedMethod = method === "generateText" ? "generateContent" : method
    const availableModels = models
      .filter((m) => {
        // Check if model supports the method
        const supports = m.supportedGenerationMethods?.[supportedMethod] ?? false
        // Also check if supportedGenerationMethods exists (some models might not have this field but still work)
        const hasMethods = m.supportedGenerationMethods && Object.keys(m.supportedGenerationMethods).length > 0
        // Default to true if no methods listed but we're checking generateContent (most models support it)
        return supports || (!hasMethods && supportedMethod === "generateContent")
      })
      .map((m) => m.shortName) // Return shortNames

    if (!model) {
      console.warn(`[GEMINI] [${requestId || "unknown"}] Model not found: ${modelName}`, {
        configuredModelShort,
        availableModels: availableModels.slice(0, 10),
      })
      return { valid: false, availableModels }
    }

    const resolvedModelShort = model.shortName
    console.log(`[GEMINI] [${requestId || "unknown"}] Model matched`, {
      configuredModelShort,
      resolvedModelShort,
    })

    // generateContent is the standard method, generateText may not be in the API
    const checkMethod = method === "generateText" ? "generateContent" : method
    const supported = model.supportedGenerationMethods?.[checkMethod] ?? false
    if (!supported) {
      console.warn(`[GEMINI] [${requestId || "unknown"}] Model ${resolvedModelShort} does not support ${method}`, {
        matchedModel: resolvedModelShort,
        supportedMethods: Object.keys(model.supportedGenerationMethods || {}),
        availableModels: availableModels.slice(0, 10),
      })
      return { valid: false, matchedModel: resolvedModelShort, availableModels }
    }

    return { valid: true, matchedModel: resolvedModelShort, availableModels }
  } catch (error: any) {
    console.error(`[GEMINI] [${requestId || "unknown"}] validateModel failed:`, error.message)
    return { valid: false, availableModels: [] }
  }
}

/**
 * Generate text using Gemini
 */
export async function generateText(
  prompt: string,
  imageParts?: Array<{ data: string; mimeType: string }>,
  requestId?: string
): Promise<string> {
  const config = getGeminiConfig()
  if (!config) {
    throw new Error("GEMINI_API_KEY not configured")
  }

  try {
    const genAI = createGeminiClient(config)
    // SDK expects shortName (without "models/" prefix) - config.textModel is already normalized
    const modelShortName = toShort(config.textModel) // Double-check normalization
    const model = genAI.getGenerativeModel({ model: modelShortName })

    const content: any[] = []
    if (imageParts) {
      imageParts.forEach((part) => {
        content.push({
          inlineData: {
            data: part.data,
            mimeType: part.mimeType,
          },
        })
      })
    }
    content.push({ text: prompt })

    console.log(`[GEMINI] [${requestId || "unknown"}] Generating text`, {
      modelShortName,
      hasImages: !!imageParts?.length,
      promptLength: prompt.length,
    })

    const result = await model.generateContent(content)
    const response = result.response
    const text = response.text()

    console.log(`[GEMINI] [${requestId || "unknown"}] Text generation succeeded`, {
      responseLength: text.length,
    })

    return text
  } catch (error: any) {
    const errorName = error.name || "UnknownError"
    const errorMessage = error.message || "Unknown error"
    const statusCode = error.status || error.statusCode || "unknown"

    console.error(`[GEMINI] [${requestId || "unknown"}] generateText failed`, {
      name: errorName,
      message: errorMessage,
      status: statusCode,
      stack: error.stack?.substring(0, 300),
    })

    throw new Error(`Gemini text generation failed: ${errorName} (status: ${statusCode}) - ${errorMessage}`)
  }
}

/**
 * Generate image using Gemini (if image model is configured)
 */
export async function generateImage(
  prompt: string,
  imageParts?: Array<{ data: string; mimeType: string }>,
  requestId?: string
): Promise<string> {
  const config = getGeminiConfig()
  if (!config) {
    throw new Error("GEMINI_API_KEY not configured")
  }

  if (!config.imageModel) {
    throw new Error("GEMINI_IMAGE_MODEL not configured")
  }

  try {
    const genAI = createGeminiClient(config)
    // SDK expects shortName (without "models/" prefix)
    const modelShortName = toShort(config.imageModel)
    const model = genAI.getGenerativeModel({ model: modelShortName })

    const content: any[] = []
    if (imageParts) {
      imageParts.forEach((part) => {
        content.push({
          inlineData: {
            data: part.data,
            mimeType: part.mimeType,
          },
        })
      })
    }
    content.push({ text: prompt })

    console.log(`[GEMINI] [${requestId || "unknown"}] Generating image`, {
      modelShortName,
      hasImages: !!imageParts?.length,
      promptLength: prompt.length,
    })

    const result = await model.generateContent(content)
    const response = result.response

    // Extract image data from response
    // Note: This may vary depending on Gemini API response format
    const candidates = response.candidates || []
    if (candidates.length === 0) {
      throw new Error("No candidates returned from Gemini")
    }

    // For image generation, we may need to handle the response differently
    // This is a placeholder - adjust based on actual API response
    const imageData = candidates[0].content?.parts?.[0]?.inlineData?.data

    if (!imageData) {
      throw new Error("No image data in response")
    }

    console.log(`[GEMINI] [${requestId || "unknown"}] Image generation succeeded`)

    return imageData
  } catch (error: any) {
    const errorName = error.name || "UnknownError"
    const errorMessage = error.message || "Unknown error"
    const statusCode = error.status || error.statusCode || "unknown"

    console.error(`[GEMINI] [${requestId || "unknown"}] generateImage failed`, {
      name: errorName,
      message: errorMessage,
      status: statusCode,
      stack: error.stack?.substring(0, 300),
    })

    throw new Error(`Gemini image generation failed: ${errorName} (status: ${statusCode}) - ${errorMessage}`)
  }
}
