import { NextResponse } from "next/server"
import { getUserContext } from "@/lib/auth/getUserContext"
import { finishDesignAttempt, reserveDesignAttempt } from "@/lib/ai/designLimit"
import { attemptCounts } from "@/lib/ai/designLimitPolicy"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { writeFile, mkdir, stat, unlink } from "fs/promises"
import { readFileSync } from "fs"
import { join } from "path"
import { existsSync } from "fs"
import { createHash } from "crypto"
import sharp from "sharp"
import { planRoomDesign, createFallbackPlan, PlannerResult } from "@/lib/ai/geminiPlanner"
import {
  assessRoomOutput,
  buildGenerationPrompts,
  ensureRoomPlan,
  inspectGeneratedRoom,
  resolveRoomType,
} from "@/lib/ai/roomFurnishing"
import { renderWithStability, StabilityGenerationError, sanitizeProviderError } from "@/lib/ai/stabilityRenderer"
import { buildOpenAIEditInstruction, OpenAIGenerationError, renderWithOpenAI } from "@/lib/ai/openaiRenderer"
import { runTwoPassStability } from "@/lib/ai/twoPassGeneration"
import { decideImageProvider, stageLabel } from "@/lib/ai/generationPolicy"
import { InvalidImageError, UnchangedImageError, validateGeneratedImage, sha256 } from "@/lib/ai/generationValidation"
import { getStyleCard, getStylePrompt } from "@/lib/stylePrompts"
import { put } from "@vercel/blob"

// Ensure Node.js runtime for Gemini calls
export const runtime = "nodejs"
// One OpenAI edit takes about 30 s; the check and storage add a few more.
export const maxDuration = 120

/**
 * Only photos stored by this app may be fetched: Vercel Blob uploads or files under /public.
 * Anything else is refused so the server cannot be pointed at other addresses.
 */
function isAllowedImageUrl(url: string): boolean {
  if (url.includes("..")) return false
  if (url.startsWith("/uploads/") || url.startsWith("/images/")) return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".public.blob.vercel-storage.com")
  } catch {
    return false
  }
}

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

