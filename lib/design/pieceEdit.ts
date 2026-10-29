/**
 * "Change a piece" (item 7 of the 28 Oct 2026 build list): tap a dot on a piece in a
 * design, then swap it, move it or remove it. Each change is a new design made from
 * the one on show; everything else should stay as it is.
 *
 * The pieces are found once per design by Gemini (name, kind, box and a spot for the
 * dot). The image model gets the design, then the same design with the piece
 * outlined in red (and, for a move, a red dot where it should go), then, when
 * swapping for a piece the person loves, that piece's photo.
 *
 * Shared by the design screen and the server, so it stays free of React and server code.
 */

import { cleanBox, cleanTapPoint } from "@/lib/design/pieces"
import type { PieceBox, StudioPiece } from "@/lib/design/pieces"

export type EditAction = "swap" | "move" | "remove"

/** A piece found in a design. Fractions of the picture, from the top-left corner. */
export interface DetectedPiece {
  id: string
  /** "leather corner sofa" */
  name: string
  /** "sofa" */
  kind: string
  box: PieceBox
  /** Where the dot goes: a spot on the piece that nothing covers. */
  point: { x: number; y: number }
  /** How many alike, e.g. 2 bar stools or 6 dining chairs (for the estimate). Missing = 1. */
  count?: number
}

/** What the person asked for, as the server receives it. */
export interface EditRequest {
  action: EditAction
  baseDesignId: string
  target: { name: string; kind: string; box: PieceBox }
  /** Move: where the piece should go. */
  to: { x: number; y: number } | null
  /** Swap: quick changes (ids from SWAP_CHANGES). */
  changes: string[]
  /** Swap: what they typed. */
  text: string
}

/** What was changed, saved on the new design. */
export interface DesignEdit {
  action: EditAction
  /** The piece that was changed, e.g. "leather corner sofa". */
  target: string
  /** Swap: quick changes picked, as labels. */
  changes: string[]
  /** Swap: what they typed. */
  text: string
  /** Swap: the name of the piece they love that went in. */
  withPiece: string | null
  /** Whether the check saw the change happen (null when it did not run). */
  done: boolean | null
}

/** Quick changes offered when swapping. Ids are stored; the phrase goes into the instruction. */
export const SWAP_CHANGES: { id: string; label: string; phrase: string }[] = [
  { id: "lighter", label: "Lighter colour", phrase: "in a lighter colour" },
  { id: "darker", label: "Darker colour", phrase: "in a darker colour" },
  { id: "smaller", label: "Smaller", phrase: "smaller" },
  { id: "bigger", label: "Bigger", phrase: "bigger" },
  { id: "rounder", label: "Rounder shape", phrase: "with a softer, rounder shape" },
  { id: "simpler", label: "Simpler look", phrase: "with a simpler, plainer look" },
]

export const DETECT_LIMIT = 12
const MAX_TEXT = 200

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return ""
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
}

