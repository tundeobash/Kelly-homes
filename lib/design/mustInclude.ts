/**
 * "Must include": pieces a person needs in a design, such as a dining table
 * (item 3 of the 28 Oct 2026 build list). Shared by the design screen and the
 * stage-room route, so it stays free of React and server code.
 */

/** At most this many pieces per design (Ayo, 28 Oct 2026). */
export const MUST_INCLUDE_LIMIT = 3

export interface MustIncludeOption {
  id: string
  label: string
  /** What the image model is told to include. */
  instruction: string
  /** Words the furnishing check accepts as this piece when it gives no direct answer. */
  terms: string[]
}

export const MUST_INCLUDE_OPTIONS: MustIncludeOption[] = [
  {
    id: "dining-table",
    label: "Dining table",
    instruction: "a dining table with chairs (if space is tight, a compact round table for two or four)",
    terms: ["dining table", "dining set", "dining"],
  },
  {
    id: "desk",
    label: "Desk",
    instruction: "a desk with a chair (if space is tight, a slim desk against a wall)",
    terms: ["desk", "workstation", "writing table"],
  },
  {
    id: "tv-unit",
    label: "TV unit",
    instruction: "a TV unit or media console (if space is tight, a slim wall-mounted unit)",
    terms: ["tv unit", "tv stand", "tv console", "tv cabinet", "media console", "media unit", "media cabinet", "entertainment"],
  },
  {
    id: "armchair",
    label: "Armchair",
    instruction: "an armchair",
    terms: ["armchair", "accent chair", "lounge chair", "club chair"],
  },
  {
    id: "storage",
    label: "Storage",
    instruction: "a storage piece such as a cabinet, sideboard or chest of drawers",
    terms: ["cabinet", "sideboard", "storage", "dresser", "chest of drawers", "credenza", "drawers"],
  },
  {
    id: "bookshelf",
    label: "Bookshelf",
    instruction: "a bookshelf",
    terms: ["bookshelf", "bookcase", "shelving", "shelves", "shelf"],
  },
  {
    id: "floor-seating",
    label: "Floor seating",
    instruction: "low floor seating, such as floor cushions or majlis-style seating",
    terms: ["floor cushion", "floor seating", "majlis", "floor pillow", "floor sofa", "pouf"],
  },
]

/** One must-have on a saved design. included is null when the check did not run. */
export interface MustIncludeResult {
  id: string
  label: string
  included: boolean | null
}

export function findMustInclude(id: string): MustIncludeOption | undefined {
  return MUST_INCLUDE_OPTIONS.find((option) => option.id === id)
}

/** Known ids only, no repeats, at most the limit, in the order given. */
export function cleanMustInclude(value: unknown, limit = MUST_INCLUDE_LIMIT): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const id = item.trim().toLowerCase()
    if (!findMustInclude(id) || out.includes(id)) continue
    out.push(id)
    if (out.length >= limit) break
  }
  return out
}

/** Tapping a button: removes it if picked, else adds it unless the limit is reached. */
export function toggleMustInclude(current: string[], id: string, limit = MUST_INCLUDE_LIMIT): string[] {
  if (current.includes(id)) return current.filter((x) => x !== id)
  if (!findMustInclude(id) || current.length >= limit) return current
  return [...current, id]
}

/** The pieces to ask for and check: the person's picks, plus a dining table for a living and dining room. */
export function piecesToCheck(picked: string[], roomType: string | null | undefined): string[] {
  const ids = cleanMustInclude(picked)
  if (roomType === "living and dining room" && !ids.includes("dining-table")) return [...ids, "dining-table"]
  return ids
}

/** The instruction line for the image model, or "" when nothing is asked for. */
export function mustIncludeInstruction(ids: string[]): string {
  const options = ids.map(findMustInclude).filter((o): o is MustIncludeOption => Boolean(o))
  if (options.length === 0) return ""
  return [
    `The customer needs these pieces in the room: ${options.map((o) => o.instruction).join("; ")}.`,
    "Each one must be clearly visible in the finished photo. If space is tight, choose compact versions rather than leaving any out, and still keep doorways and walkways clear.",
  ].join(" ")
}

function hasTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|[^a-z])${escaped}(s|es)?($|[^a-z])`).test(text)
}

/**
 * Whether each must-have is in the design: the furnishing check's direct answer
 * when it gave one, else a match in its list of visible furniture.
 */
export function checkMustIncludes(
  inspection: { furniture: string[]; mustHave?: Record<string, boolean> },
  ids: string[]
): MustIncludeResult[] {
  const furniture = inspection.furniture.join(" | ").toLowerCase()
  const answers = inspection.mustHave || {}
  return ids
    .map(findMustInclude)
    .filter((o): o is MustIncludeOption => Boolean(o))
    .map((option) => {
      const answer = answers[option.label.toLowerCase()]
      const included = typeof answer === "boolean" ? answer : option.terms.some((term) => hasTerm(furniture, term))
      return { id: option.id, label: option.label, included }
    })
}

/** Results for pieces the check did not run on (no Gemini key). */
export function uncheckedMustIncludes(ids: string[]): MustIncludeResult[] {
  return ids
    .map(findMustInclude)
    .filter((o): o is MustIncludeOption => Boolean(o))
    .map((option) => ({ id: option.id, label: option.label, included: null }))
}

/** The results saved on a design, cleaned. Older designs have none. */
export function readMustIncludeResults(value: unknown): MustIncludeResult[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((r): r is { id: unknown; included?: unknown } => Boolean(r) && typeof r === "object")
    .map((r) => {
      const option = typeof r.id === "string" ? findMustInclude(r.id) : undefined
      if (!option) return null
      const included = typeof r.included === "boolean" ? r.included : null
      return { id: option.id, label: option.label, included }
    })
    .filter((r): r is MustIncludeResult => r !== null)
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** "We couldn't fit the dining table this time." or "" when nothing is missing. */
export function missingMessage(results: MustIncludeResult[]): string {
  const missing = results.filter((r) => r.included === false).map((r) => r.label.toLowerCase().replace(/^tv /, "TV "))
  if (missing.length === 0) return ""
  return `We couldn't fit the ${joinNames(missing)} this time.`
}

/** The person's own picks behind a design's results (a living and dining room's dining table is automatic). */
export function picksFromResults(results: MustIncludeResult[] | undefined, roomType: string | null | undefined): string[] {
  const livingDining = (roomType || "").trim().toLowerCase() === "living and dining room"
  return cleanMustInclude((results || []).map((r) => r.id).filter((id) => !(livingDining && id === "dining-table")))
}
