import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ROOM_TYPE_OPTIONS,
  defaultRoomName,
  designCountLabel,
  roomCover,
  roomMeta,
  roomTypeLabel,
  updatedLabel,
} from "../lib/rooms"
import { showUnfinished } from "../lib/unfinished"
import { inviteMailto, passwordResetMailto } from "../lib/landing"

describe("unfinished features", () => {
  it("stay hidden unless switched on", () => {
    assert.equal(showUnfinished({}), false)
    assert.equal(showUnfinished({ NEXT_PUBLIC_SHOW_UNFINISHED: "" }), false)
    assert.equal(showUnfinished({ NEXT_PUBLIC_SHOW_UNFINISHED: "false" }), false)
    assert.equal(showUnfinished({ NEXT_PUBLIC_SHOW_UNFINISHED: " TRUE " }), true)
  })
})

describe("room cards", () => {
  const now = new Date("2026-10-26T08:00:00Z") // 12:00 in Dubai

  it("shows the latest design, or else the room photo", () => {
    assert.deepEqual(
      roomCover({ imageUrl: "photo.jpg", designs: [{ imageUrl: "new.png" }, { imageUrl: "old.png" }] }),
      { src: "new.png", isDesign: true }
    )
    assert.deepEqual(roomCover({ imageUrl: "photo.jpg", designs: [] }), { src: "photo.jpg", isDesign: false })
    assert.deepEqual(roomCover({ imageUrl: null, designs: [] }), { src: null, isDesign: false })
  })

  it("counts days in Gulf time", () => {
    assert.equal(updatedLabel("2026-10-26T01:00:00Z", now), "Updated today")
    // 23:30 UTC on the 25th is 03:30 on the 26th in Dubai: still today
    assert.equal(updatedLabel("2026-10-25T23:30:00Z", now), "Updated today")
    assert.equal(updatedLabel("2026-10-25T10:00:00Z", now), "Updated yesterday")
    assert.equal(updatedLabel("2026-10-21T10:00:00Z", now), "Updated 5 days ago")
    assert.equal(updatedLabel("2026-08-03T10:00:00Z", now), "Updated 3 Aug")
    assert.equal(updatedLabel(null, now), "")
    assert.equal(updatedLabel("not a date", now), "")
  })

  it("describes a room in one line", () => {
    assert.equal(
      roomMeta({ roomType: "living room", imageUrl: "p.jpg", designs: [{ imageUrl: "a" }, { imageUrl: "b" }, { imageUrl: "c" }], updatedAt: now }, now),
      "Living room · 3 designs · Updated today"
    )
    assert.equal(designCountLabel(0), "No designs yet")
    assert.equal(designCountLabel(1), "1 design")
    assert.equal(roomTypeLabel("Bedroom"), "Bedroom")
    assert.equal(roomTypeLabel(""), "Room")
    assert.equal(roomTypeLabel("majlis"), "Majlis")
  })

  it("names an unnamed room after its type", () => {
    assert.equal(defaultRoomName("dining room"), "Dining room")
    assert.equal(defaultRoomName("other"), "My room")
    assert.deepEqual(
      ROOM_TYPE_OPTIONS.map((o) => o.id),
      ["living room", "living and dining room", "bedroom", "dining room", "kitchen", "office", "other"]
    )
  })
})

describe("help by email", () => {
  it("builds the password reset and invite links from one address", () => {
    assert.match(passwordResetMailto("hello@example.com") || "", /^mailto:hello@example\.com\?subject=Kelly%20Spaces%20password%20reset/)
    assert.match(inviteMailto("hello@example.com") || "", /invite%20request/)
    assert.equal(passwordResetMailto(""), null)
  })
})
