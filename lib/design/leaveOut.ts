/**
 * "Leave out": pieces a person does not want in a design (tester Sama, 7 Nov 2026: she
 * tried to rule furniture out in the note, which the image model doesn't reliably follow).
 * The model is told to leave each one out, and the furnishing check confirms it, like
 * "Must include" in reverse. Shared by the design screen and the stage-room route, so it
 * stays free of React and server code.
 */

/** At most this many pieces per design. */
export const LEAVE_OUT_LIMIT = 4

export interface LeaveOutOption {
  id: string
  label: string
  /** How the image model is told what to leave out. */
  instruction: string
  /** Words the furnishing check uses for this piece when it gives no direct answer. */
  terms: string[]
}

/** Ids shared with Must include (dining table, desk, TV unit, armchair, bookshelf) mean the same piece. */
export const LEAVE_OUT_OPTIONS: LeaveOutOption[] = [
  { id: "rug", label: "Rug", instruction: "a rug or carpet", terms: ["rug", "carpet", "runner", "kilim"] },
  { id: "coffee-table", label: "Coffee table", instruction: "a coffee table", terms: ["coffee table", "centre table", "center table", "cocktail table"] },
  {
    id: "tv-unit",
    label: "TV unit",
    instruction: "a TV unit, TV stand or media console",
    terms: ["tv unit", "tv stand", "tv console", "tv cabinet", "media console", "media unit", "media cabinet", "entertainment"],
  },
  { id: "armchair", label: "Armchair", instruction: "an armchair or accent chair", terms: ["armchair", "accent chair", "lounge chair", "club chair"] },
  { id: "side-tables", label: "Side tables", instruction: "side tables or end tables", terms: ["side table", "end table", "accent table", "nesting table"] },
  { id: "curtains", label: "Curtains", instruction: "curtains, drapes or blinds", terms: ["curtain", "drape", "blind", "sheer"] },
  { id: "plants", label: "Plants", instruction: "plants or trees", terms: ["plant", "tree", "palm", "fern", "greenery"] },
  { id: "wall-art", label: "Wall art", instruction: "wall art, paintings, prints or framed pictures", terms: ["wall art", "artwork", "painting", "print", "framed", "canvas"] },
  { id: "dining-table", label: "Dining table", instruction: "a dining table", terms: ["dining table", "dining set"] },
  { id: "desk", label: "Desk", instruction: "a desk", terms: ["desk", "workstation", "writing table"] },
  { id: "bookshelf", label: "Bookshelf", instruction: "a bookshelf or open shelving", terms: ["bookshelf", "bookcase", "shelving", "shelves"] },
]

/** One piece on a saved design. leftOut is null when the check did not run. */
export interface LeaveOutResult {
  id: string
  label: string
  leftOut: boolean | null
}

export function findLeaveOut(id: string): LeaveOutOption | undefined {
  return LEAVE_OUT_OPTIONS.find((option) => option.id === id)
}

/** The options for a room: a living and dining room always gets a dining table, so it can't be left out. */
export function leaveOutOptionsFor(roomType: string | null | undefined): LeaveOutOption[] {
  const livingDining = (roomType || "").trim().toLowerCase() === "living and dining room"
  return LEAVE_OUT_OPTIONS.filter((option) => !(livingDining && option.id === "dining-table"))
}

/** Known ids only, no repeats, at most the limit, in the order given. */
export function cleanLeaveOut(value: unknown, limit = LEAVE_OUT_LIMIT): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const id = item.trim().toLowerCase()
    if (!findLeaveOut(id) || out.includes(id)) continue
    out.push(id)
    if (out.length >= limit) break
  }
  return out
}

/** Tapping a button: removes it if picked, else adds it unless the limit is reached. */
export function toggleLeaveOut(current: string[], id: string, limit = LEAVE_OUT_LIMIT): string[] {
  if (current.includes(id)) return current.filter((x) => x !== id)
  if (!findLeaveOut(id) || current.length >= limit) return current
  return [...current, id]
}

/** A piece can't be on both lists: the list just changed wins, the other list drops it. */
export function withoutClashes(other: string[], changed: string[]): string[] {
  return other.filter((id) => !changed.includes(id))
}

/** The instruction for the image model, or "" when nothing is to be left out. */
export function leaveOutInstruction(ids: string[]): string {
  const options = ids.map(findLeaveOut).filter((o): o is LeaveOutOption => Boolean(o))
  if (options.length === 0) return ""
  return [
    `The customer does not want any of these in the room: ${options.map((o) => o.instruction).join("; ")}.`,
    "Leave each of them out completely, even where the layout above suggests one, and furnish the room well without them.",
  ].join(" ")
}

function hasTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|[^a-z])${escaped}(s|es)?($|[^a-z])`).test(text)
}

/** The name the furnishing check is asked about (whether it is visible). */
export function leaveOutCheckName(id: string): string {
  return (findLeaveOut(id)?.label || id).toLowerCase()
}

/**
 * Whether each piece was left out: the furnishing check's direct answer (is it visible?)
 * when it gave one, else whether it shows up in its list of visible furniture.
 */
export function checkLeaveOuts(
  inspection: { furniture: string[]; mustHave?: Record<string, boolean> },
  ids: string[]
): LeaveOutResult[] {
  const furniture = inspection.furniture.join(" | ").toLowerCase()
  const answers = inspection.mustHave || {}
  return ids
    .map(findLeaveOut)
    .filter((o): o is LeaveOutOption => Boolean(o))
    .map((option) => {
      const seen = answers[option.label.toLowerCase()]
      const visible = typeof seen === "boolean" ? seen : option.terms.some((term) => hasTerm(furniture, term))
      return { id: option.id, label: option.label, leftOut: !visible }
    })
}

/** Results for pieces the check did not run on (no Gemini key). */
export function uncheckedLeaveOuts(ids: string[]): LeaveOutResult[] {
  return ids
    .map(findLeaveOut)
    .filter((o): o is LeaveOutOption => Boolean(o))
    .map((option) => ({ id: option.id, label: option.label, leftOut: null }))
}

/** The results saved on a design, cleaned. Older designs have none. */
export function readLeaveOutResults(value: unknown): LeaveOutResult[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((r): r is { id: unknown; leftOut?: unknown } => Boolean(r) && typeof r === "object")
    .map((r) => {
      const option = typeof r.id === "string" ? findLeaveOut(r.id) : undefined
      if (!option) return null
      return { id: option.id, label: option.label, leftOut: typeof r.leftOut === "boolean" ? r.leftOut : null }
    })
    .filter((r): r is LeaveOutResult => r !== null)
}

/** The picks behind a design's results, for Try again. */
export function leaveOutPicks(results: LeaveOutResult[] | undefined): string[] {
  return cleanLeaveOut((results || []).map((r) => r.id))
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** "We couldn't leave out the rug this time." or "" when everything was left out. */
export function stillInMessage(results: LeaveOutResult[]): string {
  const still = results.filter((r) => r.leftOut === false).map((r) => `the ${r.label.toLowerCase().replace(/^tv /, "TV ")}`)
  if (still.length === 0) return ""
  return `We couldn't leave out ${joinNames(still)} this time.`
}
