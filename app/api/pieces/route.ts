import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import sharp from "sharp"
import { getUserContext } from "@/lib/auth/getUserContext"
import { prisma } from "@/lib/prisma"
import { normalizePiecePhoto, PiecePhotoError } from "@/lib/ai/piecePhoto"
import { addPiece, cleanBox, cleanPiece, cleanTapPoint, cleanWidth, cropRect, readPieces } from "@/lib/design/pieces"

export const runtime = "nodejs"
export const maxDuration = 60

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, errorMessage: message }, { status })
}

/**
 * Keeps a piece the person chose: only the part of the photo showing the piece is
 * stored, and the piece is added to the room's list so it can be used again.
 */
export async function POST(request: Request) {
  const user = await getUserContext()
  if (!user) return fail("Please sign in again.", 401)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail("We couldn't read that photo. Please try again.")
  }

  const projectId = form.get("projectId")
  if (typeof projectId !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(projectId)) return fail("This room could not be found.")
  const project = await prisma.roomProject.findUnique({ where: { id: projectId }, select: { userId: true } })
  if (!project || project.userId !== user.userId) return fail("This room could not be found.", 404)

  const tap = cleanTapPoint(form.get("x"), form.get("y"))
  if (!tap) return fail("Tap the piece you mean.")
  const box = cleanBox(form.get("box"))
  const name = typeof form.get("name") === "string" ? String(form.get("name")).trim() : ""
  if (!name) return fail("Give the piece a short name, for example \"round fabric pouf\".")

  let photo: { buffer: Buffer; width: number; height: number }
  try {
    photo = await normalizePiecePhoto(form.get("file"))
  } catch (error) {
    return fail(error instanceof PiecePhotoError ? error.message : "We couldn't read that photo. Please try another one.")
  }

  let imageUrl: string
  try {
    const crop = await sharp(photo.buffer)
      .extract(cropRect(box, tap, photo.width, photo.height))
      .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer()
    const blob = await put(`pieces/${randomBytes(16).toString("hex")}.jpg`, crop, {
      access: "public",
      contentType: "image/jpeg",
    })
    imageUrl = blob.url
  } catch (error) {
    console.error("[pieces] Could not store the piece", {
      error: error instanceof Error ? error.message.slice(0, 200) : String(error),
    })
    return fail("We couldn't save this piece. Please try again.", 500)
  }

  const piece = cleanPiece({
    id: `piece_${Date.now()}_${randomBytes(4).toString("hex")}`,
    name,
    kind: form.get("kind"),
    description: form.get("description"),
    imageUrl,
    widthCm: cleanWidth(form.get("widthCm")),
    createdAt: new Date().toISOString(),
  })
  if (!piece) return fail("We couldn't save this piece. Please try again.", 500)

  // Add it to the room's list, read fresh so nothing saved meanwhile is lost.
  try {
    const fresh = await prisma.roomProject.findUnique({ where: { id: projectId }, select: { lastAiSettings: true } })
    const settings =
      fresh?.lastAiSettings && typeof fresh.lastAiSettings === "object" && !Array.isArray(fresh.lastAiSettings)
        ? (fresh.lastAiSettings as Record<string, unknown>)
        : {}
    await prisma.roomProject.update({
      where: { id: projectId },
      data: { lastAiSettings: { ...settings, pieces: addPiece(readPieces(settings.pieces), piece) } as any },
    })
  } catch (error) {
    // The piece still works for this design; it just won't be listed for next time.
    console.error("[pieces] Could not add the piece to the room", {
      error: error instanceof Error ? error.message.slice(0, 200) : String(error),
    })
  }

  return NextResponse.json({ success: true, piece })
}