/** The name the furnishing check and the instruction use (no quotes or backslashes). */
function plainName(value: string): string {
  return value.replace(/["\\]/g, "").trim().toLowerCase()
}

// ---- Finding the pieces in a design ------------------------------------------------

/** 1 to 20 alike; anything else counts as 1. */
function cleanCount(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 20 ? n : 1
}

export function buildDetectPrompt(): string {
  return `List the pieces in this room photo that someone might want to swap, move or remove: furniture, rugs, lamps and light fittings, curtains, mirrors, wall art, plants and large decor. Leave out walls, windows, doors, built-in cabinets and wardrobes, the floor, the ceiling, the TV screen on its own and small objects on tables.
At most ${DETECT_LIMIT}, largest first. Answer with JSON only:
[
  {
    "name": "a short name a shopper would use, 2 to 4 words, such as leather corner sofa",
    "kind": "one or two words for the type of piece, such as sofa",
    "count": 1,
    "box_2d": [ymin, xmin, ymax, xmax],
    "point": [y, x]
  }
]
List matching pieces that stand together once, with count = how many there are (for example 2 bar stools or 6 dining chairs); otherwise count is 1.
box_2d is the bounding box of the piece (or of the group) and point is a spot on the piece itself that no other piece covers, both on a 0 to 1000 scale from the top-left corner.`
}

/** Gemini's answer, cleaned: real boxes only, one dot per spot, at most DETECT_LIMIT. */
export function parseDetected(text: string): DetectedPiece[] {
  let json = text.trim()
  json = json.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return []
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const list = (parsed as Record<string, unknown>).pieces
    parsed = Array.isArray(list) ? list : []
  }
  if (!Array.isArray(parsed)) return []

  const out: DetectedPiece[] = []
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue
    const v = item as Record<string, unknown>
    const name = cleanText(v.name, 60).toLowerCase()
    if (!name) continue
    const kind = cleanText(v.kind, 30).toLowerCase() || name
    const raw = v.box_2d
    if (!Array.isArray(raw) || raw.length !== 4 || !raw.every((n) => typeof n === "number" && Number.isFinite(n))) continue
    const [ymin, xmin, ymax, xmax] = (raw as number[]).map((n) => clamp01(n / 1000))
    if (ymax - ymin < 0.02 || xmax - xmin < 0.02) continue
    const box = { top: ymin, left: xmin, bottom: ymax, right: xmax }
    let point = { x: (xmin + xmax) / 2, y: (ymin + ymax) / 2 }
    const p = v.point
    if (Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n))) {
      const px = clamp01((p[1] as number) / 1000)
      const py = clamp01((p[0] as number) / 1000)
      if (px >= xmin && px <= xmax && py >= ymin && py <= ymax) point = { x: px, y: py }
    }
    // Two dots almost on top of each other can't both be tapped.
    if (out.some((o) => Math.hypot(o.point.x - point.x, o.point.y - point.y) < 0.04)) continue
    const count = cleanCount(v.count)
    out.push({ id: `p${out.length + 1}`, name, kind, box, point, ...(count > 1 ? { count } : {}) })
    if (out.length >= DETECT_LIMIT) break
  }
  return out
}

/** Stored or sent pieces, cleaned. */
export function readDetected(value: unknown): DetectedPiece[] | null {
  if (!Array.isArray(value)) return null
  const out: DetectedPiece[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const v = item as Record<string, unknown>
    const name = cleanText(v.name, 60)
    const box = cleanBox(v.box)
    const point = v.point && typeof v.point === "object" ? cleanTapPoint((v.point as any).x, (v.point as any).y) : null
    const id = typeof v.id === "string" && /^p\d{1,2}$/.test(v.id) ? v.id : ""
    if (!name || !box || !point || !id) continue
    const count = cleanCount(v.count)
    out.push({ id, name, kind: cleanText(v.kind, 30) || name, box, point, ...(count > 1 ? { count } : {}) })
  }
  return out.slice(0, DETECT_LIMIT)
}

// ---- The request -----------------------------------------------------------------

export function cleanEditAction(value: unknown): EditAction | null {
  return value === "swap" || value === "move" || value === "remove" ? value : null
}

/** A change from the browser, or null if it is not a valid one. */
export function cleanEditRequest(value: unknown): EditRequest | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const action = cleanEditAction(v.action)
  const baseDesignId = typeof v.baseDesignId === "string" ? v.baseDesignId.slice(0, 80) : ""
  const t = v.target && typeof v.target === "object" ? (v.target as Record<string, unknown>) : null
  const name = t ? cleanText(t.name, 60) : ""
  const box = t ? cleanBox(t.box) : null
  if (!action || !baseDesignId || !name || !box) return null
  const to = v.to && typeof v.to === "object" ? cleanTapPoint((v.to as any).x, (v.to as any).y) : null
  if (action === "move" && !to) return null
  const known = new Set(SWAP_CHANGES.map((c) => c.id))
  const changes =
    action === "swap" && Array.isArray(v.changes)
      ? Array.from(new Set(v.changes.filter((c): c is string => typeof c === "string" && known.has(c)))).slice(0, 4)
      : []
  return {
    action,
    baseDesignId,
    target: { name, kind: (t ? cleanText(t.kind, 30) : "") || name, box },
    to: action === "move" ? to : null,
    changes,
    text: action === "swap" ? cleanText(v.text, MAX_TEXT) : "",
  }
}

