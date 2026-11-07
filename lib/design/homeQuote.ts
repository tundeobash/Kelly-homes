/**
 * "Get a quote for my home" (Ony's feedback 6 Nov 2026: the quote is per room, she wants the
 * whole apartment in one; sketch approved by Ayo 7 Nov). One request for every room ticked,
 * each with its chosen design (the latest unless another is picked) and our estimate at the
 * room's own budget, plus when it's needed and notes. Requests come to us by WhatsApp or
 * email, like the per-room quote. Free of React so it can be tested.
 */

import { TIER_LABELS, estimateFor, estimateTier, formatTotal } from "@/lib/design/estimate"
import type { PriceTier } from "@/lib/design/estimate"
import type { BudgetTier } from "@/lib/design/budget"
import type { DetectedPiece } from "@/lib/design/pieceEdit"
import { styleDisplayName } from "@/lib/design/studioStyles"
import { updatedLabel } from "@/lib/rooms"

export interface HomeDesign {
  id: string
  imageUrl: string
  style: string
  createdAt?: string | null
  /** The pieces found for the estimate; null until they have been looked for. */
  detected?: DetectedPiece[] | null
}

export interface HomeRoom {
  id: string
  name: string
  budget: BudgetTier | null
  /** Newest first, as stored. */
  designs: HomeDesign[]
}

/** The home quote shows from two rooms with designs; one room has its own "Get a quote". */
export const HOME_QUOTE_MIN_ROOMS = 2

export function roomsWithDesigns<T extends Pick<HomeRoom, "designs">>(rooms: T[]): T[] {
  return rooms.filter((room) => room.designs.length > 0)
}

export function showHomeQuote(rooms: Pick<HomeRoom, "designs">[]): boolean {
  return roomsWithDesigns(rooms).length >= HOME_QUOTE_MIN_ROOMS
}

/** "When do you need it?" (optional). `message` is how it reads in the request. */
export const HOME_TIMINGS = [
  { id: "month", label: "Within a month", message: "within a month" },
  { id: "quarter", label: "1–3 months", message: "in 1–3 months" },
  { id: "later", label: "Later", message: "later" },
  { id: "looking", label: "Just looking", message: "just looking for now" },
] as const

export type HomeTiming = (typeof HOME_TIMINGS)[number]["id"]

export function cleanTiming(value: unknown): HomeTiming | null {
  return HOME_TIMINGS.find((t) => t.id === value)?.id ?? null
}

/** The design used for a room: the one picked, else the latest. */
export function chosenDesign<D extends { id: string }>(room: { designs: D[] }, pickedId?: string | null): D | null {
  return room.designs.find((design) => design.id === pickedId) ?? room.designs[0] ?? null
}

export interface RoomEstimate {
  tier: PriceTier
  /** null until the pieces are found, or when none of them has a typical price. */
  range: [number, number] | null
  /** The design's pieces have been looked for. */
  known: boolean
}

/** Our estimate for one room's design, at the room's budget (mid-range when none is picked). */
export function roomEstimate(budget: BudgetTier | null | undefined, detected: DetectedPiece[] | null | undefined): RoomEstimate {
  const tier = estimateTier(budget)
  if (!detected) return { tier, range: null, known: false }
  const estimate = estimateFor(detected, tier)
  return { tier, range: estimate.priced > 0 ? [estimate.low, estimate.high] : null, known: true }
}

export interface HomeTotal {
  low: number
  high: number
  /** Rooms with a range, and rooms left to the quote. */
  priced: number
  open: number
}

export function homeTotal(ranges: ([number, number] | null)[]): HomeTotal {
  const total: HomeTotal = { low: 0, high: 0, priced: 0, open: 0 }
  for (const range of ranges) {
    if (range) {
      total.low += range[0]
      total.high += range[1]
      total.priced += 1
    } else {
      total.open += 1
    }
  }
  return total
}

/** "AED 39,000–61,000", or null when no room is priced yet. */
export function homeTotalLabel(total: HomeTotal): string | null {
  return total.priced > 0 ? formatTotal(total.low, total.high) : null
}

/** "at mid-range shop prices" when every room has the same budget, else "at each room's budget". */
export function tiersPhrase(tiers: PriceTier[]): string {
  const first = tiers[0]
  if (first && tiers.every((tier) => tier === first)) return `at ${TIER_LABELS[first].toLowerCase()} shop prices`
  return "at each room's budget"
}

/** "Today", "Yesterday", "3 days ago", "29 Oct" for a design in the picker. */
export function designWhen(createdAt: string | null | undefined, now: Date): string {
  const label = updatedLabel(createdAt ?? null, now).replace(/^Updated /, "")
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : ""
}

export interface HomeQuoteRoom {
  name: string
  style: string
  tier: PriceTier
  range: [number, number] | null
  designUrl: string
}

export interface HomeQuoteRequest {
  rooms: HomeQuoteRoom[]
  timing: HomeTiming | null
  notes: string
}

export function canSendHomeQuote(request: Pick<HomeQuoteRequest, "rooms">): boolean {
  return request.rooms.length > 0
}

/** The message that arrives on WhatsApp or by email. */
export function homeQuoteMessage(request: HomeQuoteRequest): string {
  const count = request.rooms.length
  const lines = [`Hello, I'd like a quote for my home (${count === 1 ? "1 room" : `${count} rooms`}).`]
  const timing = HOME_TIMINGS.find((t) => t.id === request.timing)
  if (timing) lines.push(`Needed: ${timing.message}`)
  const total = homeTotal(request.rooms.map((room) => room.range))
  const totalLabel = homeTotalLabel(total)
  if (totalLabel) {
    const open = total.open === 0 ? "" : total.open === 1 ? "; 1 more room to price" : `; ${total.open} more rooms to price`
    lines.push(`Our estimate: ${totalLabel} ${tiersPhrase(request.rooms.map((room) => room.tier))}${open}`)
  }
  request.rooms.forEach((room, index) => {
    const name = room.name.replace(/\s+/g, " ").trim() || "My room"
    const range = room.range ? formatTotal(room.range[0], room.range[1]) : "priced in your quote"
    lines.push(`${index + 1}. ${name} (${styleDisplayName(room.style)}), ${TIER_LABELS[room.tier].toLowerCase()}, ${range}`)
    lines.push(`Design: ${room.designUrl}`)
  })
  const notes = request.notes.replace(/\s+/g, " ").trim().slice(0, 300)
  if (notes) lines.push(`Notes: ${notes}`)
  return lines.join("\n")
}
