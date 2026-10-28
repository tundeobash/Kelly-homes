import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PIECE_LIBRARY_LIMIT,
  addPiece,
  aroundPieceLines,
  buildIdentifyPrompt,
  cleanBox,
  cleanPiece,
  cleanPieceMode,
  cleanTapPoint,
  cleanWidth,
  cropRect,
  parseIdentify,
  pieceCheckName,
  pieceIncluded,
  pieceLabel,
  piecesForRoom,
  placePieceInstruction,
  readPieces,
} from "../lib/design/pieces"
import type { StudioPiece } from "../lib/design/pieces"
import { buildInspectionPrompt } from "../lib/ai/roomFurnishing"
import { buildOpenAIEditForm, buildOpenAIEditInstruction } from "../lib/ai/openaiRenderer"
import { getStyleCard } from "../lib/stylePrompts"
import { designFromReply } from "../lib/design/studioFlow"
import { missingMessage } from "../lib/design/mustInclude"
import { makerQuoteLink } from "../lib/landing"
import { roomBlobUrls } from "../lib/blobFiles"
import { isTrackedEvent } from "../lib/tracking"

const blob = (name: string) => `https://abc123.public.blob.vercel-storage.com/pieces/${name}`

function pouf(overrides: Partial<StudioPiece> = {}): StudioPiece {
  return {
    id: "piece_1793214000000_ab12cd34",
    name: "round fabric pouf",
    kind: "pouf",
    description: "A round light grey boucle pouf with gathered seams.",
    imageUrl: blob("pouf.jpg"),
    widthCm: null,
    ...overrides,
  }
}

describe("pieces: what is accepted", () => {
  it("keeps only pieces stored by the app, with tidy text", () => {
    const piece = cleanPiece({ ...pouf(), name: "  Round   fabric\npouf ", widthCm: "55" })
    assert.equal(piece?.name, "Round fabric pouf")
    assert.equal(piece?.widthCm, 55)
    assert.equal(cleanPiece({ ...pouf(), imageUrl: "https://example.com/pouf.jpg" }), null)
    assert.equal(cleanPiece({ ...pouf(), id: "../../x" }), null)
    assert.equal(cleanPiece(null), null)
  })

  it("accepts widths from 10 to 600 cm only", () => {
    assert.equal(cleanWidth("55"), 55)
    assert.equal(cleanWidth(54.6), 55)
    assert.equal(cleanWidth(5), null)
    assert.equal(cleanWidth("wide"), null)
  })

  it("knows the two modes", () => {
    assert.equal(cleanPieceMode("around"), "around")
    assert.equal(cleanPieceMode("place"), "place")
    assert.equal(cleanPieceMode("anything"), null)
  })

  it("keeps a room's pieces newest first, once each, twelve at most", () => {
    let list: StudioPiece[] = []
    for (let i = 0; i < 14; i++) list = addPiece(list, pouf({ id: `piece_${1000 + i}_aaaa` }))
    assert.equal(list.length, PIECE_LIBRARY_LIMIT)
    assert.equal(list[0].id, "piece_1013_aaaa")
    const renamed = addPiece(list, pouf({ id: "piece_1005_aaaa", name: "grey pouf" }))
    assert.equal(renamed[0].name, "grey pouf")
    assert.equal(renamed.filter((p) => p.id === "piece_1005_aaaa").length, 1)
  })

  it("lists the room's pieces, including ones only a design still uses", () => {
    const listed = pouf({ id: "piece_2000_aaaa" })
    const used = pouf({ id: "piece_2001_bbbb", name: "moroccan pouf" })
    const pieces = piecesForRoom({ pieces: [listed, { junk: true }] }, [{ piece: used }, { piece: listed }, null])
    assert.deepEqual(
      pieces.map((p) => p.id),
      ["piece_2000_aaaa", "piece_2001_bbbb"]
    )
    assert.deepEqual(readPieces("nope"), [])
    assert.deepEqual(piecesForRoom(null, []), [])
  })
})