// ---- The instruction ----------------------------------------------------------------

/** "on the left, near the camera" for a box or point. */
export function positionWords(at: { x: number; y: number }): string {
  const across = at.x < 0.36 ? "on the left" : at.x > 0.64 ? "on the right" : "in the middle"
  const depth = at.y > 0.68 ? ", near the camera" : at.y < 0.38 ? ", high up or at the back" : ""
  return `${across}${depth}`
}

function centre(box: PieceBox): { x: number; y: number } {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
}

const KEEP_REST =
  "Change nothing else in the first image: keep the same walls, windows, doors, floor, ceiling, camera position, lens and lighting, and keep every other piece of furniture, the TV, rugs, curtains, lights and decor exactly as they are, the same size and in the same place."

const FINISH =
  "Do not draw any outline, dot or marking in the result. Match the room's lighting and add natural shadows. Keep doorways and walkways clear. Photorealistic interior photograph. No text, logos or watermarks."

function describePiece(piece: StudioPiece): string {
  return piece.description ? `${piece.name} (${piece.description.replace(/\.$/, "")})` : piece.name
}

/** The whole instruction for a change, given what the person asked for. */
export function editInstruction(edit: EditRequest, piece: StudioPiece | null = null): string {
  const name = plainName(edit.target.name)
  const kind = plainName(edit.target.kind) || name
  const where = positionWords(centre(edit.target.box))
  const marked = `The second image is the same room with one piece outlined in red: the ${name} ${where}.`

  if (edit.action === "remove") {
    return [
      `The first image is a furnished room. ${marked}`,
      `Remove only that ${kind} from the room. Where it stood, show what would naturally be behind it: the same floor, rug, wall or curtain, continuing seamlessly, with no gap, shadow or mark left behind.`,
      KEEP_REST,
      FINISH,
    ].join("\n")
  }

  if (edit.action === "move" && edit.to) {
    return [
      `The first image is a furnished room. The second image is the same room with one piece outlined in red, the ${name} ${where}, and a red dot where it should go (${positionWords(edit.to)}).`,
      `Move only that ${kind} to the spot marked with the red dot. Keep it the same piece, the same size in real life, standing naturally there in the room's perspective. Where it stood before, show what would naturally be there: the same floor, rug or wall, continuing seamlessly.`,
      KEEP_REST,
      FINISH,
    ].join("\n")
  }

  if (piece) {
    return [
      `The first image is a furnished room. ${marked} The third image is a photo of one piece the customer loves: ${describePiece(piece)}.`,
      `Replace the outlined ${kind} with that exact piece, in the same spot.`,
      "Copy the piece faithfully: the same shape, proportions, colour, fabric or leather texture, stitching, legs and details. Do not redesign it or swap it for a similar piece.",
      "Ignore everything else in the third image (the floor, walls, loose cushions, throws and other objects around the piece).",
      piece.widthCm
        ? `It is about ${piece.widthCm} cm wide: give it that real size, in proportion to the room.`
        : `Give it a realistic size for a real ${piece.kind}, in proportion to the room.`,
      KEEP_REST,
      FINISH,
    ].join("\n")
  }

  const phrases = edit.changes
    .map((id) => SWAP_CHANGES.find((c) => c.id === id)?.phrase)
    .filter((p): p is string => Boolean(p))
  const wanted = phrases.length > 0 ? ` ${phrases.join(", ")}` : ""
  return [
    `The first image is a furnished room. ${marked}`,
    `Replace only that ${kind} with a different ${kind}${wanted}, in the same spot, that suits the rest of the room.`,
    edit.text ? `The customer describes what they want: ${edit.text}` : "",
    KEEP_REST,
    FINISH,
  ]
    .filter(Boolean)
    .join("\n")
}

/** What the furnishing check is asked about after the change. */
export function editCheckName(edit: EditRequest, piece: StudioPiece | null): string {
  if (edit.action === "swap" && piece) return plainName(piece.name || piece.kind) || "piece"
  return plainName(edit.target.name) || "piece"
}

