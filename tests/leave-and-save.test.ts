import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  PENDING_MAX_MS,
  isExpired,
  makePending,
  newDesignFor,
  pendingKey,
  readPending,
  studioDesignsFrom,
} from "../lib/design/pendingDesign"
import { designFileName } from "../lib/design/saveImage"
import {
  ROOM_CARD_FOLDERS,
  STUDIO_STYLES,
  cardFolderFor,
  styleCardImage,
  stylesForRoom,
} from "../lib/design/studioStyles"

const NOW = 1_800_000_000_000

describe("a design that is still being made", () => {
  const pending = makePending({
    projectId: "room1",
    style: "japandi",
    title: null,
    designs: [{ id: "d1" }, { id: "d2" }],
    now: NOW,
  })

  it("remembers the room's designs at the start", () => {
    assert.deepEqual(pending.knownIds, ["d1", "d2"])
    assert.equal(pending.startedAt, NOW)
    assert.equal(pendingKey("room1"), "ks-pending-design:room1")
  })

  it("reads back only a fresh marker for the same room", () => {
    const raw = JSON.stringify(pending)
    assert.deepEqual(readPending(raw, "room1", NOW + 30_000), pending)
    assert.equal(readPending(raw, "room2", NOW + 30_000), null)
    assert.equal(readPending(raw, "room1", NOW + PENDING_MAX_MS + 1), null)
    assert.equal(readPending("not json", "room1", NOW), null)
    assert.equal(readPending(null, "room1", NOW), null)
    assert.equal(readPending(JSON.stringify({ ...pending, knownIds: [1] }), "room1", NOW), null)
    assert.equal(readPending(JSON.stringify({ ...pending, startedAt: NOW + 3_600_000 }), "room1", NOW), null)
  })

  it("keeps what was asked for and a failure noted after leaving", () => {
    const withRequest = makePending({
      projectId: "room1",
      style: "japandi",
      designs: [],
      now: NOW,
      request: { style: "japandi", opts: { must: ["desk"] } },
    })
    const failure = { kind: "limit", title: "You have used today's designs", message: "Come back later." }
    const back = readPending(JSON.stringify({ ...withRequest, failure }), "room1", NOW + 1_000)
    assert.deepEqual(back?.request, { style: "japandi", opts: { must: ["desk"] } })
    assert.deepEqual(back?.failure, failure)
    const odd = readPending(JSON.stringify({ ...withRequest, failure: { kind: "boom", title: "x", message: "y" } }), "room1", NOW)
    assert.equal(odd?.failure, undefined)
  })

  it("gives up after the longest a design can take", () => {
    assert.equal(isExpired(pending, NOW + PENDING_MAX_MS), false)
    assert.equal(isExpired(pending, NOW + PENDING_MAX_MS + 1), true)
  })

  it("finds the new design, newest first, and nothing when there is none", () => {
    assert.equal(newDesignFor(pending, [{ id: "d1" }, { id: "d2" }]), null)
    assert.deepEqual(newDesignFor(pending, [{ id: "d3" }, { id: "d1" }, { id: "d2" }]), { id: "d3" })
  })

  it("reads the room's designs as the API sends them", () => {
    const list = studioDesignsFrom([
      { id: "d3", imageUrl: "https://blob.example/d3.png", style: "japandi", createdAt: "2026-11-07T00:00:00Z", detected: null },
      { id: "", imageUrl: "https://blob.example/x.png" },
      { id: "d4" },
      null,
    ])
    assert.equal(list.length, 1)
    assert.equal(list[0].id, "d3")
    assert.equal(list[0].style, "japandi")
    assert.deepEqual(list[0].mustInclude, [])
    assert.equal(studioDesignsFrom("nope").length, 0)
  })
})

describe("saving a design image", () => {
  it("names the file after the room and style", () => {
    assert.equal(designFileName("Bedroom", "Japandi", "image/png"), "Kelly Spaces - Bedroom - Japandi.png")
    assert.equal(designFileName("My/room: 1", "Modern Arabic", "image/jpeg"), "Kelly Spaces - My room 1 - Modern Arabic.jpg")
    assert.equal(designFileName("", "Japandi", null), "Kelly Spaces - Japandi.jpg")
  })
})

describe("style pictures that match the room", () => {
  it("picks the card folder from the room type", () => {
    assert.equal(cardFolderFor("bedroom"), "bedroom")
    assert.equal(cardFolderFor("Master bedroom"), "bedroom")
    assert.equal(cardFolderFor("dining room"), "dining-room")
    assert.equal(cardFolderFor("office"), "office")
    assert.equal(cardFolderFor("study"), "office")
    assert.equal(cardFolderFor("living room"), null)
    assert.equal(cardFolderFor("living and dining room"), null)
    assert.equal(cardFolderFor("kitchen"), null)
    assert.equal(cardFolderFor(""), null)
  })

  it("keeps the living-room cards for other rooms", () => {
    assert.equal(styleCardImage("japandi"), "/images/styles/cards/japandi.jpg")
    assert.equal(styleCardImage("japandi", "living room"), "/images/styles/cards/japandi.jpg")
    assert.equal(styleCardImage("japandi", "bedroom"), "/images/styles/cards/bedroom/japandi.jpg")
    assert.equal(stylesForRoom("living room"), STUDIO_STYLES)
    assert.deepEqual(
      stylesForRoom("bedroom").map((s) => s.id),
      STUDIO_STYLES.map((s) => s.id)
    )
  })

  it("has a card photo on disk for every style in every room folder", () => {
    for (const folder of ROOM_CARD_FOLDERS) {
      for (const style of STUDIO_STYLES) {
        const file = join(process.cwd(), "public", "images", "styles", "cards", folder, `${style.id}.jpg`)
        assert.ok(existsSync(file), `missing card photo ${folder}/${style.id}.jpg (run scripts/make-style-cards.mjs)`)
      }
    }
  })
})
