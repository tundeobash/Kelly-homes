import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MUST_INCLUDE_LIMIT,
  MUST_INCLUDE_OPTIONS,
  checkMustIncludes,
  cleanMustInclude,
  missingMessage,
  mustIncludeInstruction,
  picksFromResults,
  piecesToCheck,
  readMustIncludeResults,
  toggleMustInclude,
  uncheckedMustIncludes,
} from "../lib/design/mustInclude"
import {
  assessRoomOutput,
  buildInspectionPrompt,
  getRoomGuide,
  normalizeRoomType,
  parseRoomInspection,
} from "../lib/ai/roomFurnishing"
import { buildOpenAIEditInstruction, CLEARANCE_RULE } from "../lib/ai/openaiRenderer"
import { getStyleCard } from "../lib/stylePrompts"
import { designFromReply } from "../lib/design/studioFlow"
import { defaultRoomName, roomTypeLabel } from "../lib/rooms"

describe("must include: picking", () => {
  it("allows three pieces per design", () => {
    assert.equal(MUST_INCLUDE_LIMIT, 3)
    let picked: string[] = []
    for (const id of ["dining-table", "desk", "tv-unit", "armchair"]) picked = toggleMustInclude(picked, id)
    assert.deepEqual(picked, ["dining-table", "desk", "tv-unit"])
    assert.deepEqual(toggleMustInclude(picked, "desk"), ["dining-table", "tv-unit"])
  })

  it("keeps known pieces only, once each, three at most", () => {
    assert.deepEqual(cleanMustInclude(["Desk", "desk", "jacuzzi", 4, "tv-unit", "armchair", "storage"]), [
      "desk",
      "tv-unit",
      "armchair",
    ])
    assert.deepEqual(cleanMustInclude("desk"), [])
    assert.deepEqual(cleanMustInclude(undefined), [])
  })

  it("offers no sofa bed, since a picture cannot show that it folds out", () => {
    assert.ok(!MUST_INCLUDE_OPTIONS.some((o) => /sofa bed/i.test(o.label)))
  })
})

describe("must include: what the image model is told", () => {
  const style = getStyleCard("industrial")!

  it("asks for each piece and for compact versions in a small room", () => {
    const text = buildOpenAIEditInstruction({ roomType: "living room", style, mustInclude: ["dining-table", "desk"] })
    assert.match(text, /The customer needs these pieces in the room: a dining table with chairs/)
    assert.match(text, /a desk with a chair/)
    assert.match(text, /choose compact versions rather than leaving any out/)
    assert.ok(text.includes(CLEARANCE_RULE))
  })

  it("adds nothing when no piece is picked", () => {
    assert.equal(mustIncludeInstruction([]), "")
    const text = buildOpenAIEditInstruction({ roomType: "living room", style })
    assert.doesNotMatch(text, /The customer needs these pieces/)
  })
})

describe("living + dining rooms", () => {
  it("is its own room type, not a dining room", () => {
    assert.equal(normalizeRoomType("living and dining room"), "living and dining room")
    assert.equal(normalizeRoomType("Living + dining"), "living and dining room")
    assert.equal(normalizeRoomType("dining room"), "dining room")
    assert.equal(normalizeRoomType("living room"), "living room")
    assert.equal(normalizeRoomType("bedroom"), "bedroom")
  })

  it("lays out a seating area and a dining area", () => {
    const guide = getRoomGuide("living and dining room")
    assert.match(guide.layout, /separate dining area with a dining table and chairs/)
    assert.match(guide.layout, /compact dining table/)
    const text = buildOpenAIEditInstruction({ roomType: "living and dining room", style: getStyleCard("japandi")! })
    assert.match(text, /furnish it as a living and dining room in Japandi style/)
  })

  it("always checks for a dining table", () => {
    assert.deepEqual(piecesToCheck(["desk"], "living and dining room"), ["desk", "dining-table"])
    assert.deepEqual(piecesToCheck(["desk"], "living room"), ["desk"])
    const results = [
      { id: "desk", label: "Desk", included: true },
      { id: "dining-table", label: "Dining table", included: false },
    ]
    assert.deepEqual(picksFromResults(results, "living and dining room"), ["desk"])
    assert.deepEqual(picksFromResults(results, "living room"), ["desk", "dining-table"])
  })

  it("accepts a result described as either area", () => {
    const furnished = (looksLike: string) => ({ empty: false, furniture: ["sofa", "dining table"], looksLike, notes: "", mustHave: {} })
    assert.equal(assessRoomOutput(furnished("living room"), "living and dining room").passed, true)
    assert.equal(assessRoomOutput(furnished("dining room"), "living and dining room").passed, true)
    assert.equal(assessRoomOutput(furnished("living and dining room"), "living room").passed, true)
    assert.equal(assessRoomOutput(furnished("bedroom"), "living and dining room").passed, false)
  })

  it("is offered when adding a room, with a readable name", () => {
    assert.equal(roomTypeLabel("living and dining room"), "Living + dining")
    assert.equal(defaultRoomName("living and dining room"), "Living and dining room")
  })
})