/** Whether the change happened, from the check's answer about editCheckName. */
export function editDone(action: EditAction, present: boolean | null, usedPiece: boolean): boolean | null {
  if (present === null) return null
  if (action === "remove") return !present
  if (action === "move") return present
  return usedPiece ? present : null
}

/**
 * The red marks drawn over a copy of the design for the image model: an outline
 * round the piece and, for a move, a dot where it should go. SVG the size of the image.
 */
export function markSvg(width: number, height: number, box: PieceBox, to: { x: number; y: number } | null): string {
  const short = Math.max(1, Math.min(width, height))
  const stroke = Math.max(4, Math.round(short * 0.008))
  const pad = Math.round(short * 0.012)
  const x = Math.max(0, Math.round(box.left * width) - pad)
  const y = Math.max(0, Math.round(box.top * height) - pad)
  const w = Math.min(width - x, Math.round((box.right - box.left) * width) + pad * 2)
  const h = Math.min(height - y, Math.round((box.bottom - box.top) * height) + pad * 2)
  const r = Math.round(short * 0.015)
  const parts = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="none" stroke="#FF1F1F" stroke-width="${stroke}"/>`,
  ]
  if (to) {
    const dot = Math.max(10, Math.round(short * 0.022))
    parts.push(
      `<circle cx="${Math.round(to.x * width)}" cy="${Math.round(to.y * height)}" r="${dot}" fill="#FF1F1F" stroke="#FFFFFF" stroke-width="${Math.max(3, Math.round(stroke / 2))}"/>`
    )
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`
}

// ---- What changed -------------------------------------------------------------------

export function designEditFrom(edit: EditRequest, piece: StudioPiece | null, done: boolean | null): DesignEdit {
  return {
    action: edit.action,
    target: edit.target.name,
    changes: edit.changes.map((id) => SWAP_CHANGES.find((c) => c.id === id)?.label ?? id),
    text: edit.text,
    withPiece: edit.action === "swap" && piece ? piece.name : null,
    done,
  }
}

/** A saved change, cleaned, or null. */
export function readDesignEdit(value: unknown): DesignEdit | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const action = cleanEditAction(v.action)
  const target = cleanText(v.target, 60)
  if (!action || !target) return null
  return {
    action,
    target,
    changes: Array.isArray(v.changes) ? v.changes.map((c) => cleanText(c, 40)).filter(Boolean).slice(0, 4) : [],
    text: cleanText(v.text, MAX_TEXT),
    withPiece: cleanText(v.withPiece, 60) || null,
    done: typeof v.done === "boolean" ? v.done : null,
  }
}

function capital(s: string): string {
  const t = s.trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

/** "Leather corner sofa swapped for your modular sofa", "Leather pouf moved", "Leather pouf removed". */
export function editHeadline(edit: DesignEdit): string {
  const target = capital(edit.target)
  if (edit.action === "remove") return `${target} removed`
  if (edit.action === "move") return `${target} moved`
  if (edit.withPiece) return `${target} swapped for your ${edit.withPiece.toLowerCase()}`
  return `${target} swapped`
}

/** The details under the headline for a swap: "Lighter colour · Smaller · “a low cream sofa”". */
export function editDetail(edit: DesignEdit): string {
  if (edit.action !== "swap" || edit.withPiece) return ""
  const parts = [...edit.changes]
  if (edit.text) parts.push(`“${edit.text}”`)
  return parts.length > 0 ? parts.join(" · ") : "A different one that suits the room"
}

/** When the check says the change did not happen. */
export function editMissedMessage(edit: DesignEdit): string | null {
  if (edit.done !== false) return null
  const target = `the ${edit.target.toLowerCase()}`
  if (edit.action === "remove") return `We couldn't remove ${target} this time.`
  if (edit.action === "move") return `We couldn't find ${target} after the move.`
  return edit.withPiece ? `We couldn't fit your ${edit.withPiece.toLowerCase()} this time.` : null
}

/** "the sofa" style short name for buttons and progress text. */
export function shortName(piece: { kind: string; name: string }): string {
  return plainName(piece.kind || piece.name) || "piece"
}
