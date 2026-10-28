import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { getUserContext } from "@/lib/auth/getUserContext"
import { generateText } from "@/lib/ai/gemini"
import { normalizePiecePhoto, PiecePhotoError } from "@/lib/ai/piecePhoto"
import { buildIdentifyPrompt, cleanTapPoint, parseIdentify } from "@/lib/design/pieces"

export const runtime = "nodejs"
export const maxDuration = 60

const NOT_FOUND = { name: "", kind: "", description: "", box: null }

/**
 * Finds the piece the person tapped in a photo: its name, a one-line description
 * and its box. Nothing is stored; the photo is only read.
 */
export async function POST(request: Request) {
  const requestId = `piece_${randomBytes(4).toString("hex")}`
  const user = await getUserContext()
  if (!user) {
    return NextResponse.json({ success: false, errorMessage: "Please sign in again." }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ success: false, errorMessage: "We couldn't read that photo. Please try again." }, { status: 400 })
  }

  const tap = cleanTapPoint(form.get("x"), form.get("y"))
  if (!tap) {
    return NextResponse.json({ success: false, errorMessage: "Tap the piece you mean." }, { status: 400 })
  }

  let photo: { buffer: Buffer }
  try {
    photo = await normalizePiecePhoto(form.get("file"))
  } catch (error) {
    const message = error instanceof PiecePhotoError ? error.message : "We couldn't read that photo. Please try another one."
    return NextResponse.json({ success: false, errorMessage: message }, { status: 400 })
  }

  // Without Gemini the person names the piece themselves.
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ success: true, piece: NOT_FOUND })
  }

  try {
    const text = await generateText(
      buildIdentifyPrompt(tap),
      [{ data: photo.buffer.toString("base64"), mimeType: "image/jpeg" }],
      requestId
    )
    const found = parseIdentify(text)
    console.log(`[${requestId}] Piece identified`, { userId: user.userId, found: Boolean(found), name: found?.name || null })
    return NextResponse.json({ success: true, piece: found ?? NOT_FOUND })
  } catch (error) {
    console.error(`[${requestId}] Piece identify failed`, {
      error: error instanceof Error ? error.message.slice(0, 200) : String(error),
    })
    return NextResponse.json({ success: true, piece: NOT_FOUND })
  }
}
