import { NextResponse } from "next/server"
import { getUserContext } from "@/lib/auth/getUserContext"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { writeFile, mkdir, stat, unlink } from "fs/promises"
import { readFileSync } from "fs"
import { join } from "path"
import { existsSync } from "fs"
import { createHash } from "crypto"
import sharp from "sharp"
import { planRoomDesign, createFallbackPlan, PlannerResult } from "@/lib/ai/geminiPlanner"
import { renderWithStability } from "@/lib/ai/stabilityRenderer"
import { stylePrompts } from "@/lib/stylePrompts"
import { put } from "@vercel/blob"

// Ensure Node.js runtime for Gemini calls
export const runtime = "nodejs"

// Generate a unique request ID for logging
function generateRequestId(): string {
  return `req_${Date.now()}_${randomBytes(4).toString("hex")}`
}

// Simple retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 600
): Promise<T> {
  let lastError: any
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1)
        const jitter = delay * 0.3 * (Math.random() - 0.5) // +/- 30% jitter
        await new Promise((resolve) => setTimeout(resolve, delay + jitter))
      }
    }
  }
  throw lastError
}

// Stability AI pixel limit
const STABILITY_MAX_PIXELS = 9_437_184
// OpenAI max file size (4MB)
const OPENAI_MAX_FILE_SIZE = 4 * 1024 * 1024

/**
 * Normalizes input image for AI providers:
 * - Applies EXIF orientation correction (auto-rotate)
 * - Converts any format (JPEG, HEIC, etc.) to PNG
 * - Resizes to meet Stability's pixel limit (9,437,184 pixels max) while preserving aspect ratio
 * - Ensures PNG is under 4MB for OpenAI fallback compatibility
 */
async function normalizeInputImage(
  inputBuffer: Buffer,
  requestId: string
): Promise<{ buffer: Buffer; width: number; height: number }> {
  // Step 1: Apply EXIF rotation first to get correct orientation
  // This ensures portrait photos stay portrait after rotation
  const rotatedBuffer = await sharp(inputBuffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .toBuffer()
  
  // Get metadata AFTER rotation (dimensions may have swapped for portrait)
  const metadata = await sharp(rotatedBuffer).metadata()
  const originalWidth = metadata.width || 1024
  const originalHeight = metadata.height || 1024
  const originalPixels = originalWidth * originalHeight
  const originalFormat = metadata.format || "unknown"
  const aspectRatio = originalWidth / originalHeight

  console.log(`[${requestId}] Normalizing input image`, {
    originalFormat,
    originalWidth,
    originalHeight,
    originalPixels,
    aspectRatio: aspectRatio.toFixed(3),
    orientation: originalWidth > originalHeight ? "landscape" : originalWidth < originalHeight ? "portrait" : "square",
    originalSize: inputBuffer.length,
  })

  let targetWidth = originalWidth
  let targetHeight = originalHeight

  // Step 2: Check if resize needed for Stability pixel limit (preserve aspect ratio)
  if (originalPixels > STABILITY_MAX_PIXELS) {
    const scaleFactor = Math.sqrt(STABILITY_MAX_PIXELS / originalPixels)
    targetWidth = Math.floor(originalWidth * scaleFactor)
    targetHeight = Math.floor(originalHeight * scaleFactor)
    
    // Ensure dimensions are even (required by some encoders)
    targetWidth = targetWidth - (targetWidth % 2)
    targetHeight = targetHeight - (targetHeight % 2)
    
    console.log(`[${requestId}] Resizing for Stability pixel limit`, {
      scaleFactor: scaleFactor.toFixed(4),
      targetWidth,
      targetHeight,
      targetPixels: targetWidth * targetHeight,
      aspectRatioPreserved: (targetWidth / targetHeight).toFixed(3),
    })
  }

  // Step 3: Convert to PNG and resize (using rotated buffer, fit: "inside" preserves aspect ratio)
  let pngBuffer = await sharp(rotatedBuffer)
    .resize(targetWidth, targetHeight, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 6 })
    .toBuffer()

  // Step 4: Ensure PNG is under 4MB for OpenAI fallback (max 3 attempts, preserve aspect ratio)
  let attempts = 0
  const maxAttempts = 3
  const scaleFactor = 0.85

  while (pngBuffer.length >= OPENAI_MAX_FILE_SIZE && attempts < maxAttempts) {
    attempts++
    targetWidth = Math.floor(targetWidth * scaleFactor)
    targetHeight = Math.floor(targetHeight * scaleFactor)
    
    // Ensure dimensions are even
    targetWidth = targetWidth - (targetWidth % 2)
    targetHeight = targetHeight - (targetHeight % 2)

    console.log(`[${requestId}] PNG too large for OpenAI, reducing (attempt ${attempts})`, {
      currentSize: pngBuffer.length,
      maxSize: OPENAI_MAX_FILE_SIZE,
      newWidth: targetWidth,
      newHeight: targetHeight,
    })

    pngBuffer = await sharp(rotatedBuffer)
      .resize(targetWidth, targetHeight, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 }) // Max compression on retry
      .toBuffer()
  }

  // Get final dimensions from the actual buffer
  const finalMetadata = await sharp(pngBuffer).metadata()
  const finalWidth = finalMetadata.width || targetWidth
  const finalHeight = finalMetadata.height || targetHeight

  console.log(`[${requestId}] Image normalization complete`, {
    originalFormat,
    originalSize: inputBuffer.length,
    finalSize: pngBuffer.length,
    originalDimensions: `${originalWidth}x${originalHeight}`,
    finalDimensions: `${finalWidth}x${finalHeight}`,
    aspectRatioPreserved: Math.abs((finalWidth / finalHeight) - aspectRatio) < 0.01,
    pixelReduction: originalPixels > finalWidth * finalHeight 
      ? `${((1 - (finalWidth * finalHeight) / originalPixels) * 100).toFixed(1)}%` 
      : "none",
    sizeReduction: `${((1 - pngBuffer.length / inputBuffer.length) * 100).toFixed(1)}%`,
    meetsStabilityLimit: finalWidth * finalHeight <= STABILITY_MAX_PIXELS,
    meetsOpenAILimit: pngBuffer.length < OPENAI_MAX_FILE_SIZE,
  })

  return {
    buffer: pngBuffer,
    width: finalWidth,
    height: finalHeight,
  }
}

/**
 * Uploads a generated PNG image to Vercel Blob and returns the public URL.
 * Handles both remote URLs (fetches and uploads) and base64 data (decodes and uploads).
 */
async function uploadGeneratedImageToBlob(params: {
  data: string | Buffer // Can be a remote URL (https://...), base64 data, or Buffer
  filename: string
  requestId: string
}): Promise<string> {
  const { data, filename, requestId } = params
  
  let buffer: Buffer

  // Handle Buffer directly
  if (Buffer.isBuffer(data)) {
    buffer = data
  }
  // Handle remote URL
  else if (typeof data === "string" && (data.startsWith("http://") || data.startsWith("https://"))) {
    try {
      console.log(`[${requestId}] Fetching image from remote URL: ${data.substring(0, 50)}...`)
      const response = await fetch(data)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: HTTP ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    } catch (error: any) {
      console.error(`[${requestId}] Error fetching remote image:`, error)
      throw new Error(`Failed to fetch image from URL: ${error.message}`)
    }
  } 
  // Handle base64 data
  else if (typeof data === "string" && (data.startsWith("data:image/") || /^[A-Za-z0-9+/=]+$/.test(data))) {
    try {
      // Remove data URL prefix if present (e.g., "data:image/png;base64,")
      const base64Data = data.includes(",") ? data.split(",")[1] : data
      buffer = Buffer.from(base64Data, "base64")
    } catch (error: any) {
      console.error(`[${requestId}] Error decoding base64 image:`, error)
      throw new Error(`Failed to decode base64 image: ${error.message}`)
    }
  } else {
    throw new Error(`Invalid image data format. Expected URL, base64, or Buffer`)
  }

  // Upload to Vercel Blob
  try {
    const blob = await put(`generated/${filename}`, buffer, {
      access: "public",
      contentType: "image/png",
    })
    
    console.log(`[${requestId}] Uploaded generated image to Vercel Blob`, {
      filename,
      byteSize: buffer.length,
      blobUrl: blob.url,
    })
    
    return blob.url
  } catch (error: any) {
    console.error(`[${requestId}] Error uploading to Vercel Blob:`, error)
    throw new Error(`Failed to upload image to Blob: ${error.message}`)
  }
}