describe("pieces: finding the piece in a photo", () => {
  it("asks for the tapped piece and its box", () => {
    assert.deepEqual(cleanTapPoint("0.25", 0.6), { x: 0.25, y: 0.6 })
    assert.equal(cleanTapPoint(1.2, 0.5), null)
    const prompt = buildIdentifyPrompt({ x: 0.25, y: 0.6 })
    assert.match(prompt, /x = 250, y = 600/)
    assert.match(prompt, /box_2d/)
  })

  it("reads the answer and turns the box into fractions", () => {
    const found = parseIdentify(
      '```json\n{"name":"Round Fabric Pouf","kind":"Pouf","description":"A round boucle pouf.","box_2d":[400,265,714,700]}\n```'
    )
    assert.equal(found?.name, "round fabric pouf")
    assert.equal(found?.kind, "pouf")
    assert.deepEqual(found?.box, { top: 0.4, left: 0.265, bottom: 0.714, right: 0.7 })
    assert.equal(parseIdentify("not json"), null)
    assert.equal(parseIdentify('{"name":"","box_2d":[1,2]}'), null)
    assert.equal(parseIdentify('{"name":"lamp","box_2d":[1,2]}')?.box, null)
  })

  it("crops the box with a margin, or a square around the tap", () => {
    assert.deepEqual(cropRect({ top: 0.4, left: 0.3, bottom: 0.7, right: 0.7 }, { x: 0.5, y: 0.5 }, 1000, 1000), {
      left: 240,
      top: 340,
      width: 520,
      height: 420,
    })
    const edge = cropRect({ top: 0, left: 0, bottom: 0.2, right: 0.2 }, { x: 0.1, y: 0.1 }, 1000, 800)
    assert.equal(edge.left, 0)
    assert.equal(edge.top, 0)
    const square = cropRect(null, { x: 0.5, y: 0.5 }, 1000, 1000)
    assert.equal(square.width, square.height)
    assert.equal(square.width, 450)
  })

  it("accepts a box from the browser only when it makes sense", () => {
    assert.deepEqual(cleanBox('{"top":0.1,"left":0.2,"bottom":0.5,"right":0.6}'), { top: 0.1, left: 0.2, bottom: 0.5, right: 0.6 })
    assert.equal(cleanBox('{"top":0.5,"left":0.2,"bottom":0.1,"right":0.6}'), null)
    assert.equal(cleanBox("{bad"), null)
    assert.equal(cleanBox({ top: -1, left: 0, bottom: 1, right: 1 }), null)
  })
})

describe("pieces: what the image model is told", () => {
  it("designs around the piece, sent as the second image", () => {
    const text = buildOpenAIEditInstruction({ roomType: "living room", style: getStyleCard("bohemian")!, piece: pouf() })
    assert.match(text, /^The first image is the room to edit\./)
    assert.match(text, /The second image is a photo of one piece the customer loves: round fabric pouf \(A round light grey boucle pouf with gathered seams\)\./)
    assert.match(text, /Copy the piece faithfully/)
    assert.match(text, /Keep the piece exactly as it is, even where it differs from the style/)
    assert.doesNotMatch(buildOpenAIEditInstruction({ roomType: "living room", style: getStyleCard("bohemian")! }), /first image/)
  })

  it("adds the piece to an existing design and changes nothing else", () => {
    const text = placePieceInstruction(pouf({ widthCm: 55 }))
    assert.match(text, /where a pouf naturally belongs, in a free spot/)
    assert.match(text, /replace only the one piece of the same kind; never remove anything else/)
    assert.match(text, /keep every other piece of furniture, the TV, rugs, curtains, lights and decor exactly as they are/)
    assert.match(text, /about 55 cm wide/)
  })

  it("uses a realistic size when no width is given", () => {
    assert.match(aroundPieceLines(pouf()), /realistic size for a real pouf/)
  })

  it("sends the piece as a second picture", () => {
    const form = buildOpenAIEditForm({
      imageBuffer: Buffer.from([1, 2, 3]),
      mimeType: "image/png",
      prompt: "x",
      model: "m",
      quality: "high",
      extraImages: [{ buffer: Buffer.from([4, 5]), mimeType: "image/jpeg" }],
    })
    const images = form.getAll("image[]") as File[]
    assert.equal(images.length, 2)
    assert.equal(images[1].name, "piece-1.jpg")
  })
})

