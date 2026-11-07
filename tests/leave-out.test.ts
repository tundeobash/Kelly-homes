import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LEAVE_OUT_LIMIT,
  checkLeaveOuts,
  cleanLeaveOut,
  leaveOutInstruction,
  leaveOutOptionsFor,
  leaveOutPicks,
  readLeaveOutResults,
  stillInMessage,
  toggleLeaveOut,
  uncheckedLeaveOuts,
  withoutClashes,
} from "../lib/design/leaveOut"
import { MUST_INCLUDE_OPTIONS } from "../lib/design/mustInclude"

describe("leave out", () => {
  it("keeps known pieces, no repeats, up to the limit", () => {
    assert.equal(LEAVE_OUT_LIMIT, 4)
    assert.deepEqual(cleanLeaveOut(["rug", "RUG", " plants ", "sofa", 3, "curtains", "wall-art", "desk"]), ["rug", "plants", "curtains", "wall-art"])
    assert.deepEqual(cleanLeaveOut("rug"), [])
    assert.deepEqual(toggleLeaveOut(["rug"], "rug"), [])
    assert.deepEqual(toggleLeaveOut(["rug"], "plants"), ["rug", "plants"])
    assert.deepEqual(toggleLeaveOut(["rug", "plants", "curtains", "desk"], "wall-art"), ["rug", "plants", "curtains", "desk"])
  })

  it("never offers the main piece, and shares ids with Must include for the same piece", () => {
    const ids = leaveOutOptionsFor("living room").map((o) => o.id)
    assert.ok(!ids.includes("sofa") && !ids.includes("bed"))
    for (const shared of ["dining-table", "desk", "tv-unit", "armchair", "bookshelf"]) {
      assert.ok(ids.includes(shared), shared)
      assert.ok(MUST_INCLUDE_OPTIONS.some((o) => o.id === shared), shared)
    }
    assert.ok(!leaveOutOptionsFor("living and dining room").some((o) => o.id === "dining-table"))
  })

  it("takes a piece off the other list", () => {
    assert.deepEqual(withoutClashes(["dining-table", "desk"], ["desk", "rug"]), ["dining-table"])
  })

  it("tells the model plainly, after the layout", () => {
    assert.equal(leaveOutInstruction([]), "")
    const line = leaveOutInstruction(["rug", "tv-unit"])
    assert.match(line, /does not want any of these in the room: a rug or carpet; a TV unit, TV stand or media console\./)
    assert.match(line, /even where the layout above suggests one/)
  })

  it("checks each piece is gone, from the direct answer or the furniture list", () => {
    const results = checkLeaveOuts(
      { furniture: ["grey sofa", "jute rug", "floor lamp"], mustHave: { "coffee table": false } },
      ["coffee-table", "rug", "plants"]
    )
    assert.deepEqual(results, [
      { id: "coffee-table", label: "Coffee table", leftOut: true },
      { id: "rug", label: "Rug", leftOut: false },
      { id: "plants", label: "Plants", leftOut: true },
    ])
    assert.equal(stillInMessage(results), "We couldn't leave out the rug this time.")
    assert.equal(stillInMessage(checkLeaveOuts({ furniture: ["tv unit", "plant"] }, ["tv-unit", "plants"])), "We couldn't leave out the TV unit and the plants this time.")
    assert.equal(stillInMessage(uncheckedLeaveOuts(["rug"])), "")
  })

  it("reads saved results back and repeats the picks for Try again", () => {
    const saved = readLeaveOutResults(JSON.parse(JSON.stringify([{ id: "rug", leftOut: false }, { id: "nope" }, { id: "plants" }])))
    assert.deepEqual(saved, [
      { id: "rug", label: "Rug", leftOut: false },
      { id: "plants", label: "Plants", leftOut: null },
    ])
    assert.deepEqual(leaveOutPicks(saved), ["rug", "plants"])
    assert.deepEqual(readLeaveOutResults(undefined), [])
  })
})