/**
 * Generate a staged room image using OpenAI or Gemini
 * Returns base64 image data or remote URL
 */
async function generateStagedImage(params: {
  imageUrl: string
  style: string
  prompt?: string
  moreFurniture?: boolean
  requestId: string
}): Promise<string> {
  const { imageUrl, style, prompt, moreFurniture, requestId } = params
  
  // Check for FORCE_MOCK_AI flag
  if (process.env.FORCE_MOCK_AI === "true") {
    console.log(`[${requestId}] FORCE_MOCK_AI=true, using placeholder`)
    return "mock"
  }

  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasGemini = !!process.env.GEMINI_API_KEY

  console.log(`[${requestId}] Provider availability check`, {
    hasOpenAIKey: hasOpenAI,
    hasGeminiKey: hasGemini,
  })

  // Build style-specific furniture details
  const styleFurnitureMap: Record<string, string> = {
    rustic: "reclaimed wood coffee table, linen sofa, jute rug, warm floor lamp, wooden side table",
    modern: "sleek sectional sofa, glass coffee table, geometric rug, modern floor lamp, metal side table",
    minimalist: "simple low-profile sofa, minimalist coffee table, neutral rug, clean floor lamp, minimal decor",
    scandinavian: "light wood coffee table, light-colored sofa, wool rug, simple floor lamp, natural wood side table",
    industrial: "leather sofa, metal coffee table, dark rug, industrial floor lamp, metal side table",
    "mid-century-modern": "retro sofa with tapered legs, mid-century coffee table, vintage rug, atomic floor lamp, teak side table",
    bohemian: "colorful patterned sofa, eclectic coffee table, textured rug, boho floor lamp, decorative side table",
    japandi: "low-profile sofa, minimalist wood coffee table, natural fiber rug, simple floor lamp, zen side table",
    mediterranean: "warm-toned sofa, ornate coffee table, terracotta rug, Mediterranean floor lamp, carved side table",
    coastal: "light-colored sofa, weathered wood coffee table, nautical rug, coastal floor lamp, beachy side table",
    farmhouse: "comfortable sofa, farmhouse coffee table, rustic rug, vintage floor lamp, wooden side table",
    transitional: "elegant sofa, transitional coffee table, classic rug, elegant floor lamp, refined side table",
    "art-deco": "luxurious sofa, geometric coffee table, rich rug, art deco floor lamp, ornate side table",
    "wabi-sabi": "simple natural sofa, imperfect wood coffee table, natural rug, simple floor lamp, handcrafted side table",
    "tropical-modern": "modern sofa, tropical wood coffee table, vibrant rug, modern floor lamp, tropical side table",
    contemporary: "comfortable modern sofa, contemporary coffee table, stylish rug, modern floor lamp, functional side table",
  }
  
  const styleFurniture = styleFurnitureMap[style] || "sofa, coffee table, rug, floor lamp, side table"
  
  // Build the staging prompt - explicitly instruct to ADD NEW furniture in the transparent mask region
  const furnitureNote = moreFurniture 
    ? ` Add NEW furniture objects: ${styleFurniture}, additional decor items. Make them clearly visible and prominent.` 
    : ` Add NEW furniture objects: ${styleFurniture}. Make them clearly visible and prominent.`
  
  const userPromptNote = prompt ? ` ${prompt}.` : ""
  
  // Strengthened prompt: explicitly add furniture, preserve architecture layout with continuity
  const stagingPrompt = `Add new furniture and decor in the editable region. Stage this room photo in ${style} style.${furnitureNote}${userPromptNote} The furniture must be clearly visible, well-placed, and match the ${style} aesthetic. Do not return the original image unchanged. Photorealistic. No text, no watermark.

${CONTINUITY_CONSTRAINTS}`

  // Try OpenAI first if available
  if (hasOpenAI) {
    try {
      console.log(`[${requestId}] Attempting OpenAI image generation`, {
        imageUrl: imageUrl.substring(0, 50) + "...",
        promptLength: stagingPrompt.length,
      })
      // Load and normalize image for OpenAI
      let imageBuffer: Buffer
      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        const response = await fetch(imageUrl)
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
        imageBuffer = Buffer.from(await response.arrayBuffer())
      } else {
        imageBuffer = readFileSync(join(process.cwd(), "public", imageUrl))
      }
      const normalized = await normalizeInputImage(imageBuffer, requestId)
      const result = await generateWithOpenAI(normalized.buffer, stagingPrompt, requestId)
      console.log(`[${requestId}] OpenAI generation succeeded`, {
        resultType: typeof result,
        resultPreview: result.substring(0, 50) + "...",
      })
      return result
    } catch (error: any) {
      console.error(`[${requestId}] OpenAI generation failed:`, {
        error: error.message,
        stack: error.stack?.substring(0, 200),
      })
      // Fall through to Gemini or mock only if explicitly in dev mode
      if (process.env.NODE_ENV === "development" && process.env.ALLOW_MOCK_FALLBACK === "true") {
        console.warn(`[${requestId}] Dev mode: allowing mock fallback after OpenAI failure`)
      } else {
        // In production, re-throw the error instead of silently falling back
        throw error
      }
    }
  }

  // Try Gemini if available (and OpenAI not available or failed)
  if (hasGemini) {
    try {
      console.log(`[${requestId}] Attempting Gemini image generation`)
      const result = await generateWithGemini(imageUrl, stagingPrompt, requestId)
      console.log(`[${requestId}] Gemini generation succeeded`)
      return result
    } catch (error: any) {
      console.error(`[${requestId}] Gemini generation failed:`, error.message)
      // Only fall through to mock in dev mode with explicit flag
      if (process.env.NODE_ENV === "development" && process.env.ALLOW_MOCK_FALLBACK === "true") {
        console.warn(`[${requestId}] Dev mode: allowing mock fallback after Gemini failure`)
      } else {
        throw error
      }
    }
  }

  // No providers available
  if (!hasOpenAI && !hasGemini) {
    throw new Error("No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY environment variable.")
  }

  // All providers failed - only use mock if explicitly allowed
  if (process.env.NODE_ENV === "development" && process.env.ALLOW_MOCK_FALLBACK === "true") {
    console.warn(`[${requestId}] All providers failed, using placeholder fallback (dev mode)`)
    return "mock"
  }

  // In production or without explicit fallback flag, throw error
  throw new Error("All AI providers failed. Check API keys and network connectivity.")
}

// Mask generation constants
const MASK_MARGIN_LEFT_RIGHT = 0.07 // 7% margin on left and right
const MASK_MARGIN_TOP = 0.42 // 42% margin on top (protect ceiling/upper walls)
const MASK_MARGIN_BOTTOM = 0.08 // 8% margin on bottom
const MASK_FEATHER_RADIUS = 18 // Gaussian blur radius for edge feathering (pixels)
const MASK_TARGET_COVERAGE_MIN = 0.25 // Target 25-40% coverage
const MASK_TARGET_COVERAGE_MAX = 0.40

