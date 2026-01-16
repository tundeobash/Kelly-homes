import { randomBytes } from "crypto"

/**
 * Render image using Stability AI image-to-image API
 */
export async function renderWithStability(params: {
  imageBuffer: Buffer
  prompt: string
  strength?: number
  maskBuffer?: Buffer
  requestId?: string
}): Promise<Buffer> {
  const { imageBuffer, prompt, strength: providedStrength, maskBuffer, requestId } = params
  
  // Use stronger default for more visible changes (0.8 instead of 0.7)
  // Allow override via env or use provided value
  const defaultStrength = parseFloat(process.env.STABILITY_STRENGTH || "0.8")
  const strength = providedStrength ?? defaultStrength

  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY not set")
  }

  // Stability AI image-to-image endpoint
  const apiUrl = "https://api.stability.ai/v2beta/stable-image/edit/inpaint"

  try {
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

    // Add mask if provided (for inpainting)
    if (maskBuffer) {
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

    // Add mode
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="mode"\r\n\r\n`))
    formDataParts.push(Buffer.from("inpaint"))
    formDataParts.push(Buffer.from(`\r\n`))

    // Add width
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="width"\r\n\r\n`))
    formDataParts.push(Buffer.from("1024"))
    formDataParts.push(Buffer.from(`\r\n`))

    // Add height
    formDataParts.push(Buffer.from(`--${boundary}\r\n`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="height"\r\n\r\n`))
    formDataParts.push(Buffer.from("1024"))
    formDataParts.push(Buffer.from(`\r\n`))

    // Close boundary
    formDataParts.push(Buffer.from(`--${boundary}--\r\n`))

    const formDataBuffer = Buffer.concat(formDataParts)

    // Debug logging
    const acceptHeader = "image/*"
    const outputFormat = "png"
    
    console.log(`[STABILITY] [${requestId || "unknown"}] Request debug`, {
      endpoint: apiUrl,
      acceptHeader,
      outputFormat,
      strength,
      guidanceScale: guidanceScale || "not set",
      hasMask: !!maskBuffer,
      maskSize: maskBuffer?.length || 0,
      boundary: boundary.substring(0, 20) + "...",
      formDataSize: formDataBuffer.length,
    })

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: acceptHeader, // Changed from "image/png" to "image/*" to fix 400 error
        "Content-Type": `multipart/form-data; boundary=${boundary}`, // Required when manually building FormData
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
