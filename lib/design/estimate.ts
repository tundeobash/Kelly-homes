/**
 * Instant estimate on every design (tester feedback 29 Oct 2026: "can a base-case quote
 * pop up immediately, to know if I should continue dreaming or not? Then later I can
 * pick what I want"). Agreed with Ayo 29 Oct.
 *
 * The pieces found in a design (lib/design/pieceEdit.ts) are priced from typical UAE
 * shop prices per kind of piece and budget tier. Ranges only, never one figure; they
 * cover the pieces, not delivery, fitting or made-to-measure work. Where there is no
 * typical price, the piece is "priced in your quote" rather than guessed.
 *
 * Prices: 25th to 75th percentile of listed regular prices, AED incl. VAT, first page of
 * each live category on 29 Oct 2026. Affordable = IKEA UAE, Mid-range = 2XL Home,
 * Premium = BoConcept UAE. Where only a listed min-max range was taken, that is used
 * (marked "listed range"). Full table: claude/kelly-spaces-price-table.md (Kelly Spaces project).
 *
 * Free of React and server code so it can be tested.
 */

import type { DetectedPiece } from "@/lib/design/pieceEdit"
import type { BudgetTier } from "@/lib/design/budget"

export type PriceTier = "affordable" | "mid" | "premium"
type Range = [number, number] | null

export const PRICES_CHECKED = "Oct 2026"

interface PriceKind {
  id: string
  /** Tested in order against the piece's name and kind; the first kind that matches wins. */
  match: RegExp
  price: Record<PriceTier, Range>
}

export const PRICE_KINDS: PriceKind[] = [
  { id: "floor-lamp", match: /floor lamp|standing lamp|arc lamp|floor light/, price: { affordable: [136, 299], mid: [570, 1075], premium: [2320, 3858] } },
  { id: "chandelier", match: /chandelier/, price: { affordable: null, mid: [2269, 3620], premium: null } },
  // Mid is thin: one pendant (479) to the chandeliers' 25th percentile.
  { id: "pendant", match: /pendant|ceiling light|ceiling lamp|hanging light|hanging lamp|light fitting|ceiling fixture/, price: { affordable: [99, 299], mid: [479, 2269], premium: [3399, 4752] } },
  { id: "lamp", match: /\blamps?\b(?! table)|sconce|wall light/, price: { affordable: [50, 149], mid: [352, 684], premium: [1776, 2991] } },
  { id: "bedside-table", match: /bedside|night ?stand|night table/, price: { affordable: [199, 445], mid: [1270, 2312], premium: [1859, 3089] } },
  { id: "office-chair", match: /office chair|desk chair|task chair|gaming chair/, price: { affordable: [695, 1320], mid: null, premium: [3446, 4022] } },
  // Listed ranges: thin samples.
  { id: "dining-chair", match: /dining chair|kitchen chair|dining armchair|dining seat/, price: { affordable: [140, 350], mid: [469, 1250], premium: [1959, 5199] } },
  { id: "bar-stool", match: /bar stool|counter stool|barstool|\bstools?\b/, price: { affordable: [187, 395], mid: null, premium: [2029, 2709] } },
  { id: "pouf", match: /pouf|pouffe|ottoman|footstool|foot stool/, price: { affordable: [195, 595], mid: [1375, 1650], premium: [3319, 7284] } },
  { id: "corner-sofa", match: /corner sofa|sectional|l-shaped|l shaped|modular sofa|chaise sofa/, price: { affordable: [4345, 6042], mid: [10147, 15645], premium: [18390, 37290] } },
  { id: "sofa", match: /sofa|couch|settee|loveseat|love seat|majlis seating|floor seating|daybed/, price: { affordable: [2370, 3854], mid: [6820, 7445], premium: [11365, 18215] } },
  { id: "armchair", match: /armchair|arm chair|accent chair|lounge chair|club chair|wingback|recliner|swivel chair|reading chair|rocking chair/, price: { affordable: [295, 995], mid: [2595, 3568], premium: [6529, 10465] } },
  { id: "coffee-table", match: /coffee table|cent(re|er) table|cocktail table/, price: { affordable: [177, 549], mid: [1536, 3920], premium: [3099, 5574] } },
  // Listed ranges for affordable and mid (no percentiles taken).
  { id: "side-table", match: /side table|end table|accent table|nesting table|nest of tables|lamp table/, price: { affordable: [35, 345], mid: [229, 795], premium: [3024, 3284] } },
  { id: "dining-table", match: /dining table|kitchen table|breakfast table|dinner table/, price: { affordable: [595, 2795], mid: [3395, 12895], premium: [12290, 22390] } },
  { id: "tv-unit", match: /tv unit|tv stand|tv cabinet|tv console|tv bench|media unit|media console|media cabinet|entertainment unit/, price: { affordable: [495, 1495], mid: [3295, 4095], premium: [6249, 8829] } },
  { id: "sideboard", match: /sideboard|buffet|credenza|console table|console|cabinet|storage unit/, price: { affordable: [850, 1411], mid: [5370, 7195], premium: [8779, 13490] } },
  { id: "dresser", match: /dresser|chest of drawers|chest|drawers|vanity/, price: { affordable: [470, 1047], mid: [5070, 6920], premium: [8846, 10337] } },
  { id: "rug", match: /\brugs?\b|carpet|kilim|dhurrie|runner/, price: { affordable: [424, 624], mid: [1382, 1532], premium: [4769, 6799] } },
  // Above Affordable, curtains are made to measure: priced in the quote.
  { id: "curtains", match: /curtain|drape|blind|sheer/, price: { affordable: [167, 364], mid: null, premium: null } },
  { id: "mirror", match: /mirror/, price: { affordable: [160, 302], mid: [844, 1305], premium: [1555, 1861] } },
  { id: "wall-art", match: /wall art|\bart\b|artwork|prints?\b|painting|poster|canvas|picture|photo frame|framed/, price: { affordable: [65, 145], mid: [649, 1295], premium: [2749, 2759] } },
  { id: "plant", match: /plant|tree|palm|olive|fern|monstera|ficus|bonsai|greenery/, price: { affordable: [108, 175], mid: [469, 1295], premium: null } },
  // Mid has only two products (and costs more than premium bookcases): priced in the quote.
  { id: "shelving", match: /bookcase|bookshelf|book shelf|shelving|shelf|shelves|etagere|display unit|wall unit/, price: { affordable: [218, 730], mid: null, premium: [1959, 3899] } },
  // Listed range for affordable (no percentiles taken).
  { id: "bed", match: /\bbeds?\b|bed frame|headboard/, price: { affordable: [545, 3495], mid: [4640, 6720], premium: [5424, 9206] } },
  { id: "desk", match: /\bdesk\b|writing table|workstation/, price: { affordable: [422, 1030], mid: null, premium: [5084, 7970] } },
  { id: "bench", match: /bench/, price: { affordable: [287, 622], mid: [1695, 3232], premium: [3556, 4212] } },
  { id: "chair", match: /\bchairs?\b/, price: { affordable: [295, 995], mid: [2595, 3568], premium: [6529, 10465] } },
]