// Two-pass generation pipeline constants
const ENABLE_TWO_PASS_GENERATION = true // Toggle for two-pass pipeline
const PASS1_STRENGTH = 0.35 // Low strength for global coherence (0.25-0.40)
const PASS2_STRENGTH = 0.75 // Normal strength for furniture inpaint (0.65-0.85)

/**
 * Creates an inpainting mask PNG for AI inpainting APIs.
 * The mask must be the exact same dimensions as the input image.
 * Supports both OpenAI (transparent=editable) and Stability (may require inversion).
 * 
 * IMPORTANT: Mask semantics vary by provider:
 * - OpenAI: TRANSPARENT pixels (alpha=0) = editable, OPAQUE (alpha=255) = preserved
 * - Stability: May require WHITE pixels = editable, BLACK = preserved (inverted)
 * 
 * Mask strategy (improved for better blending):
 * - Conservative editable region with margins to avoid architecture edges
 * - Feathered edges to blend transition between preserved and edited regions
 * - Target coverage: 25-40% (reduced from ~50%+)
 */
async function createInpaintingMask(
  imageBuffer: Buffer, 
  requestId: string,
  invertForStability: boolean = false
): Promise<Buffer> {
  try {
    // Get image dimensions using sharp
    const imageMetadata = await sharp(imageBuffer).metadata()
    const width = imageMetadata.width || 1024
    const height = imageMetadata.height || 1024
    
    console.log(`[${requestId}] Creating inpainting mask`, {
      width,
      height,
    })
    
    // Define editable region with safe margins to avoid architecture edges:
    // - Protect top 42% (ceiling, lights, upper walls)
    // - Protect bottom 8% (floor edge, baseboard)
    // - Protect left/right 7% each (wall edges, corners)
    const marginLeft = Math.floor(width * MASK_MARGIN_LEFT_RIGHT)
    const marginRight = Math.floor(width * MASK_MARGIN_LEFT_RIGHT)
    const marginTop = Math.floor(height * MASK_MARGIN_TOP)
    const marginBottom = Math.floor(height * MASK_MARGIN_BOTTOM)
    
    const editableStartX = marginLeft
    const editableEndX = width - marginRight
    const editableStartY = marginTop
    const editableEndY = height - marginBottom
    
    const editableWidth = editableEndX - editableStartX
    const editableHeight = editableEndY - editableStartY
    
    // Verify coverage is within target range
    const coverage = (editableWidth * editableHeight) / (width * height)
    console.log(`[${requestId}] Mask coverage calculation`, {
      editableWidth,
      editableHeight,
      coverage: `${(coverage * 100).toFixed(1)}%`,
      targetRange: `${MASK_TARGET_COVERAGE_MIN * 100}%-${MASK_TARGET_COVERAGE_MAX * 100}%`,
      withinTarget: coverage >= MASK_TARGET_COVERAGE_MIN && coverage <= MASK_TARGET_COVERAGE_MAX,
    })
    
    // Create raw RGBA buffer: 4 bytes per pixel (R, G, B, A)
    const pixelCount = width * height
    const bufferSize = pixelCount * 4
    const rawBuffer = Buffer.alloc(bufferSize)
    
    // Initialize entire mask based on inversion setting
    // Default (OpenAI): OPAQUE black = preserved, TRANSPARENT = editable
    // Inverted (Stability): OPAQUE white = editable, OPAQUE black = preserved
    const isInverted = invertForStability
    
    if (!isInverted) {
      // OpenAI style: opaque black background (preserved)
      for (let i = 0; i < pixelCount; i++) {
        const offset = i * 4
        rawBuffer[offset] = 0     // R
        rawBuffer[offset + 1] = 0 // G
        rawBuffer[offset + 2] = 0 // B
        rawBuffer[offset + 3] = 255 // A = OPAQUE (preserved)
      }
      
      // Set editable region to TRANSPARENT (alpha=0, RGB=0)
      for (let y = editableStartY; y < editableEndY; y++) {
        for (let x = editableStartX; x < editableEndX; x++) {
          const offset = (y * width + x) * 4
          rawBuffer[offset] = 0     // R
          rawBuffer[offset + 1] = 0 // G
          rawBuffer[offset + 2] = 0 // B
          rawBuffer[offset + 3] = 0 // A = TRANSPARENT (editable)
        }
      }
    } else {
      // Stability style: opaque black background (preserved), opaque white for editable
      for (let i = 0; i < pixelCount; i++) {
        const offset = i * 4
        rawBuffer[offset] = 0     // R = black (preserved)
        rawBuffer[offset + 1] = 0 // G = black
        rawBuffer[offset + 2] = 0 // B = black
        rawBuffer[offset + 3] = 255 // A = OPAQUE (preserved)
      }
      
      // Set editable region to OPAQUE WHITE (RGB=255, alpha=255)
      for (let y = editableStartY; y < editableEndY; y++) {
        for (let x = editableStartX; x < editableEndX; x++) {
          const offset = (y * width + x) * 4
          rawBuffer[offset] = 255     // R = white (editable)
          rawBuffer[offset + 1] = 255 // G = white
          rawBuffer[offset + 2] = 255 // B = white
          rawBuffer[offset + 3] = 255 // A = OPAQUE (editable - white)
        }
      }
    }
    
    // Create initial PNG from raw RGBA buffer
    let maskBuffer = await sharp(rawBuffer, {
      raw: {
        width,
        height,
        channels: 4, // RGBA
      },
    })
      .png()
      .toBuffer()
    
    // Apply edge feathering using Gaussian blur on a separate channel
    // For Stability (inverted): blur the RGB channels to feather the white/black transition
    // For OpenAI: blur the alpha channel to feather the transparent/opaque transition
    if (MASK_FEATHER_RADIUS > 0) {
      if (isInverted) {
        // For Stability: blur the entire image to feather white/black edges
        // This creates a gradient at the boundary
        maskBuffer = await sharp(maskBuffer)
          .blur(MASK_FEATHER_RADIUS)
          .png()
          .toBuffer()
      } else {
        // For OpenAI: we need to feather the alpha channel
        // Extract alpha, blur it, recombine
        // Since sharp doesn't directly support alpha-only blur, we use a workaround:
        // 1. Extract alpha as grayscale
        // 2. Blur it
        // 3. Use blurred grayscale as new alpha
        const alphaChannel = await sharp(rawBuffer, {
          raw: { width, height, channels: 4 },
        })
          .extractChannel(3) // Alpha channel
          .toBuffer()
        
        const blurredAlpha = await sharp(alphaChannel, {
          raw: { width, height, channels: 1 },
        })
          .blur(MASK_FEATHER_RADIUS)
          .raw()
          .toBuffer()
        
        // Recombine: create new RGBA buffer with blurred alpha
        const featheredBuffer = Buffer.alloc(bufferSize)
        for (let i = 0; i < pixelCount; i++) {
          const rgbaOffset = i * 4
          featheredBuffer[rgbaOffset] = 0     // R (black)
          featheredBuffer[rgbaOffset + 1] = 0 // G
          featheredBuffer[rgbaOffset + 2] = 0 // B
          featheredBuffer[rgbaOffset + 3] = blurredAlpha[i] // Feathered alpha
        }
        
        maskBuffer = await sharp(featheredBuffer, {
          raw: { width, height, channels: 4 },
        })
          .png()
          .toBuffer()
      }
      
      console.log(`[${requestId}] Applied edge feathering`, {
        featherRadius: MASK_FEATHER_RADIUS,
        mode: isInverted ? "RGB blur" : "alpha blur",
      })
    }
    
    const editablePercentage = Math.round(coverage * 100)
    
    // Compute mask stats for logging
    const maskMetadataResult = await sharp(maskBuffer).raw().toBuffer({ resolveWithObject: true })
    const maskPixels = maskMetadataResult.data
    let transparentCount = 0
    let whiteCount = 0
    let blackCount = 0
    let partialCount = 0 // Feathered pixels
    
    for (let i = 0; i < maskPixels.length; i += 4) {
      const r = maskPixels[i]
      const g = maskPixels[i + 1]
      const b = maskPixels[i + 2]
      const a = maskPixels[i + 3]
      
      if (a === 0) {
        transparentCount++
      } else if (a < 255 && !isInverted) {
        partialCount++ // Feathered alpha
      } else if (r === 255 && g === 255 && b === 255 && a === 255) {
        whiteCount++
      } else if (r === 0 && g === 0 && b === 0 && a === 255) {
        blackCount++
      } else if (isInverted && r > 0 && r < 255) {
        partialCount++ // Feathered grayscale
      }
    }
    
    const totalPixels = maskPixels.length / 4
    const maskMode = isInverted ? "inverted (white=edit, black=preserve)" : "standard (transparent=edit, opaque=preserve)"
    
    console.log(`[${requestId}] Inpainting mask created`, {
      width,
      height,
      editableRegion: {
        x: editableStartX,
        y: editableStartY,
        width: editableWidth,
        height: editableHeight,
        coverage: `${editablePercentage}%`,
      },
      margins: {
        left: `${(MASK_MARGIN_LEFT_RIGHT * 100).toFixed(0)}%`,
        right: `${(MASK_MARGIN_LEFT_RIGHT * 100).toFixed(0)}%`,
        top: `${(MASK_MARGIN_TOP * 100).toFixed(0)}%`,
        bottom: `${(MASK_MARGIN_BOTTOM * 100).toFixed(0)}%`,
      },
      featherRadius: MASK_FEATHER_RADIUS,
      maskSize: maskBuffer.length,
      maskMode,
      inverted: isInverted,
      maskStats: {
        editablePixels: isInverted ? whiteCount : transparentCount,
        preservedPixels: blackCount,
        featheredPixels: partialCount,
        editablePercent: ((isInverted ? whiteCount : transparentCount) / totalPixels * 100).toFixed(2) + "%",
        preservedPercent: (blackCount / totalPixels * 100).toFixed(2) + "%",
        featheredPercent: (partialCount / totalPixels * 100).toFixed(2) + "%",
      },
    })
    
    // Save debug artifacts in dev mode only (skip on Vercel to avoid ENOENT)
    if (process.env.NODE_ENV === "development" && process.env.SAVE_DEBUG_ARTIFACTS === "true") {
      try {
        const tmpDir = "/tmp"
        
        // Save mask
        const maskDebugPath = join(tmpDir, `debug-mask-${requestId}.png`)
        await writeFile(maskDebugPath, maskBuffer)
        
        // Save composite preview (input image with mask overlay)
        const maskOverlay = await sharp(maskBuffer)
          .resize(width, height)
          .toBuffer()
        
        const compositeBuffer = await sharp(imageBuffer)
          .composite([{
            input: maskOverlay,
            blend: "over",
          }])
          .png()
          .toBuffer()
        
        const compositePath = join(tmpDir, `debug-composite-${requestId}.png`)
        await writeFile(compositePath, compositeBuffer)
        
        console.log(`[${requestId}] Debug artifacts saved to /tmp`, {
          mask: maskDebugPath,
          composite: compositePath,
        })
      } catch (debugError: any) {
        console.warn(`[${requestId}] Failed to save debug artifacts:`, debugError.message)
      }
    }
    
    return maskBuffer
  } catch (error: any) {
    console.error(`[${requestId}] Error creating inpainting mask:`, error)
    throw new Error(`Failed to create inpainting mask: ${error.message}`)
  }
}

