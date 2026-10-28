/**
 * "Pieces you love": a photo of one piece (in a shop, at a friend's home, a screenshot)
 * put into a design (item 4 of the 28 Oct 2026 build list). Shared by the design
 * screen and the server routes, so it stays free of React and server code.
 *
 * Two modes:
 * - "around": a new design in the chosen style, built around the piece (from Must include).
 * - "place": the piece added to a design the person already has (from the result screen).
 */

export interface StudioPiece {
  id: string
  /** Short name a shopper would use, e.g. "round fabric pouf". */
  name: string
  /** One word or two for the type, e.g. "pouf". */
  kind: string
  /** One sentence on shape, colour, material and details. */
  description: string
  /** The cropped photo of the piece (Vercel Blob). */
  imageUrl: string
  /** Rough width the person gave, in cm. */
  widthCm: number | null
  createdAt?: string
}

export type PieceMode = "around" | "place"

/** Pieces kept per room, newest first. */
export const PIECE_LIBRARY_LIMIT = 12

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

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return ""
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
}

export function cleanWidth(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.trim()) : value
  if (typeof n !== "number" || !Number.isFinite(n)) return null
  const rounded = Math.round(n)
  return rounded >= 10 && rounded <= 600 ? rounded : null
}

/** A piece from a request or from storage, or null if it is not one of ours. */
export function cleanPiece(value: unknown): StudioPiece | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const id = typeof v.id === "string" && /^piece_[A-Za-z0-9_]{4,60}$/.test(v.id) ? v.id : ""
  if (!id || !isBlobImage(v.imageUrl)) return null
  const name = cleanText(v.name, 60) || "piece"
  return {
    id,
    name,
    kind: cleanText(v.kind, 30) || name,
    description: cleanText(v.description, 300),
    imageUrl: v.imageUrl,
    widthCm: cleanWidth(v.widthCm),
    createdAt: typeof v.createdAt === "string" ? v.createdAt : undefined,
  }
}

export function cleanPieceMode(value: unknown): PieceMode | null {
  return value === "around" || value === "place" ? value : null
}

/** Stored pieces, cleaned, once each. */
export function readPieces(value: unknown): StudioPiece[] {
  if (!Array.isArray(value)) return []
  const out: StudioPiece[] = []
  for (const item of value) {
    const piece = cleanPiece(item)
    if (piece && !out.some((p) => p.id === piece.id)) out.push(piece)
  }
  return out
}

/** Adds or updates a piece at the front of the room's list. */
export function addPiece(library: StudioPiece[], piece: StudioPiece, limit = PIECE_LIBRARY_LIMIT): StudioPiece[] {
  return [piece, ...library.filter((p) => p.id !== piece.id)].slice(0, limit)
}

/** The room's pieces: its list, plus any piece a design used that the list no longer has. */
export function piecesForRoom(lastAiSettings: unknown, designs: unknown[]): StudioPiece[] {
  const settings = lastAiSettings && typeof lastAiSettings === "object" ? (lastAiSettings as Record<string, unknown>) : {}
  let out = readPieces(settings.pieces)
  for (const design of designs) {
    const piece = design && typeof design === "object" ? cleanPiece((design as Record<string, unknown>).piece) : null
    if (piece && !out.some((p) => p.id === piece.id)) out = [...out, piece]
  }
  return out.slice(0, PIECE_LIBRARY_LIMIT)
}