export async function POST(request: Request) {
  const requestId = generateRequestId()
  // Daily design limit bookkeeping (lib/ai/designLimit.ts)
  let designAttemptId: string | null = null
  let designReachedProvider = false
  let providerHttpStatus: number | null = null

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

    const { projectId, imageUrl: providedImageUrl, style, prompt, moreFurniture, roomType: requestedRoomType } = body

    // Resolve the style card (every style in the app has one)
    const styleKey = (typeof style === "string" ? style : "").toLowerCase()
    const styleCard = getStyleCard(styleKey)
    const stylePrompt = getStylePrompt(styleKey)

    // Handle user prompt: filter out "none" and empty strings
    const userPrompt =
      typeof prompt === "string" && prompt !== "none" && prompt.trim() !== "" ? prompt.trim().slice(0, 500) : ""
    
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

    if (!styleCard) {
      console.error(`[${requestId}] Unknown style: ${styleKey}`)
      return NextResponse.json(
        {
          success: false,
          errorMessage: "That style isn't available. Please choose another style.",
          errorCode: "UNKNOWN_STYLE",
          retryable: false,
          requestId,
        },
        { status: 200 }
      )
    }

    // Get project and image URL
    let project: any = null
    let imageUrl: string | null = null

    if (typeof providedImageUrl === "string" && providedImageUrl.trim() !== "" && !isAllowedImageUrl(providedImageUrl)) {
      console.warn(`[${requestId}] Ignoring an image address that is not an app upload`)
    }

    // If an app-stored imageUrl is provided directly, use it (no need to fetch project)
    if (
      typeof providedImageUrl === "string" &&
      providedImageUrl.trim() !== "" &&
      !providedImageUrl.startsWith("blob:") &&
      isAllowedImageUrl(providedImageUrl)
    ) {
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
              roomType: true,
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
            roomType: true,
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

    const resolvedRoomType = resolveRoomType({
      requested: typeof requestedRoomType === "string" ? requestedRoomType : "",
      saved: project?.roomType,
    })

    console.log(`[${requestId}] Room type received`, {
      fromRequest: typeof requestedRoomType === "string" && requestedRoomType.trim()
        ? requestedRoomType.trim()
        : null,
      fromProject: project?.roomType || null,
      resolved: resolvedRoomType || "unspecified",
    })

    // Log request details
    console.log(`[${requestId}] Starting generation`, {
      userId,
      projectId: projectId || "none",
      style,
      roomType: resolvedRoomType || "unspecified",
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
    
    const providerDecision = decideImageProvider({
      forceMock,
      hasStability,
      hasGemini,
      hasOpenAI,
      preferred: process.env.IMAGE_PROVIDER,
    })

    console.log(`[${requestId}] Provider selection`, {
      hasStabilityKey: hasStability,
      hasGeminiKey: hasGemini,
      hasOpenAIKey: hasOpenAI,
      forceMock,
      provider: providerDecision.ok ? providerDecision.provider : "none",
      planner: providerDecision.ok ? providerDecision.planner : "none",
    })

    if (!providerDecision.ok) {
      console.error(`[${requestId}] Generation rejected`, {
        provider: "none",
        stage: providerDecision.stage,
        status: null,
        error: providerDecision.errorMessage,
      })
      return NextResponse.json({
        success: false,
        errorMessage: providerDecision.errorMessage,
        errorCode: providerDecision.errorCode,
        retryable: false,
        requestId,
        stage: providerDecision.stage,
      })
    }

    const selectedProvider = providerDecision.provider
    const plannerUsed = providerDecision.planner

    // Daily design limit: record this attempt before any paid work starts.
    const allowance = await reserveDesignAttempt({ userId, provider: selectedProvider, requestId })
    if (!allowance.allowed) {
      return NextResponse.json(
        {
          success: false,
          errorMessage: allowance.message,
          errorCode: allowance.errorCode,
          retryable: allowance.errorCode === "LIMIT_CHECK_FAILED",
          requestId,
          limit: allowance.limit,
          retryAt: "retryAt" in allowance ? allowance.retryAt : null,
        },
        { status: 200 }
      )
    }
    designAttemptId = allowance.attemptId

    // Read image from disk for processing
    let imageBuffer: Buffer
    let inputHash: string
    try {
      if (imageUrl.includes("..")) {
        throw new Error("Invalid image path")
      }
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
    let actualProviderUsed: "stability" | "openai" = selectedProvider
    let actualPlannerUsed: "gemini" | "none" = plannerUsed
    let actualModel: string = selectedProvider === "openai" ? "openai" : "stability-two-pass"
    let estimatedCostUsd: number | null = null

    // From here on the image service may charge, so this attempt counts toward the daily limit.
    designReachedProvider = true
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
          
          // Build a room-specific furnishing plan, then the two generation prompts.
          let plan: PlannerResult | null = null
          let fallbackPlanning = plannerUsed !== "gemini"
          let fallbackReason = plannerUsed === "gemini" ? "" : "Gemini planner was not used"
          
          if (plannerUsed === "gemini") {
            console.log(`[${requestId}] Using Gemini planner + Stability renderer`)
            
            try {
              const imageBase64 = imageBuffer.toString("base64")
              plan = await planRoomDesign({
                style,
                roomType: resolvedRoomType,
                prompt: prompt,
                imageBase64,
                moreFurniture: moreFurniture || false,
                requestId,
              })
              const ensured = ensureRoomPlan(plan, {
                roomType: resolvedRoomType,
                style,
                moreFurniture: moreFurniture || false,
              })
              plan = ensured.plan
              fallbackPlanning = ensured.fallbackUsed
              fallbackReason = ensured.reason
              actualPlannerUsed = ensured.fallbackUsed ? "none" : "gemini"
            } catch (geminiError: any) {
              console.warn(`[${requestId}] Gemini planner failed, using room-specific fallback plan:`, geminiError.message)
              plan = createFallbackPlan({
                style,
                roomType: resolvedRoomType,
                moreFurniture: moreFurniture || false,
              })
              fallbackPlanning = true
              fallbackReason = "Gemini planner failed"
              actualPlannerUsed = "none"
            }
          } else {
            console.log(`[${requestId}] Using Stability renderer with a room-specific fallback plan`)
            plan = createFallbackPlan({
              style,
              roomType: resolvedRoomType,
              moreFurniture: moreFurniture || false,
            })
          }

          console.log(`[${requestId}] Fallback planning`, {
            used: fallbackPlanning,
            reason: fallbackReason,
            planRoomType: plan.planJson.roomType,
            plannedItems: plan.planJson.addItems.map((item) => item.item),
          })

          const generationPrompts = buildGenerationPrompts({
            roomType: resolvedRoomType,
            style,
            planText: JSON.stringify(plan.planJson),
            stylePositive: finalPositive,
            userPrompt,
            negative: finalNegative,
            continuity: CONTINUITY_CONSTRAINTS,
          })
          console.log(`[${requestId}] Generation prompt summary`, {
            roomType: resolvedRoomType || "unspecified",
            summary: generationPrompts.summary,
          })
          const stabilityPrompt = generationPrompts.pass2
          
          // Check if mask inversion is enabled for Stability
          const stabilityMaskInvert = process.env.STABILITY_MASK_INVERT !== "false"
          
          // TWO-PASS GENERATION PIPELINE
          // Pass 2 does not send PASS2_STRENGTH. The inpaint endpoint has no strength field;
          // the mask decides which pixels may change.
          if (ENABLE_TWO_PASS_GENERATION) {
            console.log(`[${requestId}] Starting two-pass generation pipeline`, {
              pass1Strength: PASS1_STRENGTH,
              pass2StrengthNotSent: PASS2_STRENGTH,
            })

            generatedImageBuffer = await runTwoPassStability({
              imageBuffer,
              pass1Prompt: generationPrompts.pass1,
              pass2Prompt: stabilityPrompt,
              pass1Strength: PASS1_STRENGTH,
              requestId,
              createMask: (source) =>
                createInpaintingMask(source, requestId, stabilityMaskInvert),
            })
            console.log(`[${requestId}] Two-pass generation finished`, {
              outputSize: generatedImageBuffer.length,
            })
          } else {
            // Single-pass mode (legacy behavior)
            console.log(`[${requestId}] Using single-pass generation`)
            const maskForStability = await createInpaintingMask(
              imageBuffer,
              requestId,
              stabilityMaskInvert
            )

            generatedImageBuffer = await renderWithStability({
              imageBuffer,
              prompt: stabilityPrompt,
              maskBuffer: maskForStability,
              requestId,
              mode: "inpaint",
              stage: "inpaint",
            })
          }
          
        } catch (stabilityError: unknown) {
          const stage = stabilityError instanceof StabilityGenerationError
            ? stabilityError.stage
            : "stability"
          const status = stabilityError instanceof StabilityGenerationError
            ? stabilityError.status ?? null
            : null
          const message = stabilityError instanceof Error
            ? stabilityError.message
            : "Unknown error"
          console.error(`[${requestId}] Stability generation failed`, {
            provider: "stability",
            stage,
            status,
            error: sanitizeProviderError(message),
          })
          throw stabilityError
        }
      } else if (selectedProvider === "openai") {
        // Default path: one OpenAI image edit, guided by the style card.
        const instruction = buildOpenAIEditInstruction({
          roomType: resolvedRoomType,
          style: styleCard,
          userPrompt,
          moreFurniture: moreFurniture === true,
        })
        console.log(`[${requestId}] OpenAI redesign`, {
          roomType: resolvedRoomType || "unspecified",
          style: styleCard.id,
          instructionLength: instruction.length,
        })
        const rendered = await renderWithOpenAI({
          imageBuffer,
          mimeType: "image/png",
          prompt: instruction,
          requestId,
        })
        generatedImageBuffer = rendered.buffer
        actualProviderUsed = "openai"
        actualPlannerUsed = "none"
        actualModel = rendered.model
        estimatedCostUsd = rendered.costUsd
      }
    } catch (error: unknown) {
      const providerError =
        error instanceof StabilityGenerationError || error instanceof OpenAIGenerationError ? error : null
      const stage = providerError ? providerError.stage : "generation"
      const status = providerError ? providerError.status ?? null : null
      providerHttpStatus = status
      const message = error instanceof Error ? error.message : "Unknown error"
      const safeMessage = sanitizeProviderError(message)
      console.error(`[${requestId}] Generation failed`, {
        provider: providerError ? providerError.provider : actualProviderUsed,
        stage,
        status,
        error: safeMessage,
      })
      return NextResponse.json(
        {
          success: false,
          errorMessage: `Image generation failed during ${stageLabel(stage)}. ${safeMessage}`,
          errorCode: error instanceof UnchangedImageError
            ? "UNCHANGED_IMAGE"
            : providerError && /identical to the input/i.test(providerError.message)
              ? "UNCHANGED_IMAGE"
              : "GENERATION_FAILED",
          retryable: true,
          requestId,
          stage,
        },
        { status: 200 }
      )
    }

    // Generate filename
    const sanitizedStyle = style.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase()
    const filename = `design-${Date.now()}-${sanitizedStyle}.png`

    if (!generatedImageBuffer) {
      console.error(`[${requestId}] Generation produced no image`, {
        provider: actualProviderUsed,
        stage: "validation",
        status: null,
        error: "The image service did not return a design.",
      })
      return NextResponse.json({
        success: false,
        errorMessage: "The image service did not return a design. Nothing was saved.",
        errorCode: "NO_IMAGE",
        retryable: true,
        requestId,
        stage: "validation",
      })
    }

    try {
      validateGeneratedImage(generatedImageBuffer, [imageBuffer], { minBytes: 200 * 1024 })
    } catch (validationError: unknown) {
      const message = validationError instanceof Error
        ? validationError.message
        : "Generated image could not be used."
      const errorCode = validationError instanceof UnchangedImageError
        ? "UNCHANGED_IMAGE"
        : validationError instanceof InvalidImageError
          ? "INVALID_IMAGE"
          : "INVALID_IMAGE"
      console.error(`[${requestId}] Generation output rejected`, {
        provider: actualProviderUsed,
        stage: "validation",
        status: null,
        error: sanitizeProviderError(message),
      })
      return NextResponse.json({
        success: false,
        errorMessage: message,
        errorCode,
        retryable: true,
        requestId,
        stage: "validation",
      })
    }

    // The furnishing check uses Gemini (text only). Without a Gemini key it is skipped
    // and logged, rather than throwing away a good redesign.
    if (!hasGemini) {
      console.warn(`[${requestId}] Output validation skipped`, {
        roomType: resolvedRoomType || "unspecified",
        reason: "GEMINI_API_KEY is not set, so the furnishing check did not run.",
      })
    } else {
      try {
        const mimeType = generatedImageBuffer[0] === 0xff ? "image/jpeg" : "image/png"
        const inspection = await inspectGeneratedRoom({
          imageBase64: generatedImageBuffer.toString("base64"),
          mimeType,
          roomType: resolvedRoomType,
          requestId,
        })
        const furnishing = assessRoomOutput(inspection, resolvedRoomType)
        console.log(`[${requestId}] Output validation`, {
          roomType: resolvedRoomType || "unspecified",
          passed: furnishing.passed,
          reason: furnishing.reason,
          looksLike: inspection.looksLike || null,
          furnitureCount: inspection.furniture.length,
        })
        if (!furnishing.passed) {
          return NextResponse.json({
            success: false,
            errorMessage: furnishing.reason,
            errorCode: furnishing.reason.toLowerCase().includes("empty") ? "EMPTY_ROOM" : "WRONG_ROOM_TYPE",
            retryable: true,
            requestId,
            stage: "furnishing-check",
          })
        }
      } catch (inspectionError: unknown) {
        const message = inspectionError instanceof Error
          ? inspectionError.message
          : "The furnishing check failed."
        console.error(`[${requestId}] Output validation`, {
          roomType: resolvedRoomType || "unspecified",
          passed: false,
          reason: sanitizeProviderError(message),
        })
        return NextResponse.json({
          success: false,
          errorMessage: "The redesign could not be checked for furniture, so it was not saved. Please try again.",
          errorCode: "FURNISHING_CHECK_FAILED",
          retryable: true,
          requestId,
          stage: "furnishing-check",
        })
      }
    }

    // Upload image to Vercel Blob only after the result is a real, changed, furnished image.
    let generatedImageUrl: string
    const fallbackUsed = false
    try {
      generatedImageUrl = await uploadGeneratedImageToBlob({
        data: generatedImageBuffer,
        filename,
        requestId,
      })

      console.log(`[${requestId}] Uploaded generated image to Blob`, {
        provider: actualProviderUsed,
        planner: actualPlannerUsed,
        fileSize: generatedImageBuffer.length,
        outputHash: sha256(generatedImageBuffer).substring(0, 16) + "...",
        inputHash: inputHash.substring(0, 16) + "...",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      const safeMessage = sanitizeProviderError(message)
      console.error(`[${requestId}] Failed to store generated image`, {
        provider: actualProviderUsed,
        stage: "upload",
        status: null,
        error: safeMessage,
      })
      return NextResponse.json(
        {
          success: false,
          errorMessage: `The redesign was created but could not be stored. ${safeMessage}`,
          errorCode: "UPLOAD_IMAGE_FAILED",
          retryable: false,
          requestId,
          stage: "upload",
        }
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
          provider: actualProviderUsed,
          model: actualModel,
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
        })
      } catch (error: any) {
        console.error(`[${requestId}] Failed to save design to project:`, error)
        // Don't fail the request if save fails - still return the image
      }
    }

    // Log success
    console.log(`[${requestId}] Generation successful`, {
      provider: actualProviderUsed,
      model: actualModel,
      estimatedCostUsd: estimatedCostUsd === null ? "unknown" : Number(estimatedCostUsd.toFixed(4)),
      fallbackUsed,
      designId: savedDesignId,
    })

    return NextResponse.json({
      success: true,
      images: [generatedImageUrl],
      imageUrl: generatedImageUrl, // Also include as imageUrl for convenience
      designId: savedDesignId, // Include the saved design ID if available
      providerUsed: actualProviderUsed,
      model: actualModel,
      fallbackUsed,
      requestId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const safeMessage = sanitizeProviderError(message)
    console.error(`[${requestId}] Unhandled error`, {
      provider: "unknown",
      stage: "request",
      status: null,
      error: safeMessage,
    })
    return NextResponse.json(
      {
        success: false,
        errorMessage: safeMessage,
        errorCode: "INTERNAL_ERROR",
        retryable: true,
        requestId,
        stage: "request",
      }
    )
  } finally {
    if (designAttemptId) {
      const counts = attemptCounts({ reachedProvider: designReachedProvider, providerHttpStatus })
      await finishDesignAttempt(designAttemptId, counts ? "completed" : "failed", requestId)
    }
  }
}
