/**
 * "Get a quote" on every design (Ayo, 29 Oct 2026): for the whole room, or for chosen
 * pieces (the piece you love and the must-haves). Requests come to us by WhatsApp or
 * email and are answered by hand (maker pilot). Free of React so it can be tested.
 */

import { pieceLabel } from "@/lib/design/pieces"
import type { StudioDesign } from "@/lib/design/studioFlow"

/** Ayo, 29 Oct 2026. */
export const QUOTE_REPLY_PROMISE = "We'll reply within 2 working days."

export interface QuoteItem {
  /** "piece:<piece id>" or "must:<must-have id>" */
  id: string
  label: string
  /** A picture of the piece, when there is one. */
  imageUrl?: string
}

/** What can be ticked for a design: the piece you love, then the must-haves that made it in. */
export function quoteItemsFor(design: Pick<StudioDesign, "piece" | "pieceIncluded" | "mustInclude">): QuoteItem[] {
  const items: QuoteItem[] = []
  if (design.piece && design.pieceIncluded !== false) {
    items.push({ id: `piece:${design.piece.id}`, label: `Your ${pieceLabel(design.piece).toLowerCase()}`, imageUrl: design.piece.imageUrl })
  }
  for (const result of design.mustInclude ?? []) {
    if (result.included !== false) items.push({ id: `must:${result.id}`, label: result.label })
  }
  return items
}

export interface QuoteRequest {
  roomName: string
  styleName: string
  designUrl: string
  wholeRoom: boolean
  /** Ticked items (ignored for the whole room). */
  items: QuoteItem[]
  /** Anything else the person typed. */
  other: string
}

/** A request can be sent for the whole room, or when at least one piece is ticked or named. */
export function canSendQuote(request: Pick<QuoteRequest, "wholeRoom" | "items" | "other">): boolean {
  return request.wholeRoom || request.items.length > 0 || request.other.trim().length > 0
}

/** The message that arrives on WhatsApp or by email. */
export function quoteMessage(request: QuoteRequest): string {
  const other = request.other.replace(/\s+/g, " ").trim().slice(0, 300)
  const lines = [`Hello, I'd like a quote to make my design real.`, `Room: ${request.roomName.trim() || "My room"} (${request.styleName})`]
  if (request.wholeRoom) {
    lines.push("Quote for: the whole room")
    if (other) lines.push(`Notes: ${other}`)
  } else {
    const named = request.items.map((item) => item.label)
    if (other) named.push(other)
    lines.push(`Quote for: ${named.join("; ")}`)
  }
  lines.push(`My design: ${request.designUrl}`)
  if (!request.wholeRoom) {
    for (const item of request.items) if (item.imageUrl) lines.push(`${item.label}: ${item.imageUrl}`)
  }
  return lines.join("\n")
}
