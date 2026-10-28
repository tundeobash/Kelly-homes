import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BUDGET_TIERS,
  budgetCoverage,
  budgetPrice,
  budgetQuoteLine,
  budgetRoomKey,
  budgetSummary,
  cleanBudget,
  hasBudgetBands,
} from "../lib/design/budget"
import { quoteMessage } from "../lib/design/quote"
import { isTrackedEvent } from "../lib/tracking"

describe("budget bands", () => {
  it("offers Affordable, Mid-range, Premium and Not sure yet, in that order", () => {
    assert.deepEqual(
      BUDGET_TIERS.map((t) => t.label),
      ["Affordable", "Mid-range", "Premium", "Not sure yet"]
    )
  })

  it("shows the living room bands agreed on 29 Oct", () => {
    assert.equal(budgetPrice("living room", "affordable"), "Up to AED 12,000")
    assert.equal(budgetPrice("living room", "mid"), "AED 12,000–30,000")
    assert.equal(budgetPrice("living room", "premium"), "AED 30,000+")
    assert.equal(budgetPrice("living room", "unsure"), "")
  })

  it("has bands for each kind of room with furniture", () => {
    assert.equal(budgetPrice("living and dining room", "mid"), "AED 18,000–50,000")
    assert.equal(budgetPrice("bedroom", "affordable"), "Up to AED 10,000")
    assert.equal(budgetPrice("dining room", "premium"), "AED 25,000+")
    assert.equal(budgetPrice("office", "mid"), "AED 6,000–20,000")
  })

  it("leaves kitchens and other rooms to the quote", () => {
    assert.equal(hasBudgetBands("kitchen"), false)
    assert.equal(hasBudgetBands("other"), false)
    assert.equal(budgetPrice("kitchen", "mid"), "Priced in your quote")
    assert.equal(budgetSummary("kitchen", "mid"), "Mid-range")
  })

  it("reads older and free-text room types", () => {
    assert.equal(budgetRoomKey("Living Room"), "living room")
    assert.equal(budgetRoomKey("majlis"), "living room")
    assert.equal(budgetRoomKey("Lounge and dining"), "living and dining room")
    assert.equal(budgetRoomKey("guest bedroom"), "bedroom")
    assert.equal(budgetRoomKey("study"), "office")
    assert.equal(budgetRoomKey(""), null)
  })

  it("keeps only known tiers", () => {
    assert.equal(cleanBudget("mid"), "mid")
    assert.equal(cleanBudget("luxury"), null)
    assert.equal(cleanBudget(null), null)
  })

  it("sums up the choice for the style step and the result", () => {
    assert.equal(budgetSummary("living room", "mid"), "Mid-range · AED 12,000–30,000")
    assert.equal(budgetSummary("living room", "unsure"), "Not sure yet")
    assert.equal(budgetSummary("living room", null), "Optional. It helps us price your quote.")
    assert.equal(budgetCoverage("bedroom"), "For this bedroom: furniture, rugs, lighting and curtains.")
  })

  it("adds the budget to quote requests", () => {
    const line = budgetQuoteLine("living room", "premium")
    assert.equal(line, "Budget: Premium (AED 30,000+ for this room)")
    assert.equal(budgetQuoteLine("kitchen", "affordable"), "Budget: Affordable")
    assert.equal(budgetQuoteLine("living room", "unsure"), "Budget: not sure yet, please show options at each budget")
    assert.equal(budgetQuoteLine("living room", null), null)

    const message = quoteMessage({
      roomName: "Living room",
      styleName: "Industrial",
      designUrl: "https://abc.public.blob.vercel-storage.com/generated/d.png",
      wholeRoom: true,
      items: [],
      other: "",
      budget: line,
    })
    assert.match(message, /\nBudget: Premium \(AED 30,000\+ for this room\)\n/)
  })

  it("counts budget and Change a piece actions", () => {
    for (const name of ["budget_set", "change_opened", "piece_swapped", "piece_moved", "piece_removed"]) {
      assert.equal(isTrackedEvent(name), true, name)
    }
  })
})
