import { randomBytes } from "crypto"
import sharp from "sharp"

/**
 * Render image using Stability AI image-to-image API
 * Supports both inpainting (with mask) and image-to-image (without mask) modes
 */
export async function renderWithStability(params: {
  imageBuffer: Buffer
  prompt: string
  strength?: number
  maskBuffer?: Buffer
  requestId?: string
  mode?: "inpaint" | "image-to-image"
}): Promise<Buffer> {
  const { imageBuffer, prompt, strength: providedStrength, maskBuffer, requestId, mode: providedMode } = params
  
  // Use stronger default for more visible changes (0.8 instead of 0.7)
  // Allow override via env or use provided value
  const defaultStrength = parseFloat(process.env.STABILITY_STRENGTH || "0.8")
  const strength = providedStrength ?? defaultStrength
  
  // Determine mode: use provided mode, or infer from mask presence
  const mode = providedMode ?? (maskBuffer ? "inpaint" : "image-to-image")

  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY not set")
  }

  // Select endpoint based on mode
  const apiUrl = mode === "inpaint"
    ? "https://api.stability.ai/v2beta/stable-image/edit/inpaint"
    : "https://api.stability.ai/v2beta/stable-image/generate/sd3"

  try {
    // Get image dimensions for output sizing
    const imageMetadata = await sharp(imageBuffer).metadata()
    const imgWidth = imageMetadata.width || 1024
    const imgHeight = imageMetadata.height || 1024
    
    // Build multipart/form-data manually (Node.js compatible)
    const boundary = `----WebKitFormBoundary${randomBytes(16).toString("hex")}`
    const formDataParts: Buffer[] = []

    // Add image
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="image"; filename="room.png"\r\n`))
    formDataParts.push(Buffer.from(`Content-Type: image/png\r\n\r\n`))
    formDataParts.push(imageBuffer)
    formDataParts.push(Buffer.from(`\r\n`))

    // Add prompt
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="prompt"\r\n\r\n`))
    formDataParts.push(Buffer.from(prompt))
    formDataParts.push(Buffer.from(`\r\n`))

    // Add strength
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="strength"\r\n\r\n`))
    formDataParts.push(Buffer.from(strength.toString()))
    formDataParts.push(Buffer.from(`\r\n`))

    // Add guidance scale if supported (default 7.5, higher = more adherence to prompt)
    const guidanceScale = parseFloat(process.env.STABILITY_GUIDANCE_SCALE || "7.5")
    if (guidanceScale > 0) {
      formDataParts.push(Buffer.from(`--${boundary}\r\n`))
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="guidance_scale"\r\n\r\n`))
      formDataParts.push(Buffer.from(guidanceScale.toString()))
      formDataParts.push(Buffer.from(`\r\n`))
    }

    // Add mask if provided and in inpaint mode
    if (maskBuffer && mode === "inpaint") {
      formDataParts.push(Buffer.from(`--${boundary}\r\n`))
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="mask"; filename="mask.png"\r\n`))
      formDataParts.push(Buffer.from(`Content-Type: image/png\r\n\r\n`))
      formDataParts.push(maskBuffer)
      formDataParts.push(Buffer.from(`\r\n`))
    }

    // Add output format
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="output_format"\r\n\r\n`))
    formDataParts.push(Buffer.from("png"))
    formDataParts.push(Buffer.from(`\r\n`))

    // Add mode for inpaint endpoint
    if (mode === "inpaint") {
      formDataParts.push(Buffer.from(`--${boundary}\r\n`))
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="mode"\r\n\r\n`))
      formDataParts.push(Buffer.from("image-to-image"))
      formDataParts.push(Buffer.from(`\r\n`))
    }

    // Add aspect ratio for SD3 endpoint (preserve input aspect ratio)
    if (mode === "image-to-image") {
      // Calculate aspect ratio string (SD3 supports specific ratios)
      const aspectRatio = imgWidth / imgHeight
      let aspectStr = "1:1"
      if (aspectRatio > 1.7) aspectStr = "16:9"
      else if (aspectRatio > 1.4) aspectStr = "3:2"
      else if (aspectRatio > 1.2) aspectStr = "4:3"
      else if (aspectRatio > 0.9) aspectStr = "1:1"
      else if (aspectRatio > 0.7) aspectStr = "3:4"
      else if (aspectRatio > 0.55) aspectStr = "2:3"
      else aspectStr = "9:16"
      
      formDataParts.push(Buffer.from(`--${boundary}\r\n`))
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="aspect_ratio"\r\n\r\n`))
      formDataParts.push(Buffer.from(aspectStr))
      formDataParts.push(Buffer.from(`\r\n`))
    }

    // Close boundary
    formDataParts.push(Buffer.from(`--${boundary}--\r\n`))

    const formDataBuffer = Buffer.concat(formDataParts)

    // Debug logging
    const acceptHeader = "image/*"
    const outputFormat = "png"
    
    console.log(`[STABILITY] [${requestId || "unknown"}] Request debug`, {
      endpoint: apiUrl,
      mode,
      acceptHeader,
      outputFormat,
      strength,
      guidanceScale: guidanceScale || "not set",
      hasMask: !!maskBuffer,
      maskSize: maskBuffer?.length || 0,
      inputDimensions: `${imgWidth}x${imgHeight}`,
      boundary: boundary.substring(0, 20) + "...",
      formDataSize: formDataBuffer.length,
    })

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: acceptHeader,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: formDataBuffer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Stability AI API error: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage += ` - ${errorJson.message || errorJson.error || errorText}`
      } catch {
        errorMessage += ` - ${errorText.substring(0, 200)}`
      }
      throw new Error(errorMessage)
    }

    // Stability AI returns the image directly as binary
    const arrayBuffer = await response.arrayBuffer()
    const outputBuffer = Buffer.from(arrayBuffer)

    // Validate output size
    if (outputBuffer.length < 10 * 1024) {
      throw new Error(`Stability AI returned image too small: ${outputBuffer.length} bytes`)
    }

    return outputBuffer
  } catch (error: any) {
    if (error.message.includes("STABILITY_API_KEY")) {
      throw error
    }
    throw new Error(`Stability AI rendering failed: ${error.message}`)
  }
}
