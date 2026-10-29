/**
 * The tester actions we count (item 4). Everything else is already in the database:
 * sign-ups (User), rooms added (RoomProject), design attempts and results
 * (DesignGeneration) and styles chosen (RoomProject.aiDesignsJson).
 */
export const TRACKED_EVENTS = [
  "app_open", // once per Gulf day per person: shows who comes back
  "slider_used", // dragged the before/after slider
  "compare_opened",
  "fullscreen_opened",
  "try_another_style",
  "piece_added", // saved a photo of a piece they love (29 Oct 2026)
  "quote_opened", // opened "Get a quote" on a design
  "quote_room_sent", // sent a quote request for the whole room
  "quote_pieces_sent", // sent a quote request for chosen pieces
  "budget_set", // picked or changed the room's budget
  "change_opened", // opened "Change a piece" on a design
  "piece_swapped", // asked to swap a piece
  "piece_moved", // asked to move a piece
  "piece_removed", // asked to remove a piece
  "estimate_opened", // opened "What's in this design" from the estimate
] as const

export type TrackedEvent = (typeof TRACKED_EVENTS)[number]

export function isTrackedEvent(name: unknown): name is TrackedEvent {
  return typeof name === "string" && (TRACKED_EVENTS as readonly string[]).indexOf(name) !== -1
}

export function cleanProjectId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : null
}

/** Browser side: send and forget. Tracking must never get in the way of the app. */
export function track(name: TrackedEvent, projectId?: string | null): void {
  if (typeof window === "undefined") return
  try {
    void fetch("/api/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectId: projectId || undefined }),
    }).catch(() => {})
  } catch {
    // ignore
  }
}