/** The tier the estimate shows: the room's budget, or mid-range when none is picked. */
export function estimateTier(budget: BudgetTier | null | undefined): PriceTier {
  return budget === "affordable" || budget === "premium" ? budget : "mid"
}

export const TIER_LABELS: Record<PriceTier, string> = { affordable: "Affordable", mid: "Mid-range", premium: "Premium" }

/** The kind of piece used for pricing, or null when there is no price for it. */
export function priceKindFor(piece: { name: string; kind: string }): PriceKind | null {
  const text = `${piece.name} ${piece.kind}`.toLowerCase()
  if (/\b(tv|television|screen)\b/.test(text) && !/unit|stand|cabinet|console|bench/.test(text)) return null
  return PRICE_KINDS.find((k) => k.match.test(text)) ?? null
}

export interface EstimateLine {
  piece: DetectedPiece
  qty: number
  /** For all of them together; null = priced in the quote. */
  range: [number, number] | null
}

export interface Estimate {
  lines: EstimateLine[]
  /** Ticked pieces with a price, summed. */
  low: number
  high: number
  /** Ticked pieces with and without a typical price. */
  priced: number
  open: number
  ticked: number
}

export function pieceCount(piece: DetectedPiece): number {
  return piece.count && piece.count > 1 ? piece.count : 1
}

/** Prices every piece; totals cover the ticked ones (all but `excluded`). */
export function estimateFor(pieces: DetectedPiece[], tier: PriceTier, excluded: string[] = []): Estimate {
  const out: Estimate = { lines: [], low: 0, high: 0, priced: 0, open: 0, ticked: 0 }
  for (const piece of pieces) {
    const qty = pieceCount(piece)
    const kind = priceKindFor(piece)
    const each = kind ? kind.price[tier] : null
    const range: [number, number] | null = each ? [each[0] * qty, each[1] * qty] : null
    out.lines.push({ piece, qty, range })
    if (excluded.includes(piece.id)) continue
    out.ticked += 1
    if (range) {
      out.low += range[0]
      out.high += range[1]
      out.priced += 1
    } else {
      out.open += 1
    }
  }
  return out
}

function grouped(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/** "AED 20,000–33,000": rounded out to the nearest 500 (100 under AED 5,000). */
export function formatTotal(low: number, high: number): string {
  const step = high < 5000 ? 100 : 500
  const lo = Math.floor(low / step) * step
  const hi = Math.max(lo + step, Math.ceil(high / step) * step)
  return `AED ${grouped(lo)}–${grouped(hi)}`
}

/** One piece's range: "10,100–15,600". */
export function formatRange(range: [number, number]): string {
  const step = range[1] < 1000 ? 10 : 100
  return `${grouped(Math.round(range[0] / step) * step)}–${grouped(Math.round(range[1] / step) * step)}`
}

/** "For 8 pieces at mid-range prices. 2 more are priced in your quote." */
export function estimateSummary(estimate: Estimate, tier: PriceTier): string {
  const tierWords = `${TIER_LABELS[tier].toLowerCase()} prices`
  const priced = estimate.priced === 1 ? "1 piece" : `${estimate.priced} pieces`
  const open = estimate.open === 0 ? "" : estimate.open === 1 ? " 1 more is priced in your quote." : ` ${estimate.open} more are priced in your quote.`
  return `For ${priced} at ${tierWords}.${open}`
}

/** The line added to a quote request, or null when nothing could be priced. */
export function estimateQuoteLine(estimate: Estimate, tier: PriceTier): string | null {
  if (estimate.priced === 0) return null
  const open = estimate.open > 0 ? `; ${estimate.open} more to price` : ""
  return `Our estimate: ${formatTotal(estimate.low, estimate.high)} at ${TIER_LABELS[tier].toLowerCase()} shop prices (${estimate.priced} pieces${open})`
}

/** "Leather corner sofa" */
export function pieceTitle(piece: Pick<DetectedPiece, "name">): string {
  const name = piece.name.trim()
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "Piece"
}
