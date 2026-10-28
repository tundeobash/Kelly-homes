import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { QUOTE_REPLY_PROMISE, canSendQuote, quoteItemsFor, quoteMessage } from "../lib/design/quote"
import { quoteRequestLink } from "../lib/landing"
import { isTrackedEvent } from "../lib/tracking"

const pouf = {
  id: "piece_1793214000000_ab12cd34",
  name: "round fabric pouf",
  kind: "pouf",
  description: "",
  imageUrl: "https://abc.public.blob.vercel-storage.com/pieces/pouf.jpg",
  widthCm: null,
}
const designUrl = "https://abc.public.blob.vercel-storage.com/generated/d.png"

describe("get a quote", () => {
  it("promises a reply within 2 working days", () => {
    assert.equal(QUOTE_REPLY_PROMISE, "We'll reply within 2 working days.")
  })

  it("offers the piece you love and the must-haves that made it in", () => {
    const items = quoteItemsFor({
      piece: pouf,
      pieceIncluded: true,
      mustInclude: [
        { id: "desk", label: "Desk", included: true },
        { id: "armchair", label: "Armchair", included: false },
        { id: "storage", label: "Storage", included: null },
      ],
    })
    assert.deepEqual(
      items.map((i) => [i.id, i.label]),
      [
        ["piece:piece_1793214000000_ab12cd34", "Your round fabric pouf"],
        ["must:desk", "Desk"],
        ["must:storage", "Storage"],
      ]
    )
    assert.deepEqual(quoteItemsFor({ piece: pouf, pieceIncluded: false, mustInclude: [] }), [])
    assert.deepEqual(quoteItemsFor({}), [])
  })

  it("is always available for the whole room, and for pieces once one is chosen or named", () => {
    assert.equal(canSendQuote({ wholeRoom: true, items: [], other: "" }), true)
    assert.equal(canSendQuote({ wholeRoom: false, items: [], other: "  " }), false)
    assert.equal(canSendQuote({ wholeRoom: false, items: [], other: "the rug" }), true)
    assert.equal(canSendQuote({ wholeRoom: false, items: [{ id: "must:desk", label: "Desk" }], other: "" }), true)
  })

  it("writes one clear message for the whole room", () => {
    const text = quoteMessage({ roomName: "Living room", styleName: "Japandi", designUrl, wholeRoom: true, items: [], other: "move in December" })
    assert.equal(
      text,
      [
        "Hello, I'd like a quote to make my design real.",
        "Room: Living room (Japandi)",
        "Quote for: the whole room",
        "Notes: move in December",
        `My design: ${designUrl}`,
      ].join("\n")
    )
  })

  it("lists the chosen pieces, with the photo of the piece you love", () => {
    const text = quoteMessage({
      roomName: "",
      styleName: "Bohemian",
      designUrl,
      wholeRoom: false,
      items: [
        { id: "piece:x", label: "Your round fabric pouf", imageUrl: pouf.imageUrl },
        { id: "must:desk", label: "Desk" },
      ],
      other: "the rug",
    })
    assert.match(text, /Room: My room \(Bohemian\)/)
    assert.match(text, /Quote for: Your round fabric pouf; Desk; the rug/)
    assert.match(text, new RegExp(`Your round fabric pouf: ${pouf.imageUrl}`))
  })

  it("goes to WhatsApp when a number is set, else to email", () => {
    assert.ok(quoteRequestLink("hi", "+971 50 123 4567", "a@b.co")?.startsWith("https://wa.me/971501234567?text=hi"))
    assert.equal(quoteRequestLink("hi", "", "a@b.co"), "mailto:a@b.co?subject=Kelly%20Spaces%3A%20quote%20request&body=hi")
    assert.equal(quoteRequestLink("hi", "", ""), null)
  })

  it("counts opened sheets and sent requests, room and pieces apart", () => {
    for (const name of ["quote_opened", "quote_room_sent", "quote_pieces_sent"]) assert.equal(isTrackedEvent(name), true)
  })
})