// Continuity constraints to append to rendering prompts
const CONTINUITY_CONSTRAINTS = `
Preserve architectural layout and room structure. Do not change camera angle.
Allow subtle lighting and surface adjustments to maintain seamless continuity.
No visible seams or cut lines. Consistent wall shading and continuous surfaces.
Consistent lighting direction and color temperature. Preserve global perspective and vanishing points.`.trim()

/**
 * Generate staged image using OpenAI Images Edits API (inpainting)
 * This function FORCES a real inpainting edit by:
 * - Using the images.edits endpoint with both image and mask
 * - Using a non-negotiable explicit prompt
 * - Validating output before returning
 * 
 * Note: OpenAI DALL-E 2 edits API only supports square output sizes (256x256, 512x512, 1024x1024).
 * The input image aspect ratio cannot be preserved in the output when using OpenAI as fallback.
 */
async function generateWithOpenAI(
  normalizedImageBuffer: Buffer,
  prompt: string,
  requestId: string,
  negativePrompt?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set")
  }

  // Use the pre-normalized buffer directly (already PNG, already sized correctly)
  const imageBuffer = normalizedImageBuffer
  
  // Compute SHA256 hash of input image for no-op detection
  const inputHash = createHash("sha256").update(imageBuffer).digest("hex")
  console.log(`[${requestId}] Input image hash`, {
    hash: inputHash.substring(0, 16) + "...",
    size: imageBuffer.length,
  })
  
  // OpenAI Images Edits API requires images in RGBA, LA, or L format
  // Convert the input image to RGBA format
  console.log(`[${requestId}] Converting image to RGBA format`)
  const rgbaImageBuffer = await sharp(imageBuffer)
    .ensureAlpha() // Ensure alpha channel exists (converts RGB to RGBA)
    .png()
    .toBuffer()
  
  console.log(`[${requestId}] Image converted to RGBA`, {
    originalSize: imageBuffer.length,
    rgbaSize: rgbaImageBuffer.length,
  })
  
  // For OpenAI Images Edits API (inpainting), we need a transparency-based mask:
  // - TRANSPARENT pixels (alpha=0) = editable region (where furniture will be added)
  // - OPAQUE pixels (alpha=255) = preserved region (walls, ceiling, windows)
  // Use /tmp for mask file (writable on Vercel)
  const maskPath = join("/tmp", `mask_${Date.now()}.png`)
  
  // Create an inpainting mask PNG with transparent editable region
  // The mask must be in RGBA format with same dimensions as the image
  const inpaintingMaskBuffer = await createInpaintingMask(rgbaImageBuffer, requestId)
  await writeFile(maskPath, inpaintingMaskBuffer)
  
  // Log mask alpha statistics
  try {
    const maskMetadata = await sharp(inpaintingMaskBuffer).raw().toBuffer({ resolveWithObject: true })
    const maskPixels = maskMetadata.data
    let transparentCount = 0
    let opaqueCount = 0
    // RGBA format: every 4th byte (index 3, 7, 11, ...) is alpha
    for (let i = 3; i < maskPixels.length; i += 4) {
      if (maskPixels[i] === 0) {
        transparentCount++
      } else if (maskPixels[i] === 255) {
        opaqueCount++
      }
    }
    const totalPixels = maskPixels.length / 4
    console.log(`[${requestId}] Mask alpha statistics`, {
      totalPixels,
      transparentPixels: transparentCount,
      opaquePixels: opaqueCount,
      transparentPercent: ((transparentCount / totalPixels) * 100).toFixed(2) + "%",
      opaquePercent: ((opaqueCount / totalPixels) * 100).toFixed(2) + "%",
    })
  } catch (maskStatsError) {
    console.warn(`[${requestId}] Failed to compute mask alpha stats:`, maskStatsError)
  }
  
  // Use provided prompt (should already be resolved with style prompts)
  // If prompt is empty or "none", use fallback
  const resolvedPrompt = prompt && prompt !== "none" && prompt.trim() !== ""
    ? prompt
    : `Add NEW furniture that is clearly visible. At minimum add: a sofa, a coffee table, and a rug. Do not return the original image unchanged. Keep walls/lighting/layout consistent; only change within the editable region. Photorealistic. No text, no watermark.`
  
  // Append negative prompt if provided
  const finalPrompt = negativePrompt 
    ? `${resolvedPrompt}\n\nNegative prompts:\n${negativePrompt}`
    : resolvedPrompt
  
  console.log(`[${requestId}] Calling OpenAI images.edits (inpaint)`, {
    originalPromptLength: prompt.length,
    resolvedPromptLength: finalPrompt.length,
    imageSize: rgbaImageBuffer.length,
    maskSize: inpaintingMaskBuffer.length,
  })

  try {
    // Use multipart/form-data for OpenAI Images Edits API (Node.js compatible)
    const boundary = `----WebKitFormBoundary${randomBytes(16).toString("hex")}`
    const formDataParts: Buffer[] = []

    // Add image (must be RGBA format)
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="image"; filename="room.png"\r\n`))
    formDataParts.push(Buffer.from(`Content-Type: image/png\r\n\r\n`))
    formDataParts.push(rgbaImageBuffer) // Use RGBA converted image
    formDataParts.push(Buffer.from(`\r\n`))

    // Add mask (must be same size as image, with transparent region for editing)
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="mask"; filename="mask.png"\r\n`))
    formDataParts.push(Buffer.from(`Content-Type: image/png\r\n\r\n`))
    formDataParts.push(inpaintingMaskBuffer)
    formDataParts.push(Buffer.from(`\r\n`))

    // Add prompt (use resolved prompt with style prompts)
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="prompt"\r\n\r\n`))
    formDataParts.push(Buffer.from(finalPrompt))
    formDataParts.push(Buffer.from(`\r\n`))

    // Add n
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="n"\r\n\r\n`))
    formDataParts.push(Buffer.from("1"))
    formDataParts.push(Buffer.from(`\r\n`))

    // Add size
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="size"\r\n\r\n`))
    formDataParts.push(Buffer.from("1024x1024"))
    formDataParts.push(Buffer.from(`\r\n`))

    // Close boundary
    formDataParts.push(Buffer.from(`--${boundary}--\r\n`))

    const formDataBuffer = Buffer.concat(formDataParts)

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: formDataBuffer,
    })

    // Clean up temp mask file
    try {
      await unlink(maskPath)
    } catch {
      // Ignore cleanup errors
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `OpenAI API error: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage += ` - ${errorJson.error?.message || errorText}`
      } catch {
        errorMessage += ` - ${errorText.substring(0, 200)}`
      }
      console.error(`[${requestId}] OpenAI API error details:`, {
        status: response.status,
        statusText: response.statusText,
        errorPreview: errorText.substring(0, 200),
      })
      throw new Error(errorMessage)
    }

    const data = await response.json()
    
    // OpenAI returns { data: [{ url: "https://..." }] }
    if (data.data && data.data[0] && data.data[0].url) {
      const returnedImageUrl = data.data[0].url
      
      // CRITICAL: Validate output BEFORE returning
      // Fetch the returned image and validate it
      console.log(`[${requestId}] Fetching returned image for validation`, {
        url: returnedImageUrl.substring(0, 50) + "...",
      })
      
      const imageResponse = await fetch(returnedImageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch returned image: HTTP ${imageResponse.status}`)
      }
      
      const outputArrayBuffer = await imageResponse.arrayBuffer()
      const outputBuffer = Buffer.from(outputArrayBuffer)
      const outputSize = outputBuffer.length
      
      // Log output file size and first 8 bytes
      const first8Bytes = Array.from(outputBuffer.slice(0, 8))
        .map(b => b.toString(16).padStart(2, "0"))
        .join(" ")
      console.log(`[${requestId}] Output validation`, {
        fileSize: outputSize,
        first8BytesHex: first8Bytes,
        first8BytesDecimal: Array.from(outputBuffer.slice(0, 8)).join(", "),
      })
      
      // Check 1: Verify PNG signature (89 50 4E 47 0D 0A 1A 0A) or JPEG signature (FF D8 FF)
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF])
      const isValidPNG = outputBuffer.slice(0, 8).equals(pngSignature)
      const isValidJPEG = outputBuffer.slice(0, 3).equals(jpegSignature)
      
      if (!isValidPNG && !isValidJPEG) {
        console.error(`[${requestId}] OUTPUT_INVALID_FORMAT: Not a valid PNG or JPEG`, {
          first8BytesHex: first8Bytes,
          expectedPNG: "89 50 4E 47 0D 0A 1A 0A",
          expectedJPEG: "FF D8 FF",
        })
        throw new Error("OUTPUT_INVALID_FORMAT: Returned image is not a valid PNG or JPEG")
      }
      
      // Check 2: Reject if file size < 50KB
      if (outputSize < 50 * 1024) {
        console.error(`[${requestId}] OUTPUT_TOO_SMALL: File size ${outputSize} bytes < 50KB`, {
          fileSize: outputSize,
          minSize: 50 * 1024,
        })
        throw new Error(`OUTPUT_TOO_SMALL: Returned image is too small (${outputSize} bytes < 50KB)`)
      }
      
      // Check 3: Compare input hash vs output hash (quick check: first 100KB)
      const inputFirst100KB = imageBuffer.slice(0, Math.min(100 * 1024, imageBuffer.length))
      const outputFirst100KB = outputBuffer.slice(0, Math.min(100 * 1024, outputBuffer.length))
      
      if (inputFirst100KB.length === outputFirst100KB.length && 
          inputFirst100KB.equals(outputFirst100KB)) {
        console.error(`[${requestId}] MODEL_RETURNED_UNCHANGED_IMAGE: First 100KB identical`, {
          inputSize: imageBuffer.length,
          outputSize: outputSize,
          first100KBIdentical: true,
        })
        throw new Error("MODEL_RETURNED_UNCHANGED_IMAGE: First 100KB of output matches input (likely unchanged)")
      }
      
      // Check 4: Full hash comparison
      const outputHash = createHash("sha256").update(outputBuffer).digest("hex")
      if (inputHash === outputHash) {
        console.error(`[${requestId}] MODEL_RETURNED_UNCHANGED_IMAGE: Full hash identical`, {
          inputHash: inputHash.substring(0, 16) + "...",
          outputHash: outputHash.substring(0, 16) + "...",
        })
        throw new Error("MODEL_RETURNED_UNCHANGED_IMAGE: Output hash identical to input (unchanged image)")
      }
      
      console.log(`[${requestId}] OpenAI inpainting successful and validated`, {
        imageUrl: returnedImageUrl.substring(0, 50) + "...",
        outputSize,
        inputHash: inputHash.substring(0, 8) + "...",
        outputHash: outputHash.substring(0, 8) + "...",
        format: isValidPNG ? "PNG" : "JPEG",
      })
      
      return returnedImageUrl
    }

    console.error(`[${requestId}] OpenAI returned invalid response format:`, {
      hasData: !!data.data,
      dataLength: data.data?.length,
      firstItem: data.data?.[0],
    })
    throw new Error("OpenAI returned invalid response format")
  } catch (error: any) {
    // Clean up temp mask file on error
    try {
      await unlink(maskPath).catch(() => {})
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}

/**
 * Generate staged image using Gemini (if supported)
 */
async function generateWithGemini(
  imageUrl: string,
  prompt: string,
  requestId: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set")
  }

  // Gemini image generation is not directly supported in the same way as OpenAI
  // For now, log that Gemini path is not implemented and throw
  console.warn(`[${requestId}] Gemini image generation not yet implemented`)
  throw new Error("Gemini image generation not implemented. Use OpenAI or set FORCE_MOCK_AI=true")
}

export async function POST(request: Request) {
  const requestId = generateRequestId()
  
  try {
    // Get user context
    const userContext = await getUserContext()
    if (!userContext) {
      console.error(`[${requestId}] Unauthorized: No user context`)
      return NextResponse.json(
        {
          success: false,
          errorMessage: "Unauthorized. Please sign in.",
          errorCode: "UNAUTHORIZED",
          retryable: false,
          requestId,
        },
        { status: 200 } // Return 200 to prevent fetch errors
      )
    }

    const { userId } = userContext

    // Parse request body
    let body: any
    try {
      body = await request.json()
    } catch (error) {
      console.error(`[${requestId}] Invalid JSON body:`, error)
      return NextResponse.json(
        {
          success: false,
          errorMessage: "Invalid request body",
          errorCode: "INVALID_BODY",
          retryable: false,
          requestId,
        },
        { status: 200 }
      )
    }

    const { projectId, imageUrl: providedImageUrl, style, prompt, moreFurniture } = body

    // Resolve style to prompt using stylePrompts
    const styleKey = (style || "").toLowerCase()
    const stylePrompt = stylePrompts[styleKey]
    
    // Handle user prompt: filter out "none" and empty strings
    const userPrompt = prompt && prompt !== "none" && prompt.trim() !== "" ? prompt.trim() : ""
    
    // Build final prompts
    const finalPositive = [stylePrompt?.positive, userPrompt].filter(Boolean).join("\n\n")
    const finalNegative = stylePrompt?.negative ?? ""
    
    // Debug logging (dev only)
    if (process.env.NODE_ENV === "development") {
      const promptSource = stylePrompt 
        ? (userPrompt ? "merged" : "style-only")
        : (userPrompt ? "user-only" : "none")
      
      console.log(`[${requestId}] Style prompt resolution`, {
        styleKey,
        styleFound: !!stylePrompt,
        promptSource,
        finalPositiveLength: finalPositive.length,
        finalNegativeLength: finalNegative.length,
        hasUserPrompt: !!userPrompt,
      })
    }

    // Validate required fields
    if (!style || typeof style !== "string" || style.trim() === "") {
      console.error(`[${requestId}] Missing or invalid style`)
      return NextResponse.json(
        {
          success: false,
          errorMessage: "Style is required",
          errorCode: "MISSING_STYLE",
          retryable: false,
          requestId,
        },
        { status: 200 }
      )
    }

    // Get project and image URL
    let project: any = null
    let imageUrl: string | null = null

    // If imageUrl is provided directly, use it (no need to fetch project)
    if (providedImageUrl && providedImageUrl.trim() !== "" && !providedImageUrl.startsWith("blob:")) {
      imageUrl = providedImageUrl
      console.log(`[${requestId}] Using provided imageUrl directly (skipping project fetch)`)
      
      // Still fetch project if projectId exists (for saving designs), but don't require it
      if (projectId) {
        try {
          project = await prisma.roomProject.findUnique({
            where: { id: projectId },
            select: {
              id: true,
              userId: true,
              imageUrl: true,
              aiDesignsJson: true,
            },
          })

          if (project && project.userId !== userId) {
            console.error(`[${requestId}] Unauthorized access to project: ${projectId}`)
            // Don't fail - we have imageUrl, just won't save to project
            project = null
          }
        } catch (error: any) {
          // Don't fail if project fetch fails - we have imageUrl
          console.warn(`[${requestId}] Could not fetch project for saving (non-critical):`, error.message)
          project = null
        }
      }
    } else if (projectId) {
      // No imageUrl provided - must fetch from project
      try {
        project = await prisma.roomProject.findUnique({
          where: { id: projectId },
          select: {
            id: true,
            userId: true,
            imageUrl: true,
            aiDesignsJson: true,
          },
        })

        if (!project) {
          console.error(`[${requestId}] Project not found: ${projectId}`)
          return NextResponse.json(
            {
              success: false,
              errorMessage: "Project not found",
              errorCode: "PROJECT_NOT_FOUND",
              retryable: false,
              requestId,
            },
            { status: 200 }
          )
        }

        if (project.userId !== userId) {
          console.error(`[${requestId}] Unauthorized access to project: ${projectId}`)
          return NextResponse.json(
            {
              success: false,
              errorMessage: "Unauthorized access to project",
              errorCode: "UNAUTHORIZED_PROJECT",
              retryable: false,
              requestId,
            },
            { status: 200 }
          )
        }

        imageUrl = project.imageUrl
      } catch (error: any) {
        console.error(`[${requestId}] Error fetching project:`, error)
        return NextResponse.json(
          {
            success: false,
            errorMessage: "Failed to fetch project",
            errorCode: "PROJECT_FETCH_ERROR",
            retryable: true,
            requestId,
          },
          { status: 200 }
        )
      }
    }

    // Validate image URL
    if (!imageUrl || imageUrl.trim() === "" || imageUrl.startsWith("blob:")) {
      console.error(`[${requestId}] Missing or invalid imageUrl: ${imageUrl}`)
      return NextResponse.json(
        {
          success: false,
          errorMessage: "Room photo is required. Please upload a room photo first.",
          errorCode: "MISSING_IMAGE",
          retryable: false,
          requestId,
        },
        { status: 200 }
      )
    }

    // Log request details
    console.log(`[${requestId}] Starting generation`, {
      userId,
      projectId: projectId || "none",
      style,
      prompt: prompt || "none",
      moreFurniture: moreFurniture || false,
      imageUrl: imageUrl.substring(0, 50) + "...",
    })

    // Check environment variables
    const hasStability = !!process.env.STABILITY_API_KEY
    const hasGemini = !!process.env.GEMINI_API_KEY
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    const forceMock = process.env.FORCE_MOCK_AI === "true"
    
    // Log environment variable status
    console.log(`[AI] env`, {
      hasGemini,
      hasStability,
      hasOpenAI,
      forceMock,
    })
    
    // Determine which provider to use (prioritize Stability + Gemini, fallback to OpenAI)
    let selectedProvider: "stability" | "openai" | "mock" = "mock"
    let plannerUsed: "gemini" | "none" = "none"
    
    if (forceMock) {
      selectedProvider = "mock"
    } else if (hasStability && hasGemini) {
      // Preferred: Gemini planner + Stability renderer
      selectedProvider = "stability"
      plannerUsed = "gemini"
    } else if (hasStability) {
      // Stability without Gemini planner (use simple prompt)
      selectedProvider = "stability"
      plannerUsed = "none"
    } else if (hasOpenAI) {
      // Fallback to OpenAI
      selectedProvider = "openai"
      plannerUsed = "none"
    }

    console.log(`[${requestId}] Provider selection`, {
      hasStabilityKey: hasStability,
      hasGeminiKey: hasGemini,
      hasOpenAIKey: hasOpenAI,
      forceMock,
      selectedProvider,
      plannerUsed,
    })
    
    // Validate required keys before attempting generation
    if (selectedProvider === "stability" && plannerUsed === "gemini") {
      // Both keys required for Gemini + Stability pipeline
      if (!hasGemini) {
        console.error(`[${requestId}] Missing required GEMINI_API_KEY for planner`)
        return NextResponse.json(
          {
            success: false,
            errorMessage: "Missing GEMINI_API_KEY. Please configure the API key in your environment variables.",
            errorCode: "MISSING_GEMINI_KEY",
            retryable: false,
            requestId,
          },
          { status: 500 }
        )
      }
      if (!hasStability) {
        console.error(`[${requestId}] Missing required STABILITY_API_KEY for renderer`)
        return NextResponse.json(
          {
            success: false,
            errorMessage: "Missing STABILITY_API_KEY. Please configure the API key in your environment variables.",
            errorCode: "MISSING_STABILITY_KEY",
            retryable: false,
            requestId,
          },
          { status: 500 }
        )
      }
    } else if (selectedProvider === "stability" && plannerUsed === "none") {
      // Only Stability key required
      if (!hasStability) {
        console.error(`[${requestId}] Missing required STABILITY_API_KEY for renderer`)
        return NextResponse.json(
          {
            success: false,
            errorMessage: "Missing STABILITY_API_KEY. Please configure the API key in your environment variables.",
            errorCode: "MISSING_STABILITY_KEY",
            retryable: false,
            requestId,
          },
          { status: 500 }
        )
      }
    }

    if (selectedProvider === "mock" && !forceMock) {
      console.warn(`[${requestId}] No AI provider configured. Using mock generation.`)
    }

    // Read image from disk for processing
    let imageBuffer: Buffer
    let inputHash: string
    try {
      if (imageUrl.startsWith("/uploads/") || imageUrl.startsWith("/images/")) {
        const imagePath = join(process.cwd(), "public", imageUrl)
        if (!existsSync(imagePath)) {
          throw new Error(`Image file not found: ${imagePath}`)
        }
        imageBuffer = readFileSync(imagePath)
        inputHash = createHash("sha256").update(imageBuffer).digest("hex")
      } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        // Fetch remote image
        const response = await fetch(imageUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch image: HTTP ${response.status}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        imageBuffer = Buffer.from(arrayBuffer)
        inputHash = createHash("sha256").update(imageBuffer).digest("hex")
      } else {
        throw new Error(`Invalid image URL format: ${imageUrl}`)
      }

      console.log(`[${requestId}] Image loaded`, {
        imageSize: imageBuffer.length,
        inputHash: inputHash.substring(0, 16) + "...",
      })
    } catch (error: any) {
      console.error(`[${requestId}] Failed to load image:`, error)
      return NextResponse.json(
        {
          success: false,
          errorMessage: `Failed to load image: ${error.message || "Unknown error"}`,
          errorCode: "IMAGE_LOAD_FAILED",
          retryable: false,
          requestId,
        },
        { status: 200 }
      )
    }

    // Normalize input image (convert to PNG, resize for provider limits)
    let normalizedWidth: number
    let normalizedHeight: number
    try {
      const normalized = await normalizeInputImage(imageBuffer, requestId)
      imageBuffer = normalized.buffer
      normalizedWidth = normalized.width
      normalizedHeight = normalized.height
      // Update hash after normalization
      inputHash = createHash("sha256").update(imageBuffer).digest("hex")
    } catch (error: any) {
      console.error(`[${requestId}] Failed to normalize image:`, error)
      return NextResponse.json(
        {
          success: false,
          errorMessage: `Failed to process image: ${error.message || "Unknown error"}`,
          errorCode: "IMAGE_NORMALIZATION_FAILED",
          retryable: false,
          requestId,
        },
        { status: 200 }
      )
    }

    // Generate image with retry
    let generatedImageBuffer: Buffer | null = null
    let actualProviderUsed: "stability" | "openai" | "mock" = selectedProvider
    let actualPlannerUsed: "gemini" | "none" = plannerUsed
    
    try {
      if (selectedProvider === "stability") {
        // Try Gemini planner + Stability renderer
        try {
          // Validate keys before calling
          if (plannerUsed === "gemini" && !hasGemini) {
            throw new Error("GEMINI_API_KEY not set")
          }
          if (!hasStability) {
            throw new Error("STABILITY_API_KEY not set")
          }
          
          // Build prompts
          let plan: PlannerResult | null = null
          let stabilityPrompt: string
          
          if (plannerUsed === "gemini") {
            console.log(`[${requestId}] Using Gemini planner + Stability renderer`)
            
            // Try Gemini planner with fallback
            try {
              const imageBase64 = imageBuffer.toString("base64")
              plan = await planRoomDesign({
                style,
                prompt: prompt,
                imageBase64,
                moreFurniture: moreFurniture || false,
                requestId,
              })
            } catch (geminiError: any) {
              console.warn(`[${requestId}] Gemini planner failed, using fallback plan:`, geminiError.message)
              plan = createFallbackPlan({
                style,
                prompt: finalPositive,
                moreFurniture: moreFurniture || false,
              })
            }

            const planJsonText = JSON.stringify(plan.planJson, null, 2)
            const stabilityPositive = finalPositive || `Edit this exact room photo. Add furniture per plan. Must visibly change room.`
            stabilityPrompt = `${stabilityPositive}

${CONTINUITY_CONSTRAINTS}

Staging Plan:
${planJsonText}${finalNegative ? `\n\nNegative prompts:\n${finalNegative}` : ""}`
            actualPlannerUsed = "gemini"
          } else {
            console.log(`[${requestId}] Using Stability renderer (no planner)`)
            const stabilityPositive = finalPositive || `Edit this room photo in ${style} style. Add NEW furniture that is clearly visible: a sofa, a coffee table, and a rug. Must visibly change room.`
            stabilityPrompt = `${stabilityPositive}\n\n${CONTINUITY_CONSTRAINTS}${finalNegative ? `\n\nNegative prompts:\n${finalNegative}` : ""}`
          }
          
          // Check if mask inversion is enabled for Stability
          const stabilityMaskInvert = process.env.STABILITY_MASK_INVERT !== "false"
          
          // TWO-PASS GENERATION PIPELINE
          if (ENABLE_TWO_PASS_GENERATION) {
            console.log(`[${requestId}] Starting two-pass generation pipeline`)
            
            // ============ PASS 1: Global Coherence ============
            // Low-strength full-image generation for lighting/material/perspective coherence
            const pass1Prompt = `Enhance this room photo for ${style} style. ${CONTINUITY_CONSTRAINTS}
Improve lighting consistency, surface materials, and atmospheric coherence.
Do not add or remove furniture. Maintain exact camera angle and room structure.
Subtle adjustments only for realistic rendering.${finalNegative ? `\n\nNegative prompts:\n${finalNegative}` : ""}`
            
            console.log(`[${requestId}] PASS 1 START: Global coherence (strength=${PASS1_STRENGTH})`)
            let pass1Buffer: Buffer
            try {
              pass1Buffer = await renderWithStability({
                imageBuffer,
                prompt: pass1Prompt,
                strength: PASS1_STRENGTH,
                // No mask for full-image coherence pass
                requestId: `${requestId}-pass1`,
                mode: "image-to-image",
              })
              console.log(`[${requestId}] PASS 1 END: Success, output size=${pass1Buffer.length} bytes`)
            } catch (pass1Error: any) {
              console.warn(`[${requestId}] PASS 1 FAILED: ${pass1Error.message}, using original image for pass 2`)
              pass1Buffer = imageBuffer // Fallback to original if pass 1 fails
            }
            
            // ============ PASS 2: Furniture Inpainting ============
            // Focused inpainting using feathered mask on coherent base
            const maskForStability = await createInpaintingMask(
              pass1Buffer, // Use pass 1 output as input for mask creation
              requestId,
              stabilityMaskInvert
            )
            
            console.log(`[${requestId}] PASS 2 START: Furniture inpainting (strength=${PASS2_STRENGTH})`)
            generatedImageBuffer = await renderWithStability({
              imageBuffer: pass1Buffer, // Use pass 1 output as input
              prompt: stabilityPrompt,
              strength: PASS2_STRENGTH,
              maskBuffer: maskForStability,
              requestId: `${requestId}-pass2`,
              mode: "inpaint",
            })
            console.log(`[${requestId}] PASS 2 END: Success, output size=${generatedImageBuffer.length} bytes`)
            
          } else {
            // Single-pass mode (legacy behavior)
            console.log(`[${requestId}] Using single-pass generation`)
            const maskForStability = await createInpaintingMask(
              imageBuffer,
              requestId,
              stabilityMaskInvert
            )
            const stabilityStrength = parseFloat(process.env.STABILITY_STRENGTH || "0.8")
            
            generatedImageBuffer = await renderWithStability({
              imageBuffer,
              prompt: stabilityPrompt,
              strength: stabilityStrength,
              maskBuffer: maskForStability,
              requestId,
            })
          }
          
        } catch (stabilityError: any) {
          console.warn(`[${requestId}] Stability AI failed, falling back to OpenAI:`, stabilityError.message)
          // Fallback to OpenAI (use normalized buffer)
          if (hasOpenAI) {
            // Use resolved style prompts for OpenAI with continuity constraints
            const basePrompt = finalPositive || `Add NEW furniture that is clearly visible. At minimum add: a sofa, a coffee table, and a rug. Do not return the original image unchanged.`
            const openaiPrompt = `${basePrompt}\n\n${CONTINUITY_CONSTRAINTS}`
            const result = await generateWithOpenAI(imageBuffer, openaiPrompt, requestId, finalNegative)
            // OpenAI returns a URL, fetch and convert to buffer
            const openaiResponse = await fetch(result)
            if (openaiResponse.ok) {
              generatedImageBuffer = Buffer.from(await openaiResponse.arrayBuffer())
            }
            actualProviderUsed = "openai"
            actualPlannerUsed = "none"
          } else {
            throw stabilityError
          }
        }
      } else if (selectedProvider === "openai") {
        // Use existing OpenAI pipeline (use normalized buffer)
        // Use resolved style prompts for OpenAI with continuity constraints
        const basePrompt = finalPositive || `Add NEW furniture that is clearly visible. At minimum add: a sofa, a coffee table, and a rug. Do not return the original image unchanged.`
        const openaiPrompt = `${basePrompt}\n\n${CONTINUITY_CONSTRAINTS}`
        const result = await generateWithOpenAI(imageBuffer, openaiPrompt, requestId, finalNegative)
        // OpenAI returns a URL, fetch and convert to buffer
        const openaiResponse = await fetch(result)
        if (openaiResponse.ok) {
          generatedImageBuffer = Buffer.from(await openaiResponse.arrayBuffer())
        }
        actualProviderUsed = "openai"
      } else {
        // Mock mode
        generatedImageBuffer = null
        actualProviderUsed = "mock"
      }
    } catch (error: any) {
      console.error(`[${requestId}] Generation failed:`, error)
      return NextResponse.json(
        {
          success: false,
          errorMessage: `Failed to generate image: ${error.message || "Unknown error"}`,
          errorCode: "GENERATION_FAILED",
          retryable: true,
          requestId,
        },
        { status: 200 }
      )
    }

    // Generate filename
    const sanitizedStyle = style.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase()
    const filename = `design-${Date.now()}-${sanitizedStyle}.png`

    // Upload image to Vercel Blob
    let generatedImageUrl: string
    let fallbackUsed = false
    try {
      // Handle Stability AI buffer output
      if (generatedImageBuffer) {
        // Validate output buffer
        if (generatedImageBuffer.length < 200 * 1024) {
          throw new Error(`Output too small: ${generatedImageBuffer.length} bytes < 200KB`)
        }

        // Check PNG signature (89 50 4E 47) or JPEG signature (FF D8 FF)
        const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47])
        const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF])
        const isValidPNG = generatedImageBuffer.slice(0, 4).equals(pngSignature)
        const isValidJPEG = generatedImageBuffer.slice(0, 3).equals(jpegSignature)

        if (!isValidPNG && !isValidJPEG) {
          throw new Error("Output is not a valid PNG or JPEG")
        }

        // Upload to Vercel Blob
        generatedImageUrl = await uploadGeneratedImageToBlob({
          data: generatedImageBuffer,
          filename,
          requestId,
        })

        console.log(`[${requestId}] Uploaded Stability AI output to Blob`, {
          provider: actualProviderUsed,
          planner: actualPlannerUsed,
          fileSize: generatedImageBuffer.length,
          outputHash: createHash("sha256").update(generatedImageBuffer).digest("hex").substring(0, 16) + "...",
          inputHash: inputHash.substring(0, 16) + "...",
          blobUrl: generatedImageUrl,
        })
      } else if (actualProviderUsed === "mock") {
        // Handle mock mode: use a placeholder image
        fallbackUsed = true
        
        // Find a valid placeholder source
        let placeholderBuffer: Buffer | null = null
        
        // 1. Try dedicated placeholder directory
        const dedicatedPlaceholder = join(process.cwd(), "public", "placeholders", "design-placeholder.png")
        if (existsSync(dedicatedPlaceholder)) {
          placeholderBuffer = readFileSync(dedicatedPlaceholder)
        } else {
          // 2. Fallback to existing asset
          const fallbackPath = join(process.cwd(), "public", "images", "skus", "sofas", "sofa_01.png")
          if (existsSync(fallbackPath)) {
            placeholderBuffer = readFileSync(fallbackPath)
          }
        }
        
        if (!placeholderBuffer) {
          throw new Error("No placeholder image found for mock mode")
        }
        
        // Upload placeholder to Vercel Blob
        generatedImageUrl = await uploadGeneratedImageToBlob({
          data: placeholderBuffer,
          filename,
          requestId,
        })
        
        console.log(`[${requestId}] Uploaded placeholder to Blob`, {
          bytes: placeholderBuffer.length,
          blobUrl: generatedImageUrl,
          fallbackUsed: true,
        })
      } else {
        // This should not happen - all cases should be handled above
        throw new Error("No image data to save")
      }
    } catch (error: any) {
      console.error(`[${requestId}] Failed to upload generated image:`, error)
      return NextResponse.json(
        {
          success: false,
          errorMessage: `Failed to upload generated image: ${error.message || "Unknown error"}`,
          errorCode: "UPLOAD_IMAGE_FAILED",
          retryable: false,
          requestId,
        },
        { status: 500 }
      )
    }

    // Save to project if projectId exists (ONLY after file is confirmed)
    let savedDesignId: string | null = null
    if (projectId && project) {
      try {
        const existingDesigns = (project.aiDesignsJson as any[]) || []
        const newDesign = {
          id: `design_${Date.now()}_${randomBytes(4).toString("hex")}`,
          imageUrl: generatedImageUrl,
          style,
          budgetRange: "any",
          createdAt: new Date().toISOString(),
        }
        savedDesignId = newDesign.id

        // Keep only the 12 most recent designs
        const updatedDesigns = [newDesign, ...existingDesigns].slice(0, 12)

        // Update lastAiSettings
        const lastAiSettings = {
          style,
          budgetRange: "any",
          userPrompt: prompt || null,
          updatedAt: new Date().toISOString(),
        }

        await prisma.roomProject.update({
          where: { id: projectId },
          data: {
            aiDesignsJson: updatedDesigns,
            lastAiSettings: lastAiSettings,
          },
        })

        console.log(`[${requestId}] Saved design to project`, {
          projectId,
          designId: savedDesignId,
          imageUrl: generatedImageUrl,
        })
      } catch (error: any) {
        console.error(`[${requestId}] Failed to save design to project:`, error)
        // Don't fail the request if save fails - still return the image
      }
    }

    // Log success
    console.log(`[${requestId}] Generation successful`, {
      provider: actualProviderUsed,
      fallbackUsed,
      imageUrl: generatedImageUrl,
      designId: savedDesignId,
    })

    return NextResponse.json({
      success: true,
      images: [generatedImageUrl],
      imageUrl: generatedImageUrl, // Also include as imageUrl for convenience
      designId: savedDesignId, // Include the saved design ID if available
      providerUsed: actualProviderUsed,
      fallbackUsed,
      requestId,
    })
  } catch (error: any) {
    console.error(`[${requestId}] Unhandled error:`, error)
    return NextResponse.json(
      {
        success: false,
        errorMessage: error.message || "Internal server error",
        errorCode: "INTERNAL_ERROR",
        retryable: true,
        requestId,
      },
      { status: 200 }
    )
  }
}
