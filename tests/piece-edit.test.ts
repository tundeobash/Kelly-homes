import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildDetectPrompt,
  cleanEditRequest,
  designEditFrom,
  editCheckName,
  editDetail,
  editDone,
  editHeadline,
  editInstruction,
  editMissedMessage,
  markSvg,
  parseDetected,
  positionWords,
  readDesignEdit,
  readDetected,
  shortName,
} from "../lib/design/pieceEdit"
import { comparisonFor, designFromReply } from "../lib/design/studioFlow"

const sofaBox = { top: 0.48, left: 0.01, bottom: 0.75, right: 0.48 }
const sofa = { name: "leather corner sofa", kind: "sofa", box: sofaBox }
const loved = {
  id: "piece_1793214000000_ab12cd34",
  name: "modular sofa",
  kind: "sofa",
  description: "Beige boucle modular sofa with a chaise.",
  imageUrl: "https://abc.public.blob.vercel-storage.com/pieces/sofa.jpg",
  widthCm: 280,
}

describe("finding pieces", () => {
  it("asks for boxes and a spot for the dot, and leaves out the room itself", () => {
    const prompt = buildDetectPrompt()
    assert.match(prompt, /box_2d/)
    assert.match(prompt, /"point"/)
    assert.match(prompt, /Leave out walls, windows, doors/)
  })

  it("reads Gemini's list, keeps real boxes and puts the dot on the piece", () => {
    const text =
      "```json\n" +
      JSON.stringify([
        { name: "Leather corner sofa", kind: "Sofa", box_2d: [480, 10, 750, 480], point: [640, 150] },
        { name: "rug", kind: "rug", box_2d: [570, 290, 780, 890], point: [100, 100] },
        { name: "speck", kind: "x", box_2d: [100, 100, 105, 105], point: [102, 102] },
        { name: "", kind: "lamp", box_2d: [100, 100, 400, 200] },
      ]) +
      "\n```"
    const found = parseDetected(text)
    assert.equal(found.length, 2)
    assert.deepEqual(found[0], {
      id: "p1",
      name: "leather corner sofa",
      kind: "sofa",
      box: { top: 0.48, left: 0.01, bottom: 0.75, right: 0.48 },
      point: { x: 0.15, y: 0.64 },
    })
    // A point outside the box falls back to the middle of the box.
    assert.deepEqual(found[1].point, { x: 0.59, y: 0.675 })
  })

  it("drops a second dot on the same spot and copes with bad answers", () => {
    const text = JSON.stringify([
      { name: "coffee table", kind: "table", box_2d: [500, 400, 600, 600], point: [550, 500] },
      { name: "tray", kind: "tray", box_2d: [520, 450, 580, 550], point: [552, 505] },
    ])
    assert.equal(parseDetected(text).length, 1)
    assert.deepEqual(parseDetected("not json"), [])
    assert.deepEqual(parseDetected(JSON.stringify({ pieces: [] })), [])
  })

  it("keeps how many alike there are, for the estimate", () => {
    const found = parseDetected(
      JSON.stringify([
        { name: "leather bar stools", kind: "bar stool", count: 2, box_2d: [540, 870, 1000, 1000], point: [700, 940] },
        { name: "rug", kind: "rug", count: 99, box_2d: [570, 290, 780, 890], point: [700, 400] },
      ])
    )
    assert.equal(found[0].count, 2)
    assert.equal("count" in found[1], false)
    assert.equal(readDetected(JSON.parse(JSON.stringify(found)))![0].count, 2)
    assert.match(buildDetectPrompt(), /count = how many there are/)
  })

  it("reads stored pieces back", () => {
    const stored = parseDetected(JSON.stringify([{ name: "pouf", kind: "pouf", box_2d: [560, 670, 670, 850], point: [610, 760] }]))
    assert.deepEqual(readDetected(JSON.parse(JSON.stringify(stored))), stored)
    assert.equal(readDetected("nope"), null)
  })
})

describe("the change request", () => {
  it("accepts a swap with quick changes and text", () => {
    const edit = cleanEditRequest({
      action: "swap",
      baseDesignId: "design_1",
      target: sofa,
      changes: ["lighter", "smaller", "made-up"],
      text: "  a low cream sofa  ",
    })
    assert.deepEqual(edit, {
      action: "swap",
      baseDesignId: "design_1",
      target: sofa,
      to: null,
      changes: ["lighter", "smaller"],
      text: "a low cream sofa",
    })
  })

  it("needs a spot for a move, and ignores swap details on a remove", () => {
    assert.equal(cleanEditRequest({ action: "move", baseDesignId: "d", target: sofa }), null)
    const move = cleanEditRequest({ action: "move", baseDesignId: "d", target: sofa, to: { x: 0.4, y: 0.7 } })
    assert.deepEqual(move?.to, { x: 0.4, y: 0.7 })
    const remove = cleanEditRequest({ action: "remove", baseDesignId: "d", target: sofa, changes: ["lighter"], text: "x" })
    assert.deepEqual(remove?.changes, [])
    assert.equal(remove?.text, "")
  })

  it("refuses anything without a design, a piece or a box", () => {
    assert.equal(cleanEditRequest({ action: "swap", target: sofa }), null)
    assert.equal(cleanEditRequest({ action: "paint", baseDesignId: "d", target: sofa }), null)
    assert.equal(cleanEditRequest({ action: "swap", baseDesignId: "d", target: { name: "sofa", box: { top: 2 } } }), null)
  })
})

