/**
 * Budget bands (item 5 of the 28 Oct 2026 build list; decided by Ayo on 29 Oct).
 * The person picks a band on the style step and can change it on the result.
 * The budget does NOT change the design picture (people can't see material
 * differences in a picture): it goes into the quote and, later, into matching
 * real pieces. Free of React and server code so it can be tested.
 *
 * The AED bands come from a typical basket per room (living room: sofa, armchair,
 * coffee and side table, TV unit, rug, floor lamp, curtains, decor) priced at
 * IKEA UAE, 2XL Home and BoConcept UAE on 29 Oct 2026. They cover furniture,
 * rugs, lighting, curtains and decor, not delivery or fitting. Bedroom and office
 * are mostly estimates; see docs/DECISIONS.md.
 */

export type BudgetTier = "affordable" | "mid" | "premium" | "unsure"

export const BUDGET_TIERS: { id: BudgetTier; label: string; what: string }[] = [
  { id: "affordable", label: "Affordable", what: "Good-value pieces that last." },
  { id: "mid", label: "Mid-range", what: "Better materials, a statement piece or two." },
  { id: "premium", label: "Premium", what: "Designer pieces and made-to-measure." },
  { id: "unsure", label: "Not sure yet", what: "Your quote shows options at each budget." },
]

/** Where Affordable ends and where Premium starts, in AED, per kind of room. */
const BANDS: Record<string, [number, number]> = {
  "living room": [12_000, 30_000],
  "living and dining room": [18_000, 50_000],
  bedroom: [10_000, 30_000],
  "dining room": [8_000, 25_000],
  office: [6_000, 20_000],
}

/** The kind of room the bands are kept under, or null (kitchen, other) when there is no band. */
export function budgetRoomKey(roomType: string | null | undefined): string | null {
  const t = (roomType || "").trim().toLowerCase()
  if (!t) return null
  if (/(living|lounge|majlis)/.test(t) && /dining/.test(t)) return "living and dining room"
  if (/(living|lounge|majlis|family room|sitting)/.test(t)) return "living room"
  if (/bed ?room/.test(t)) return "bedroom"
  if (/dining/.test(t)) return "dining room"
  if (/(office|study)/.test(t)) return "office"
  return null
}

export function cleanBudget(value: unknown): BudgetTier | null {
  return value === "affordable" || value === "mid" || value === "premium" || value === "unsure" ? value : null
}

export function budgetLabel(tier: BudgetTier): string {
  return BUDGET_TIERS.find((t) => t.id === tier)?.label ?? ""
}

function aed(n: number): string {
  return `AED ${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
}

/** "Up to AED 12,000", "AED 12,000–30,000", "AED 30,000+"; "" for Not sure; a note for rooms without a band. */
export function budgetPrice(roomType: string | null | undefined, tier: BudgetTier): string {
  if (tier === "unsure") return ""
  const key = budgetRoomKey(roomType)
  const band = key ? BANDS[key] : null
  if (!band) return "Priced in your quote"
  const [low, high] = band
  if (tier === "affordable") return `Up to ${aed(low)}`
  if (tier === "mid") return `${aed(low)}–${aed(high).replace("AED ", "")}`
  return `${aed(high)}+`
}

/** Whether this kind of room has AED bands. */
export function hasBudgetBands(roomType: string | null | undefined): boolean {
  const key = budgetRoomKey(roomType)
  return Boolean(key && BANDS[key])
}

/** One line for the style step and the result: "Mid-range · AED 12,000–30,000". */
export function budgetSummary(roomType: string | null | undefined, tier: BudgetTier | null): string {
  if (!tier) return "Optional. It helps us price your quote."
  if (tier === "unsure") return "Not sure yet"
  const price = budgetPrice(roomType, tier)
  return price && hasBudgetBands(roomType) ? `${budgetLabel(tier)} · ${price}` : budgetLabel(tier)
}

/** What the bands cover, for the budget sheet. */
export function budgetCoverage(roomType: string | null | undefined): string {
  const key = budgetRoomKey(roomType)
  return key ? `For this ${key}: furniture, rugs, lighting and curtains.` : "For this room: furniture, rugs, lighting and curtains."
}

/** The line added to a quote request, or null when no budget was picked. */
export function budgetQuoteLine(roomType: string | null | undefined, tier: BudgetTier | null): string | null {
  if (!tier) return null
  if (tier === "unsure") return "Budget: not sure yet, please show options at each budget"
  const price = budgetPrice(roomType, tier)
  return hasBudgetBands(roomType) ? `Budget: ${budgetLabel(tier)} (${price} for this room)` : `Budget: ${budgetLabel(tier)}`
}
