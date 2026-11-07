import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  HOME_TIMINGS,
  canSendHomeQuote,
  chosenDesign,
  cleanTiming,
  designWhen,
  homeQuoteMessage,
  homeTotal,
  homeTotalLabel,
  roomEstimate,
  roomsWithDesigns,
  showHomeQuote,
  tiersPhrase,
} from "../lib/design/homeQuote"
import type { HomeRoom } from "../lib/design/homeQuote"
import { quoteRequestLink } from "../lib/landing"
import { TRACKED_EVENTS } from "../lib/tracking"
import type { DetectedPiece } from "../lib/design/pieceEdit"

const box = { top: 0.4, left: 0.1, bottom: 0.6, right: 0.3 }
const point = { x: 0.2, y: 0.5 }
function piece(id: string, name: string, kind: string, count?: number): DetectedPiece {
  return { id, name, kind, box, point, ...(count ? { count } : {}) }
}

const living: HomeRoom = {
  id: "r1",
  name: "Living room",
  budget: "mid",
  designs: [
    { id: "d2", imageUrl: "https://blob.example/d2.jpg", style: "industrial", createdAt: "2026-11-07T10:00:00Z", detected: [piece("p1", "leather corner sofa", "sofa"), piece("p2", "curtains", "curtains")] },
    { id: "d1", imageUrl: "https://blob.example/d1.jpg", style: "minimalist", createdAt: "2026-11-06T10:00:00Z", detected: null },
  ],
}
const bedroom: HomeRoom = {
  id: "r2",
  name: "Bedroom",
  budget: null,
  designs: [{ id: "d3", imageUrl: "https://blob.example/d3.jpg", style: "japandi", detected: [piece("p1", "king bed", "bed"), piece("p2", "bedside tables", "bedside table", 2)] }],
}
const empty: HomeRoom = { id: "r3", name: "Office", budget: "premium", designs: [] }

describe("get a quote for my home", () => {
  it("shows from two rooms with designs", () => {
    assert.equal(showHomeQuote([living, empty]), false)
    assert.equal(showHomeQuote([living, bedroom, empty]), true)
    assert.deepEqual(roomsWithDesigns([living, empty, bedroom]).map((r) => r.id), ["r1", "r2"])
  })

  it("uses the latest design unless another is picked", () => {
    assert.equal(chosenDesign(living)?.id, "d2")
    assert.equal(chosenDesign(living, "d1")?.id, "d1")
    assert.equal(chosenDesign(living, "gone")?.id, "d2")
    assert.equal(chosenDesign(empty), null)
  })

  it("prices each room at its own budget, mid-range when none is picked", () => {
    const l = roomEstimate(living.budget, living.designs[0].detected)
    assert.equal(l.tier, "mid")
    assert.deepEqual(l.range, [10147, 15645]) // corner sofa; mid-range curtains are left to the quote
    assert.equal(l.known, true)
    const b = roomEstimate(bedroom.budget, bedroom.designs[0].detected)
    assert.equal(b.tier, "mid")
    assert.deepEqual(b.range, [4640 + 2 * 1270, 6720 + 2 * 2312])
    const affordable = roomEstimate("affordable", living.designs[0].detected)
    assert.deepEqual(affordable.range, [4345 + 167, 6042 + 364])
    assert.deepEqual(roomEstimate("mid", null), { tier: "mid", range: null, known: false })
    assert.deepEqual(roomEstimate("mid", [piece("p1", "scatter cushions", "cushions")]), { tier: "mid", range: null, known: true })
  })

  it("adds rooms up and counts the ones left to the quote", () => {
    const total = homeTotal([[10147, 15645], null, [7180, 11344]])
    assert.deepEqual(total, { low: 17327, high: 26989, priced: 2, open: 1 })
    assert.equal(homeTotalLabel(total), "AED 17,000–27,000")
    assert.equal(homeTotalLabel(homeTotal([null])), null)
    assert.equal(tiersPhrase(["mid", "mid"]), "at mid-range shop prices")
    assert.equal(tiersPhrase(["mid", "affordable"]), "at each room's budget")
  })

  it("reads the timing and dates plainly", () => {
    assert.deepEqual(HOME_TIMINGS.map((t) => t.label), ["Within a month", "1–3 months", "Later", "Just looking"])
    assert.equal(cleanTiming("month"), "month")
    assert.equal(cleanTiming("soon"), null)
    const now = new Date("2026-11-07T18:00:00Z")
    assert.equal(designWhen("2026-11-07T10:00:00Z", now), "Today")
    assert.equal(designWhen("2026-11-06T10:00:00Z", now), "Yesterday")
    assert.equal(designWhen(null, now), "")
  })

  it("sends one message with every room, its design and our estimate", () => {
    const request = {
      rooms: [
        { name: "Living room", style: "industrial", tier: "mid" as const, range: [10147, 15645] as [number, number], designUrl: "https://blob.example/d2.jpg" },
        { name: " Bedroom ", style: "japandi", tier: "affordable" as const, range: null, designUrl: "https://blob.example/d3.jpg" },
      ],
      timing: "month" as const,
      notes: "  Al Barsha,\n 6th floor,   service lift ",
    }
    assert.equal(canSendHomeQuote(request), true)
    assert.equal(canSendHomeQuote({ rooms: [] }), false)
    assert.equal(
      homeQuoteMessage(request),
      [
        "Hello, I'd like a quote for my home (2 rooms).",
        "Needed: within a month",
        "Our estimate: AED 10,000–16,000 at each room's budget; 1 more room to price",
        "1. Living room (Industrial), mid-range, AED 10,000–16,000",
        "Design: https://blob.example/d2.jpg",
        "2. Bedroom (Japandi), affordable, priced in your quote",
        "Design: https://blob.example/d3.jpg",
        "Notes: Al Barsha, 6th floor, service lift",
      ].join("\n")
    )
    const bare = homeQuoteMessage({ rooms: [request.rooms[1]], timing: null, notes: "" })
    assert.equal(bare.split("\n")[0], "Hello, I'd like a quote for my home (1 room).")
    assert.ok(!bare.includes("Needed:") && !bare.includes("Our estimate") && !bare.includes("Notes:"))
    assert.match(quoteRequestLink(homeQuoteMessage(request), "", "hello@example.com") ?? "", /^mailto:hello@example\.com\?/)
  })

  it("counts the sheet being opened and the request being sent", () => {
    assert.ok((TRACKED_EVENTS as readonly string[]).includes("quote_home_opened"))
    assert.ok((TRACKED_EVENTS as readonly string[]).includes("quote_home_sent"))
  })
})