describe("pieces: the check after each design", () => {
  it("asks whether the piece is visible", () => {
    const prompt = buildInspectionPrompt("living room", [pieceCheckName(pouf({ name: 'round "fabric" pouf' }))])
    assert.match(prompt, /"round fabric pouf": true or false/)
  })

  it("uses the direct answer, else looks for its kind", () => {
    assert.equal(pieceIncluded({ furniture: [], mustHave: { "round fabric pouf": true } }, pouf()), true)
    assert.equal(pieceIncluded({ furniture: ["Pouf"], mustHave: { "round fabric pouf": false } }, pouf()), false)
    assert.equal(pieceIncluded({ furniture: ["sofa", "grey pouf"] }, pouf()), true)
    assert.equal(pieceIncluded({ furniture: ["sofa"] }, pouf()), false)
  })

  it("says plainly when the piece did not fit", () => {
    assert.equal(missingMessage([], ["your round fabric pouf"]), "We couldn't fit your round fabric pouf this time.")
    assert.equal(
      missingMessage([{ id: "desk", label: "Desk", included: false }], ["your round fabric pouf"]),
      "We couldn't fit the desk and your round fabric pouf this time."
    )
    assert.equal(pieceLabel(pouf()), "Round fabric pouf")
  })
})

describe("pieces: saved designs, quotes and files", () => {
  it("keeps the piece from the design reply, and the room photo for before/after", () => {
    const made = designFromReply(
      {
        success: true,
        imageUrl: "https://abc123.public.blob.vercel-storage.com/generated/d.png",
        designId: "d2",
        piece: pouf(),
        pieceMode: "place",
        pieceIncluded: true,
        baseDesignId: "d1",
        sourceImageUrl: "https://abc123.public.blob.vercel-storage.com/uploads/room.jpg",
      },
      { style: "industrial", sourceImageUrl: "https://abc123.public.blob.vercel-storage.com/uploads/other.jpg", now: new Date() }
    )
    assert.equal(made?.piece?.name, "round fabric pouf")
    assert.equal(made?.pieceMode, "place")
    assert.equal(made?.pieceIncluded, true)
    assert.equal(made?.baseDesignId, "d1")
    assert.equal(made?.sourceImageUrl, "https://abc123.public.blob.vercel-storage.com/uploads/room.jpg")
  })

  it("asks for a maker's quote with the piece and the design", () => {
    const link = makerQuoteLink(pouf(), "https://abc123.public.blob.vercel-storage.com/generated/d.png", "", "ayo@example.com")
    assert.ok(link?.startsWith("mailto:ayo@example.com?subject=Kelly%20Spaces%3A%20quote%20for%20a%20piece"))
    assert.match(decodeURIComponent(link || ""), /quote from a local maker for this piece: round fabric pouf/)
    assert.match(decodeURIComponent(link || ""), /In my design: https:\/\/abc123/)
    const wa = makerQuoteLink(pouf(), "https://x.public.blob.vercel-storage.com/d.png", "+971 50 123 4567", "")
    assert.ok(wa?.startsWith("https://wa.me/971501234567?text="))
  })

  it("deletes a room's pieces with the room", () => {
    const urls = roomBlobUrls({
      imageUrl: null,
      aiDesignsJson: [{ imageUrl: blob("d.png"), piece: { imageUrl: blob("used.jpg") } }],
      lastAiSettings: { pieces: [{ imageUrl: blob("listed.jpg") }, { imageUrl: "https://elsewhere.com/x.jpg" }] },
    })
    assert.deepEqual(urls, [blob("d.png"), blob("used.jpg"), blob("listed.jpg")])
  })

  it("counts pieces added and quotes asked for", () => {
    assert.equal(isTrackedEvent("piece_added"), true)
    assert.equal(isTrackedEvent("maker_quote_opened"), true)
  })
})
