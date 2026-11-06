/**
 * A design that is still being made, remembered in the browser so the person can
 * leave the page and come back (tester feedback, 6 Nov 2026).
 *
 * The server keeps going when the page is closed (cancellation is not switched on for
 * Vercel functions here) and saves the design on the room when it is ready. The page
 * only needs to remember that it asked, then look for the new design on return.
 * Kept free of React and of window so it can be tested.
 */

import type { StudioDesign, StudioFailure } from "@/lib/design/studioFlow"
import { readMustIncludeResults } from "@/lib/design/mustInclude"
import { cleanPiece, cleanPieceMode } from "@/lib/design/pieces"
import { readDesignEdit, readDetected } from "@/lib/design/pieceEdit"

/** The design route may run 120 s (maxDuration), plus the upload and save. */
export const PENDING_MAX_MS = 150_000

/** How often the page looks for the finished design while it waits. */
export const PENDING_POLL_MS = 5_000

/** The page starts looking after this long; a design never finishes sooner. */
export const PENDING_FIRST_POLL_MS = 10_000

/** A connection that fails faster than this never reached the server. */
export const QUICK_FAILURE_MS = 4_000

export interface PendingDesign {
  projectId: string
  startedAt: number
  style: string
  /** Heading shown while waiting, e.g. "Swapping the sofa". */
  title: string | null
  /** The room's designs when this one was asked for; any other id is the new design. */
  knownIds: string[]
  /** What was asked for (style and options), so "Try again" repeats it after coming back. */
  request?: unknown
  /** Set when the reply was a failure but the page had already been left. */
  failure?: StudioFailure | null
}

const FAILURE_KINDS = ["failed", "limit", "signin", "no-photo"]

function readFailure(value: unknown): StudioFailure | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (typeof v.kind !== "string" || FAILURE_KINDS.indexOf(v.kind) === -1) return null
  if (typeof v.title !== "string" || typeof v.message !== "string") return null
  return {
    kind: v.kind as StudioFailure["kind"],
    title: v.title,
    message: v.message,
    ...(typeof v.detail === "string" ? { detail: v.detail } : {}),
    ...(typeof v.requestId === "string" ? { requestId: v.requestId } : {}),
  }
}

export function pendingKey(projectId: string): string {
  return `ks-pending-design:${projectId}`
}

export function makePending(input: {
  projectId: string
  style: string
  title?: string | null
  designs: { id: string }[]
  now: number
  request?: unknown
}): PendingDesign {
  return {
    projectId: input.projectId,
    startedAt: input.now,
    style: input.style,
    title: input.title || null,
    knownIds: input.designs.map((d) => d.id),
    ...(input.request !== undefined ? { request: input.request } : {}),
  }
}

export function isExpired(pending: PendingDesign, now: number): boolean {
  return now - pending.startedAt > PENDING_MAX_MS
}

/** Reads a stored marker for this room. Anything malformed, for another room or too old is ignored. */
export function readPending(raw: string | null, projectId: string, now: number): PendingDesign | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (v.projectId !== projectId) return null
  if (typeof v.startedAt !== "number" || !Number.isFinite(v.startedAt)) return null
  if (typeof v.style !== "string" || !v.style) return null
  if (!Array.isArray(v.knownIds) || !v.knownIds.every((id) => typeof id === "string")) return null
  const pending: PendingDesign = {
    projectId,
    startedAt: v.startedAt,
    style: v.style,
    title: typeof v.title === "string" && v.title ? v.title : null,
    knownIds: v.knownIds as string[],
    ...(v.request && typeof v.request === "object" ? { request: v.request } : {}),
    ...(readFailure(v.failure) ? { failure: readFailure(v.failure) } : {}),
  }
  // A start time in the future means a broken clock or a broken value.
  if (pending.startedAt > now + 60_000) return null
  return isExpired(pending, now) ? null : pending
}

/** The newest design that was not on the room when this one was asked for. */
export function newDesignFor<T extends { id: string }>(pending: PendingDesign, designs: T[]): T | null {
  const known = new Set(pending.knownIds)
  return designs.find((d) => !known.has(d.id)) ?? null
}

/** Turns the room's designs, as /api/projects/[id] and the room page read them, into the screen's form. */
export function studioDesignsFrom(list: unknown): StudioDesign[] {
  if (!Array.isArray(list)) return []
  const designs: StudioDesign[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const d = item as Record<string, unknown>
    if (typeof d.id !== "string" || !d.id || typeof d.imageUrl !== "string" || !d.imageUrl) continue
    designs.push({
      id: d.id,
      imageUrl: d.imageUrl,
      style: typeof d.style === "string" ? d.style : "",
      createdAt: typeof d.createdAt === "string" ? d.createdAt : null,
      sourceImageUrl: typeof d.sourceImageUrl === "string" && d.sourceImageUrl ? d.sourceImageUrl : null,
      mustInclude: readMustIncludeResults(d.mustInclude),
      piece: cleanPiece(d.piece),
      pieceMode: cleanPieceMode(d.pieceMode),
      pieceIncluded: typeof d.pieceIncluded === "boolean" ? d.pieceIncluded : null,
      baseDesignId: typeof d.baseDesignId === "string" ? d.baseDesignId : null,
      edit: readDesignEdit(d.edit),
      // The API sends pieces already read; older shapes come as detectedPieces.
      detected: readDetected(d.detected ?? d.detectedPieces),
    })
  }
  return designs
}