/** "Round fabric pouf" */
export function pieceLabel(piece: Pick<StudioPiece, "name">): string {
  const name = piece.name.trim() || "piece"
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function sizeLine(piece: StudioPiece): string {
  return piece.widthCm
    ? `It is about ${piece.widthCm} cm wide: give it that real size, in proportion to the room and the furniture around it.`
    : `Give it a realistic size for a real ${piece.kind}, in proportion to the room and the furniture around it.`
}

function copyLines(piece: StudioPiece): string[] {
  return [
    "Copy the piece faithfully: the same shape, proportions, colour, fabric or leather texture, stitching, legs and details. Do not redesign it or swap it for a similar piece.",
    "Ignore everything else in the second image (the floor, walls, loose cushions, throws and other objects around the piece).",
    sizeLine(piece),
  ]
}

function describe(piece: StudioPiece): string {
  return piece.description ? `${piece.name} (${piece.description.replace(/\.$/, "")})` : piece.name
}

/** Lines added to a new design built around the piece ("around" mode). */
export function aroundPieceLines(piece: StudioPiece): string {
  return [
    `The second image is a photo of one piece the customer loves: ${describe(piece)}.`,
    "Include that exact piece in the room, where it naturally belongs, and build the rest of the design around it.",
    ...copyLines(piece),
    "Keep the piece exactly as it is, even where it differs from the style.",
  ].join(" ")
}

/** The whole instruction for putting the piece into an existing design ("place" mode). */
export function placePieceInstruction(piece: StudioPiece): string {
  return [
    `The first image is a furnished room. The second image is a photo of one piece: ${describe(piece)}.`,
    `Put that exact piece into the room in the first image, where a ${piece.kind} naturally belongs, in a free spot. If there is no free spot, replace only the one piece of the same kind; never remove anything else.`,
    ...copyLines(piece),
    "Change nothing else in the first image: keep the same walls, windows, doors, floor, ceiling, camera position and lighting, and keep every other piece of furniture, the TV, rugs, curtains, lights and decor exactly as they are, the same size and in the same place.",
    "Keep doorways and walkways clear. Match the room's lighting and add natural shadows. Photorealistic interior photograph. No text, logos or watermarks.",
  ].join("\n")
}

/** The name the furnishing check is asked about. */
export function pieceCheckName(piece: StudioPiece): string {
  const name = (piece.name.trim() || piece.kind.trim() || "piece").toLowerCase()
  return name.replace(/["\\]/g, "")
}

/** Whether the piece is in the design: the check's direct answer, else its kind in the furniture list. */
export function pieceIncluded(
  inspection: { furniture: string[]; mustHave?: Record<string, boolean> },
  piece: StudioPiece
): boolean {
  const answer = inspection.mustHave?.[pieceCheckName(piece)]
  if (typeof answer === "boolean") return answer
  const kind = piece.kind.trim().toLowerCase()
  return Boolean(kind) && inspection.furniture.some((item) => item.toLowerCase().includes(kind))
}

// ---- Finding the piece in a photo -------------------------------------------------

/** A box as fractions of the photo (0 to 1 from the top-left corner). */
export interface PieceBox {
  top: number
  left: number
  bottom: number
  right: number
}

export interface IdentifiedPiece {
  name: string
  kind: string
  description: string
  box: PieceBox | null
}

export function cleanTapPoint(x: unknown, y: unknown): { x: number; y: number } | null {
  const nx = typeof x === "string" ? Number(x) : x
  const ny = typeof y === "string" ? Number(y) : y
  if (typeof nx !== "number" || typeof ny !== "number" || !Number.isFinite(nx) || !Number.isFinite(ny)) return null
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null
  return { x: nx, y: ny }
}

export function buildIdentifyPrompt(tap: { x: number; y: number }): string {
  const x = Math.round(tap.x * 1000)
  const y = Math.round(tap.y * 1000)
  return `The person tapped this photo at x = ${x}, y = ${y} on a 0 to 1000 scale from the top-left corner.
Find the single piece of furniture or decor they tapped (if the point is between pieces, the nearest one) and answer with JSON only:
{
  "name": "a short name a shopper would use, 2 to 4 words, such as round fabric pouf",
  "kind": "one or two words for the type of piece, such as pouf or sofa",
  "description": "one sentence on its shape, colour, material and details such as stitching, legs or pattern",
  "box_2d": [ymin, xmin, ymax, xmax]
}
box_2d is the piece's bounding box on a 0 to 1000 scale. Describe only that piece, not the room or anything else in the photo.`
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export function parseIdentify(text: string): IdentifiedPiece | null {
  let json = text.trim()
  json = json.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const name = cleanText(parsed.name, 60).toLowerCase()
  const kind = cleanText(parsed.kind, 30).toLowerCase()
  const description = cleanText(parsed.description, 300)
  let box: PieceBox | null = null
  const raw = parsed.box_2d
  if (Array.isArray(raw) && raw.length === 4 && raw.every((n) => typeof n === "number" && Number.isFinite(n))) {
    const [ymin, xmin, ymax, xmax] = (raw as number[]).map((n) => clamp01(n / 1000))
    if (ymax - ymin > 0.02 && xmax - xmin > 0.02) box = { top: ymin, left: xmin, bottom: ymax, right: xmax }
  }
  if (!name && !box) return null
  return { name, kind: kind || name, description, box }
}

/**
 * The part of the photo to keep, in pixels: the piece's box with a margin, or,
 * when there is no box, a square around the tap.
 */
export function cropRect(
  box: PieceBox | null,
  tap: { x: number; y: number },
  width: number,
  height: number,
  margin = 0.06
): { left: number; top: number; width: number; height: number } {
  let l: number, t: number, r: number, b: number
  if (box) {
    l = box.left - margin
    t = box.top - margin
    r = box.right + margin
    b = box.bottom + margin
  } else {
    const half = (0.45 * Math.min(width, height)) / 2
    l = tap.x - half / width
    r = tap.x + half / width
    t = tap.y - half / height
    b = tap.y + half / height
  }
  const left = Math.round(clamp01(l) * width)
  const top = Math.round(clamp01(t) * height)
  const right = Math.round(clamp01(r) * width)
  const bottom = Math.round(clamp01(b) * height)
  return {
    left: Math.min(left, width - 1),
    top: Math.min(top, height - 1),
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

/** A box sent back by the browser (fractions), or null. */
export function cleanBox(value: unknown): PieceBox | null {
  let v: unknown = value
  if (typeof v === "string") {
    try {
      v = JSON.parse(v)
    } catch {
      return null
    }
  }
  if (!v || typeof v !== "object") return null
  const b = v as Record<string, unknown>
  const nums = [b.top, b.left, b.bottom, b.right]
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1)) return null
  const [top, left, bottom, right] = nums as number[]
  if (bottom - top < 0.02 || right - left < 0.02) return null
  return { top, left, bottom, right }
}
