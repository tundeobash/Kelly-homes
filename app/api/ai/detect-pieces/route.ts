import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import sharp from "sharp"
import { getUserContext } from "@/lib/auth/getUserContext"
import { prisma } from "@/lib/prisma"
import { generateText } from "@/lib/ai/gemini"
import { buildDetectPrompt, parseDetected, readDetected } from "@/lib/design/pieceEdit"
import type { DetectedPiece } from "@/lib/design/pieceEdit"

export const runtime = "nodejs"
export const maxDuration = 60

const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/i

function isBlobImage(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && BLOB_HOST.test(url.hostname)
  } catch {
    return false
  }
}

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, errorMessage: message }, { status })
}

/**
 * The pieces in one design, for "Change a piece": name, kind, box and where the dot
 * goes. Found once by Gemini, then kept on the design so opening it again is instant.
 */
export async function POST(request: Request) {
  const requestId = `detect_${randomBytes(4).toString("hex")}`
  const user = await getUserContext()
  if (!user) return fail("Please sign in again.", 401)

  let body: any = null
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const projectId = typeof body?.projectId === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(body.projectId) ? body.projectId : null
  const designId = typeof body?.designId === "string" ? body.designId.slice(0, 80) : null
  if (!projectId || !designId) return fail("This design could not be found.")

  const project = await prisma.roomProject.findUnique({
    where: { id: projectId },
    select: { userId: true, aiDesignsJson: true },
  })
  if (!project || project.userId !== user.userId) return fail("This design could not be found.", 404)
  const designs: any[] = Array.isArray(project.aiDesignsJson) ? (project.aiDesignsJson as any[]) : []
  const design = designs.find((d) => d && typeof d === "object" && d.id === designId)
  if (!design || !isBlobImage(design.imageUrl)) return fail("This design could not be found.", 404)

  const cached = readDetected(design.detectedPieces)
  if (cached && cached.length > 0) return NextResponse.json({ success: true, pieces: cached })

  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ success: true, pieces: [] })

  let pieces: DetectedPiece[] = []
  try {
    const response = await fetch(design.imageUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const small = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    const text = await generateText(buildDetectPrompt(), [{ data: small.toString("base64"), mimeType: "image/jpeg" }], requestId)
    pieces = parseDetected(text)
  } catch (error) {
    console.error(`[${requestId}] Finding pieces failed`, {
      error: error instanceof Error ? error.message.slice(0, 200) : String(error),
    })
    return fail("We couldn't find the pieces in this design. Please try again.", 502)
  }

  console.log(`[${requestId}] Pieces found`, { userId: user.userId, designId, count: pieces.length })

  if (pieces.length > 0) {
    try {
      // Read the room again so designs saved meanwhile are kept.
      const fresh = await prisma.roomProject.findUnique({ where: { id: projectId }, select: { aiDesignsJson: true } })
      const current: any[] = Array.isArray(fresh?.aiDesignsJson) ? (fresh!.aiDesignsJson as any[]) : []
      if (current.some((d) => d && d.id === designId)) {
        await prisma.roomProject.update({
          where: { id: projectId },
          data: {
            aiDesignsJson: JSON.parse(
              JSON.stringify(current.map((d) => (d && d.id === designId ? { ...d, detectedPieces: pieces } : d)))
            ),
          },
        })
      }
    } catch (error) {
      // Not saving only means Gemini runs again next time.
      console.warn(`[${requestId}] Could not keep the pieces`, {
        error: error instanceof Error ? error.message.slice(0, 200) : String(error),
      })
    }
  }

  return NextResponse.json({ success: true, pieces })
}
