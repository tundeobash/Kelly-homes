import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PRICE_KINDS,
  estimateFor,
  estimateQuoteLine,
  estimateSummary,
  estimateTier,
  formatRange,
  formatTotal,
  priceKindFor,
} from "../lib/design/estimate"
import { quoteItemsFor, quoteMessage } from "../lib/design/quote"
import type { DetectedPiece } from "../lib/design/pieceEdit"

const box = { top: 0.4, left: 0.1, bottom: 0.6, right: 0.3 }
const point = { x: 0.2, y: 0.5 }
function piece(id: string, name: string, kind: string, count?: number): DetectedPiece {
  return { id, name, kind, box, point, ...(count ? { count } : {}) }
}

// The Industrial living room from the sketch (29 Oct 2026).
const room: DetectedPiece[] = [
  piece("p1", "leather corner sofa", "sofa"),
  piece("p2", "concrete coffee table", "coffee table"),
  piece("p3", "leather pouf", "pouf"),
  piece("p4", "wooden tv unit", "tv unit"),
  piece("p5", "dark woven rug", "rug"),
  piece("p6", "cage floor lamp", "floor lamp"),
  piece("p7", "metal pendant light", "pendant light"),
  piece("p8", "black and white prints", "wall art", 2),
  piece("p9", "curtains", "curtains"),
  piece("p10", "leather bar stools", "bar stool", 2),
]

describe("instant estimate", () => {
  it("knows what kind of piece each one is", () => {
    const kind = (name: string, k = "") => priceKindFor({ name, kind: k })?.id ?? null
    assert.equal(kind("leather corner sofa", "sofa"), "corner-sofa")
    assert.equal(kind("velvet sofa", "sofa"), "sofa")
    assert.equal(kind("sofa bed", "sofa"), "sofa")
    assert.equal(kind("bedside table", "table"), "bedside-table")
    assert.equal(kind("bedside lamp", "lamp"), "lamp")
    assert.equal(kind("desk lamp", "lamp"), "lamp")
    assert.equal(kind("cage floor lamp", "floor lamp"), "floor-lamp")
    assert.equal(kind("metal pendant light", "pendant light"), "pendant")
    assert.equal(kind("arched floor mirror", "mirror"), "mirror")
    assert.equal(kind("wooden tv unit", "tv unit"), "tv-unit")
    assert.equal(kind("console table", "table"), "sideboard")
    assert.equal(kind("black and white prints", "wall art"), "wall-art")
    assert.equal(kind("king bed", "bed"), "bed")
    assert.equal(kind("bed frame", "bed"), "bed")
    assert.equal(kind("potted olive tree", "plant"), "plant")
    assert.equal(kind("leather bar stools", "bar stool"), "bar-stool")
    assert.equal(kind("upholstered dining chairs", "chair"), "dining-chair")
    assert.equal(kind("accent chair", "chair"), "armchair")
    assert.equal(kind("television", "tv"), null)
    assert.equal(kind("scatter cushions", "cushions"), null)
  })

  it("has lower prices for cheaper tiers wherever all three are known", () => {
    for (const kind of PRICE_KINDS) {
      const { affordable, mid, premium } = kind.price
      for (const range of [affordable, mid, premium]) if (range) assert.ok(range[0] <= range[1], kind.id)
      if (affordable && mid) assert.ok(affordable[0] < mid[0], `${kind.id} affordable < mid`)
      if (mid && premium) assert.ok(mid[0] < premium[0], `${kind.id} mid < premium`)
    }
  })

  it("shows the room's budget, or mid-range when none is picked", () => {
    assert.equal(estimateTier("affordable"), "affordable")
    assert.equal(estimateTier("premium"), "premium")
    assert.equal(estimateTier("unsure"), "mid")
    assert.equal(estimateTier(null), "mid")
  })

  it("adds up the sketch room at each tier, leaving gaps to the quote", () => {
    const mid = estimateFor(room, "mid")
    assert.equal(formatTotal(mid.low, mid.high), "AED 20,000–33,000")
    assert.equal(mid.priced, 8)
    assert.equal(mid.open, 2)
    assert.equal(estimateSummary(mid, "mid"), "For 8 pieces at mid-range prices. 2 more are priced in your quote.")

    const affordable = estimateFor(room, "affordable")
    assert.equal(formatTotal(affordable.low, affordable.high), "AED 6,500–11,500")
    assert.equal(affordable.open, 0)

    const premium = estimateFor(room, "premium")
    assert.equal(formatTotal(premium.low, premium.high), "AED 51,000–85,500")
    assert.equal(premium.open, 1)
  })

  it("counts pairs and leaves unticked pieces out of the total", () => {
    const stools = estimateFor([room[9]], "affordable")
    assert.deepEqual(stools.lines[0].range, [374, 790])
    const without = estimateFor(room, "mid", ["p1"])
    assert.equal(without.ticked, 9)
    assert.equal(without.lines.length, 10)
    assert.equal(formatTotal(without.low, without.high), "AED 9,500–17,500")
  })

  it("formats ranges plainly", () => {
    assert.equal(formatRange([10147, 15645]), "10,100–15,600")
    assert.equal(formatRange([177, 549]), "180–550")
    assert.equal(formatTotal(1234, 2345), "AED 1,200–2,400")
  })

  it("puts the found pieces and the estimate in the quote request", () => {
    const items = quoteItemsFor({ piece: null, pieceIncluded: null, mustInclude: [{ id: "tv-unit", label: "TV unit", included: true }] }, [
      piece("p1", "leather corner sofa", "sofa"),
      piece("p2", "tv unit", "tv unit"),
      piece("p10", "leather bar stools", "bar stool", 2),
    ])
    assert.deepEqual(
      items.map((i) => i.id),
      ["must:tv-unit", "found:p1", "found:p10"]
    )
    assert.equal(items[2].label, "Leather bar stools (2)")

    const line = estimateQuoteLine(estimateFor(room, "mid"), "mid")
    assert.equal(line, "Our estimate: AED 20,000–33,000 at mid-range shop prices (8 pieces; 2 more to price)")
    const message = quoteMessage({
      roomName: "Living room",
      styleName: "Industrial",
      designUrl: "https://abc.public.blob.vercel-storage.com/generated/d.png",
      wholeRoom: true,
      items: [],
      other: "",
      estimate: line,
    })
    assert.match(message, /\nOur estimate: AED 20,000–33,000/)
    assert.equal(estimateQuoteLine(estimateFor([piece("x", "cushions", "decor")], "mid"), "mid"), null)
  })
})
