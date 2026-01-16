import { generateText, getGeminiConfig } from "@/lib/ai/gemini"

export interface StagingPlan {
  roomType: string
  style: string
  addItems: Array<{
    item: string
    placement: string
    scale: string
    material: string
    color: string
    notes?: string
  }>
  avoid: string[]
  lighting: string
  colorPalette: string[]
}

export interface PlannerResult {
  planJson: StagingPlan
  planText: string
}

/**
 * Generate a structured staging plan using Gemini
 * Falls back to heuristic plan if Gemini fails
 */
export async function planRoomDesign(params: {
  style: string
  prompt?: string
  imageBase64?: string
  moreFurniture?: boolean
  requestId?: string
}): Promise<PlannerResult> {
  const { style, prompt, imageBase64, moreFurniture, requestId = "unknown" } = params

  // Explicit env check at runtime
  const config = getGeminiConfig()
  const hasKey = !!config
  console.log(`[GEMINI] [${requestId}] hasKey: ${hasKey}`)

  if (!hasKey || !config) {
    throw new Error("GEMINI_API_KEY missing at runtime")
  }

  console.log(`[GEMINI] [${requestId}] Using text model: ${config.textModel}`)

  try {

    // Build the planning prompt
    const planningPrompt = `Analyze this room photo and create a detailed staging plan in JSON format.

Style: ${style}
${prompt ? `Additional requirements: ${prompt}` : ""}
${moreFurniture ? "Include more furniture items and decor." : ""}

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "roomType": "living room" | "bedroom" | "dining room" | "kitchen" | "office" | "other",
  "style": "${style}",
  "addItems": [
    {
      "item": "sofa",
      "placement": "on floor, center-left, facing window",
      "scale": "large",
      "material": "fabric",
      "color": "navy blue",
      "notes": "should be clearly visible"
    },
    {
      "item": "coffee table",
      "placement": "on floor, center, in front of sofa",
      "scale": "medium",
      "material": "wood",
      "color": "natural wood",
      "notes": "positioned for easy access"
    },
    {
      "item": "rug",
      "placement": "on floor, under sofa and coffee table",
      "scale": "large",
      "material": "wool",
      "color": "beige",
      "notes": "defines seating area"
    }
  ],
  "avoid": [
    "do not block doors or windows",
    "preserve existing architecture",
    "keep walls and ceiling unchanged"
  ],
  "lighting": "natural daylight with warm ambient lighting",
  "colorPalette": ["navy blue", "beige", "natural wood", "white"]
}

Requirements:
- Must include at least: sofa, coffee table, rug
- Each item must have specific placement instructions
- Avoid array must include preservation constraints
- Return ONLY the JSON object, no other text.`

    // Prepare image parts if provided
    const imageParts = imageBase64
      ? [{ data: imageBase64, mimeType: "image/png" as const }]
      : undefined

    // Generate text using the wrapper
    const planText = await generateText(planningPrompt, imageParts, requestId)

    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = planText.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "")
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "")
    }

    // Parse JSON
    const planJson = JSON.parse(jsonText) as StagingPlan

    // Validate required fields
    if (!planJson.roomType || !planJson.style || !Array.isArray(planJson.addItems)) {
      throw new Error("Invalid plan JSON: missing required fields")
    }

    console.log(`[GEMINI] [${requestId}] Planning succeeded`, {
      roomType: planJson.roomType,
      itemsCount: planJson.addItems.length,
    })

    return {
      planJson,
      planText: planText,
    }
  } catch (error: any) {
    // Log full error details
    const errorName = error.name || "UnknownError"
    const errorMessage = error.message || "Unknown error"
    const errorStack = error.stack || ""

    console.error(`[GEMINI] [${requestId}] failed`, {
      name: errorName,
      message: errorMessage,
      stack: errorStack.substring(0, 500),
    })

    // If it's a fetch error, try to extract HTTP status/body
    if (error.message?.includes("fetch") || errorName === "FetchError") {
      console.error(`[GEMINI] [${requestId}] Fetch error details`, {
        cause: error.cause,
        status: error.status,
        statusText: error.statusText,
      })
    }

    // Re-throw with detailed message
    throw new Error(`Gemini planning failed: ${errorName} - ${errorMessage}`)
  }
}

/**
 * Create a simple heuristic fallback plan when Gemini fails
 */