describe("the instruction", () => {
  it("says where the piece is", () => {
    assert.equal(positionWords({ x: 0.2, y: 0.8 }), "on the left, near the camera")
    assert.equal(positionWords({ x: 0.5, y: 0.5 }), "in the middle")
    assert.equal(positionWords({ x: 0.9, y: 0.2 }), "on the right, high up or at the back")
  })

  it("swaps only the outlined piece and keeps the rest", () => {
    const edit = cleanEditRequest({ action: "swap", baseDesignId: "d", target: sofa, changes: ["lighter"], text: "with wooden legs" })!
    const text = editInstruction(edit)
    assert.match(text, /outlined in red: the leather corner sofa on the left/)
    assert.match(text, /Replace only that sofa with a different sofa in a lighter colour, in the same spot/)
    assert.match(text, /The customer describes what they want: with wooden legs/)
    assert.match(text, /Change nothing else in the first image/)
    assert.match(text, /Do not draw any outline, dot or marking/)
  })

  it("puts a piece the person loves in its place, from the third image", () => {
    const edit = cleanEditRequest({ action: "swap", baseDesignId: "d", target: sofa })!
    const text = editInstruction(edit, loved)
    assert.match(text, /The third image is a photo of one piece the customer loves: modular sofa \(Beige boucle modular sofa with a chaise\)/)
    assert.match(text, /Replace the outlined sofa with that exact piece, in the same spot/)
    assert.match(text, /about 280 cm wide/)
  })

  it("moves to the red dot and removes cleanly", () => {
    const move = cleanEditRequest({ action: "move", baseDesignId: "d", target: sofa, to: { x: 0.8, y: 0.75 } })!
    assert.match(editInstruction(move), /a red dot where it should go \(on the right, near the camera\)/)
    assert.match(editInstruction(move), /Move only that sofa to the spot marked with the red dot/)
    const remove = cleanEditRequest({ action: "remove", baseDesignId: "d", target: sofa })!
    assert.match(editInstruction(remove), /Remove only that sofa from the room/)
  })

  it("draws a red outline, and a dot for a move", () => {
    const svg = markSvg(1000, 1333, sofaBox, null)
    assert.match(svg, /<rect x="0" y="628"/)
    assert.doesNotMatch(svg, /<circle/)
    assert.match(markSvg(1000, 1333, sofaBox, { x: 0.5, y: 0.5 }), /<circle cx="500" cy="667"/)
  })
})

describe("after the change", () => {
  it("checks that a removed piece is gone and a moved or swapped-in piece is there", () => {
    const remove = cleanEditRequest({ action: "remove", baseDesignId: "d", target: sofa })!
    assert.equal(editCheckName(remove, null), "leather corner sofa")
    assert.equal(editDone("remove", false, false), true)
    assert.equal(editDone("remove", true, false), false)
    assert.equal(editDone("move", true, false), true)
    assert.equal(editDone("swap", false, false), null)
    assert.equal(editDone("swap", false, true), false)
    const swap = cleanEditRequest({ action: "swap", baseDesignId: "d", target: sofa })!
    assert.equal(editCheckName(swap, loved), "modular sofa")
  })

  it("says what changed", () => {
    const swap = cleanEditRequest({ action: "swap", baseDesignId: "d", target: sofa, changes: ["lighter", "smaller"], text: "low" })!
    const saved = designEditFrom(swap, null, null)
    assert.equal(editHeadline(saved), "Leather corner sofa swapped")
    assert.equal(editDetail(saved), "Lighter colour · Smaller · “low”")
    const withPiece = designEditFrom(cleanEditRequest({ action: "swap", baseDesignId: "d", target: sofa })!, loved, false)
    assert.equal(editHeadline(withPiece), "Leather corner sofa swapped for your modular sofa")
    assert.equal(editMissedMessage(withPiece), "We couldn't fit your modular sofa this time.")
    const removed = designEditFrom(cleanEditRequest({ action: "remove", baseDesignId: "d", target: sofa })!, null, false)
    assert.equal(editHeadline(removed), "Leather corner sofa removed")
    assert.equal(editMissedMessage(removed), "We couldn't remove the leather corner sofa this time.")
    assert.equal(shortName({ kind: "sofa", name: "leather corner sofa" }), "sofa")
  })

  it("keeps the change on the new design and compares it with the previous one", () => {
    const edit = designEditFrom(cleanEditRequest({ action: "remove", baseDesignId: "d1", target: sofa })!, null, true)
    const design = designFromReply(
      { success: true, imageUrl: "https://x/new.png", designId: "d2", baseDesignId: "d1", edit },
      { style: "industrial", sourceImageUrl: "https://x/room.jpg", now: new Date(0) }
    )!
    assert.deepEqual(readDesignEdit(design.edit), edit)
    const base = { id: "d1", imageUrl: "https://x/old.png", style: "industrial" }
    assert.deepEqual(comparisonFor(design, [design, base], "https://x/room.jpg"), {
      src: "https://x/old.png",
      label: "Previous",
      previousId: "d1",
    })
    // Once the previous design is gone, compare with the room photo.
    assert.equal(comparisonFor(design, [design], "https://x/room.jpg").label, "Before")
  })
})