describe("must include: the check after each design", () => {
  it("asks the furnishing check about each piece", () => {
    const prompt = buildInspectionPrompt("living room", ["Dining table", "TV unit"])
    assert.match(prompt, /"mustHave": \{"dining table": true or false, "tv unit": true or false\}/)
    assert.match(prompt, /answer true only if that piece is clearly visible/)
    assert.doesNotMatch(buildInspectionPrompt("living room"), /mustHave/)
  })

  it("reads the check's answers", () => {
    const inspection = parseRoomInspection(
      '```json\n{"empty":false,"furniture":["sofa","round dining table","chairs"],"looksLike":"living room","notes":"","mustHave":{"Dining table":true,"Desk":false,"TV unit":"maybe"}}\n```'
    )
    assert.deepEqual(inspection.mustHave, { "dining table": true, desk: false })
    assert.deepEqual(checkMustIncludes(inspection, ["dining-table", "desk", "tv-unit"]), [
      { id: "dining-table", label: "Dining table", included: true },
      { id: "desk", label: "Desk", included: false },
      { id: "tv-unit", label: "TV unit", included: false },
    ])
  })

  it("falls back to the list of visible furniture", () => {
    const results = checkMustIncludes({ furniture: ["Sofa", "Media console", "Bookcases"] }, ["tv-unit", "bookshelf", "armchair"])
    assert.deepEqual(
      results.map((r) => r.included),
      [true, true, false]
    )
  })

  it("marks pieces as unchecked when the check cannot run", () => {
    assert.deepEqual(uncheckedMustIncludes(["desk"]), [{ id: "desk", label: "Desk", included: null }])
  })

  it("says plainly what did not fit", () => {
    assert.equal(missingMessage([{ id: "dining-table", label: "Dining table", included: false }]), "We couldn't fit the dining table this time.")
    assert.equal(
      missingMessage([
        { id: "desk", label: "Desk", included: false },
        { id: "tv-unit", label: "TV unit", included: false },
        { id: "armchair", label: "Armchair", included: true },
      ]),
      "We couldn't fit the desk and the TV unit this time."
    )
    assert.equal(missingMessage([{ id: "desk", label: "Desk", included: null }]), "")
  })
})

describe("must include: saved designs", () => {
  it("reads saved results and ignores anything unknown", () => {
    assert.deepEqual(
      readMustIncludeResults([{ id: "desk", included: true }, { id: "spa", included: true }, { id: "tv-unit" }, null, "x"]),
      [
        { id: "desk", label: "Desk", included: true },
        { id: "tv-unit", label: "TV unit", included: null },
      ]
    )
    assert.deepEqual(readMustIncludeResults(undefined), [])
  })

  it("keeps the results from the design reply", () => {
    const made = designFromReply(
      { success: true, imageUrl: "https://blob.example/a.png", designId: "d1", mustInclude: [{ id: "desk", included: false }] },
      { style: "japandi", sourceImageUrl: null, now: new Date("2026-10-28T19:00:00Z") }
    )
    assert.deepEqual(made?.mustInclude, [{ id: "desk", label: "Desk", included: false }])
  })
})
