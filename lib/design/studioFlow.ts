/**
 * The design screen's rules, kept free of React so they can be tested.
 */

export const DESIGN_STEPS = [
  "Reading your room",
  "Keeping walls, windows and doors",
  "Arranging furniture and decor",
  "Final quality check",
]

/**
 * When each step starts, in milliseconds. A design usually takes 30 to 50 seconds
 * and the server only answers at the end, so the steps run on a timer.
 */
export const STEP_STARTS_MS = [0, 5_000, 12_000, 30_000]

export function stepIndexAt(elapsedMs: number): number {
  let index = 0
  for (let i = 0; i < STEP_STARTS_MS.length; i++) {
    if (elapsedMs >= STEP_STARTS_MS[i]) index = i
  }
  return index
}

/** Progress bar width in percent. It eases towards 95 and never shows "done" before the reply. */
export function progressAt(elapsedMs: number): number {
  if (!(elapsedMs > 0)) return 2
  const eased = Math.round(95 * (1 - Math.exp(-elapsedMs / 18_000)))
  return Math.max(2, Math.min(95, eased))
}

export interface StudioDesign {
  id: string
  imageUrl: string
  style: string
  createdAt?: string | null
  /** The room photo this design was made from. Older designs don't have it. */
  sourceImageUrl?: string | null
}

/** What /api/ai/stage-room sends back (only the fields the screen uses). */
export interface StageRoomReply {
  success?: boolean
  imageUrl?: string | null
  images?: string[]
  designId?: string | null
  errorMessage?: string
  errorCode?: string
  requestId?: string
}

export type FailureKind = "failed" | "limit" | "signin" | "no-photo"

export interface StudioFailure {
  kind: FailureKind
  title: string
  message: string
  /** The server's own words, shown small, to help when testers report a problem. */
  detail?: string
  requestId?: string
}

export function describeFailure(reply: StageRoomReply | null | undefined, styleName: string): StudioFailure {
  if (!reply) {
    return {
      kind: "failed",
      title: "This design did not work",
      message: "We could not connect. Check your internet connection and try again. Nothing was saved.",
    }
  }
  const requestId = reply.requestId || undefined
  switch (reply.errorCode) {
    case "DAILY_LIMIT_REACHED":
      return {
        kind: "limit",
        title: "You have used today's designs",
        message: reply.errorMessage || "You have reached today's design limit. Please come back later.",
        requestId,
      }
    case "UNAUTHORIZED":
      return {
        kind: "signin",
        title: "Please sign in again",
        message: "Your session has ended. Sign in, then try this style again.",
        requestId,
      }
    case "MISSING_IMAGE":
      return {
        kind: "no-photo",
        title: "Add a photo of your room",
        message: "We need a photo of your room before we can design it.",
        requestId,
      }
    default:
      return {
        kind: "failed",
        title: "This design did not work",
        message: `We could not make a good ${styleName} design from this photo, so nothing was saved. Try again, or choose a different style.`,
        detail: reply.errorMessage || undefined,
        requestId,
      }
  }
}

export function designFromReply(
  reply: StageRoomReply | null | undefined,
  input: { style: string; sourceImageUrl: string | null; now: Date }
): StudioDesign | null {
  if (!reply || reply.success !== true) return null
  const imageUrl = reply.imageUrl || (reply.images && reply.images[0]) || ""
  if (!imageUrl) return null
  return {
    id: reply.designId || `local_${input.now.getTime()}`,
    imageUrl,
    style: input.style,
    createdAt: input.now.toISOString(),
    sourceImageUrl: input.sourceImageUrl,
  }
}

/** Adds a new design at the front, the way the server stores them (12 at most). */
export function addDesign(designs: StudioDesign[], design: StudioDesign): StudioDesign[] {
  return [design, ...designs.filter((d) => d.id !== design.id)].slice(0, 12)
}

export const ORIGINAL_PHOTO_ID = "original"

/** Compare opens with the design on show next to the most recent other design, or else the room photo. */
export function defaultComparePair(designs: StudioDesign[], currentId: string | null): [string, string] {
  const current = designs.find((d) => d.id === currentId) ?? designs[0]
  if (!current) return [ORIGINAL_PHOTO_ID, ORIGINAL_PHOTO_ID]
  const other = designs.find((d) => d.id !== current.id)
  return [current.id, other ? other.id : ORIGINAL_PHOTO_ID]
}

/** Tapping a thumbnail puts it on the right, unless it is already showing. */
export function pickForCompare(pair: [string, string], id: string): [string, string] {
  if (pair[0] === id || pair[1] === id) return pair
  return [pair[0], id]
}

/** Designs are stored newest first; number them oldest first, the way people count. */
export function designNumber(designs: StudioDesign[], id: string): number {
  const index = designs.findIndex((d) => d.id === id)
  return index < 0 ? 0 : designs.length - index
}

/** The "before" picture for a design: the photo it was made from, else the room's current photo. */
export function beforePhotoFor(design: StudioDesign | null | undefined, roomPhoto: string | null): string | null {
  return (design && design.sourceImageUrl) || roomPhoto || null
}