export function createFallbackPlan(params: {
  style: string
  prompt?: string
  moreFurniture?: boolean
}): PlannerResult {
  const { style, prompt, moreFurniture } = params

  const styleFurnitureMap: Record<string, { items: string[]; colors: string[] }> = {
    rustic: {
      items: ["reclaimed wood coffee table", "linen sofa", "jute rug", "warm floor lamp"],
      colors: ["brown", "beige", "cream", "warm wood"],
    },
    modern: {
      items: ["sleek sectional sofa", "glass coffee table", "geometric rug", "modern floor lamp"],
      colors: ["black", "white", "gray", "chrome"],
    },
    minimalist: {
      items: ["simple low-profile sofa", "minimalist coffee table", "neutral rug", "clean floor lamp"],
      colors: ["white", "beige", "gray", "natural"],
    },
    scandinavian: {
      items: ["light wood coffee table", "light-colored sofa", "wool rug", "simple floor lamp"],
      colors: ["white", "light gray", "natural wood", "pastel"],
    },
    industrial: {
      items: ["leather sofa", "metal coffee table", "dark rug", "industrial floor lamp"],
      colors: ["black", "brown", "gray", "metal"],
    },
    "mid-century-modern": {
      items: ["retro sofa with tapered legs", "mid-century coffee table", "vintage rug", "atomic floor lamp"],
      colors: ["teal", "orange", "brown", "gold"],
    },
    bohemian: {
      items: ["colorful patterned sofa", "eclectic coffee table", "textured rug", "boho floor lamp"],
      colors: ["multicolor", "purple", "pink", "gold"],
    },
    japandi: {
      items: ["low-profile sofa", "minimalist wood coffee table", "natural fiber rug", "simple floor lamp"],
      colors: ["beige", "brown", "black", "natural"],
    },
    mediterranean: {
      items: ["warm-toned sofa", "ornate coffee table", "terracotta rug", "Mediterranean floor lamp"],
      colors: ["terracotta", "blue", "white", "gold"],
    },
    coastal: {
      items: ["light-colored sofa", "weathered wood coffee table", "nautical rug", "coastal floor lamp"],
      colors: ["blue", "white", "beige", "sand"],
    },
    farmhouse: {
      items: ["comfortable sofa", "farmhouse coffee table", "rustic rug", "vintage floor lamp"],
      colors: ["brown", "cream", "white", "wood"],
    },
    transitional: {
      items: ["elegant sofa", "transitional coffee table", "classic rug", "elegant floor lamp"],
      colors: ["navy", "beige", "gray", "gold"],
    },
    "art-deco": {
      items: ["luxurious sofa", "geometric coffee table", "rich rug", "art deco floor lamp"],
      colors: ["black", "gold", "emerald", "ivory"],
    },
    "wabi-sabi": {
      items: ["simple natural sofa", "imperfect wood coffee table", "natural rug", "simple floor lamp"],
      colors: ["brown", "beige", "gray", "natural"],
    },
    "tropical-modern": {
      items: ["modern sofa", "tropical wood coffee table", "vibrant rug", "modern floor lamp"],
      colors: ["green", "white", "brown", "coral"],
    },
    contemporary: {
      items: ["comfortable modern sofa", "contemporary coffee table", "stylish rug", "modern floor lamp"],
      colors: ["gray", "white", "black", "accent color"],
    },
  }

  const styleInfo = styleFurnitureMap[style] || {
    items: ["sofa", "coffee table", "rug", "floor lamp"],
    colors: ["neutral", "beige", "brown", "white"],
  }

  const baseItems = [
    { item: "sofa", placement: "on floor, center-left", scale: "large", material: "fabric", color: styleInfo.colors[0] },
    { item: "coffee table", placement: "on floor, center, in front of sofa", scale: "medium", material: "wood", color: styleInfo.colors[1] },
    { item: "rug", placement: "on floor, under sofa and coffee table", scale: "large", material: "wool", color: styleInfo.colors[2] },
  ]

  if (moreFurniture) {
    baseItems.push(
      { item: "floor lamp", placement: "on floor, behind sofa", scale: "medium", material: "metal", color: styleInfo.colors[3] },
      { item: "side table", placement: "on floor, next to sofa", scale: "small", material: "wood", color: styleInfo.colors[1] }
    )
  }

  const planJson: StagingPlan = {
    roomType: "living room",
    style: style,
    addItems: baseItems,
    avoid: ["do not block doors or windows", "preserve existing architecture", "keep walls and ceiling unchanged"],
    lighting: "natural daylight with warm ambient lighting",
    colorPalette: styleInfo.colors,
  }

  return {
    planJson,
    planText: JSON.stringify(planJson, null, 2),
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function generateStagingPlan(params: {
  imageBuffer: Buffer
  style: string
  refinePrompt?: string
  moreFurniture?: boolean
}): Promise<PlannerResult> {
  const { imageBuffer, style, refinePrompt, moreFurniture } = params
  const imageBase64 = imageBuffer.toString("base64")
  return planRoomDesign({
    style,
    prompt: refinePrompt,
    imageBase64,
    moreFurniture,
  })
}
