/**
 * Which stored files belong to a room, so deleting the room can delete them too.
 */

const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/i

export function isBlobUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && BLOB_HOST.test(url.hostname)
  } catch {
    return false
  }
}

type RoomFiles = { imageUrl?: string | null; aiDesignsJson?: unknown; lastAiSettings?: unknown }

/** The room's photo, every design, the photo each design was made from, and the room's pieces. */
export function roomBlobUrls(room: RoomFiles): string[] {
  const urls: string[] = []
  const add = (value: unknown) => {
    if (isBlobUrl(value) && urls.indexOf(value) === -1) urls.push(value)
  }
  add(room.imageUrl)
  const designs = Array.isArray(room.aiDesignsJson) ? room.aiDesignsJson : []
  for (const design of designs) {
    if (design && typeof design === "object") {
      const d = design as Record<string, unknown>
      add(d.imageUrl)
      add(d.sourceImageUrl)
      if (d.piece && typeof d.piece === "object") add((d.piece as Record<string, unknown>).imageUrl)
    }
  }
  const settings = room.lastAiSettings && typeof room.lastAiSettings === "object" ? (room.lastAiSettings as Record<string, unknown>) : null
  const pieces = settings && Array.isArray(settings.pieces) ? settings.pieces : []
  for (const piece of pieces) {
    if (piece && typeof piece === "object") add((piece as Record<string, unknown>).imageUrl)
  }
  return urls
}

/** The room's files that none of the person's other rooms still show. */
export function filesOnlyThisRoomUses(room: RoomFiles, otherRooms: RoomFiles[]): string[] {
  const keep = new Set<string>()
  for (const other of otherRooms) for (const url of roomBlobUrls(other)) keep.add(url)
  return roomBlobUrls(room).filter((url) => !keep.has(url))
}

/**
 * Files are removed only on the live site. The test database is a copy of the live one
 * and still points at the live files, so deleting a room there must leave them alone.
 */
export function shouldDeleteFiles(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production"
}
