/**
 * How a room is described on the Your rooms page. Kept free of React and the
 * database so it can be tested.
 */

const ROOM_TYPE_LABELS: Record<string, string> = {
  "living room": "Living room",
  bedroom: "Bedroom",
  "dining room": "Dining room",
  kitchen: "Kitchen",
  office: "Office",
  other: "Other room",
}

/** The room types offered when adding a room, in order. */
export const ROOM_TYPE_OPTIONS: { id: string; label: string }[] = [
  { id: "living room", label: "Living room" },
  { id: "bedroom", label: "Bedroom" },
  { id: "dining room", label: "Dining room" },
  { id: "kitchen", label: "Kitchen" },
  { id: "office", label: "Office" },
  { id: "other", label: "Other" },
]

export function roomTypeLabel(roomType: string | null | undefined): string {
  const key = (roomType || "").trim().toLowerCase()
  if (!key) return "Room"
  return ROOM_TYPE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

/** A name for a room the person left unnamed. */
export function defaultRoomName(roomType: string | null | undefined): string {
  const label = roomTypeLabel(roomType)
  return label === "Other room" ? "My room" : label
}

const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function dayNumber(date: Date, offsetMinutes: number): number {
  return Math.floor((date.getTime() + offsetMinutes * 60_000) / DAY_MS)
}

/**
 * "Updated today", "Updated yesterday", "Updated 3 days ago", or a date after a month.
 * Days are counted in Gulf time (UTC+4) by default, the launch market.
 */
export function updatedLabel(updatedAt: Date | string | null | undefined, now: Date, offsetMinutes = 240): string {
  if (!updatedAt) return ""
  const when = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt
  if (Number.isNaN(when.getTime())) return ""
  const days = dayNumber(now, offsetMinutes) - dayNumber(when, offsetMinutes)
  if (days <= 0) return "Updated today"
  if (days === 1) return "Updated yesterday"
  if (days < 30) return `Updated ${days} days ago`
  const local = new Date(when.getTime() + offsetMinutes * 60_000)
  return `Updated ${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`
}

export function designCountLabel(count: number): string {
  if (count <= 0) return "No designs yet"
  return count === 1 ? "1 design" : `${count} designs`
}

export interface RoomSummaryInput {
  roomType?: string | null
  imageUrl?: string | null
  /** Newest first, as stored. */
  designs: { imageUrl: string; style?: string | null }[]
  updatedAt?: Date | string | null
}

/** The picture on a room's card: its latest design, or else its photo. */
export function roomCover(room: RoomSummaryInput): { src: string | null; isDesign: boolean } {
  const latest = room.designs[0]
  if (latest && latest.imageUrl) return { src: latest.imageUrl, isDesign: true }
  return { src: room.imageUrl || null, isDesign: false }
}

export function roomMeta(room: RoomSummaryInput, now: Date): string {
  return [roomTypeLabel(room.roomType), designCountLabel(room.designs.length), updatedLabel(room.updatedAt, now)]
    .filter(Boolean)
    .join(" · ")
}
