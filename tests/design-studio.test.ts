import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { designStyles } from "../lib/mock/styles"
import {
  GULF_STYLE_IDS,
  STUDIO_STYLES,
  findStudioStyle,
  styleDisplayName,
} from "../lib/design/studioStyles"
import {
  DESIGN_STEPS,
  ORIGINAL_PHOTO_ID,
  addDesign,
  beforePhotoFor,
  defaultComparePair,
  describeFailure,
  designFromReply,
  designNumber,
  pickForCompare,
  progressAt,
  stepIndexAt,
} from "../lib/design/studioFlow"
import type { StudioDesign } from "../lib/design/studioFlow"

function design(id: string, style = "japandi", sourceImageUrl: string | null = null): StudioDesign {
  return { id, imageUrl: `https://blob.example/${id}.png`, style, sourceImageUrl }
}

describe("style picker", () => {
  it("offers every style once, Gulf styles first", () => {
    assert.equal(STUDIO_STYLES.length, designStyles.length)
    assert.equal(new Set(STUDIO_STYLES.map((s) => s.id)).size, STUDIO_STYLES.length)
    assert.deepEqual(
      STUDIO_STYLES.slice(0, 3).map((s) => s.id),
      GULF_STYLE_IDS
    )
    assert.ok(STUDIO_STYLES.slice(3).every((s) => !s.gulf))
  })

  it("has a light card photo on disk for every style", () => {
    for (const style of STUDIO_STYLES) {
      const file = join(process.cwd(), "public", style.cardImage)
      assert.ok(existsSync(file), `missing card photo ${style.cardImage}`)
    }
  })

  it("writes short card lines without the word Gulf", () => {
    assert.equal(findStudioStyle("contemporary-majlis")?.tagline, "Hosting, low seating")
    assert.equal(findStudioStyle("modern-arabic")?.tagline, "Geometric, warm")
    assert.equal(findStudioStyle("minimalist")?.tagline, "Simple, clean")
  })

  it("names styles saved by id or by older display names", () => {
    assert.equal(styleDisplayName("mid-century-modern"), "Mid-Century Modern")
    assert.equal(styleDisplayName("Mid-Century Modern"), "Mid-Century Modern")
    assert.equal(styleDisplayName("WABI-SABI"), "Wabi-Sabi")
    assert.equal(styleDisplayName("not-a-style"), "Not A Style")
    assert.equal(styleDisplayName(""), "Design")
  })
})

describe("designing screen", () => {
  it("moves through the four steps on a timer", () => {
    assert.equal(DESIGN_STEPS.length, 4)
    assert.equal(stepIndexAt(0), 0)
    assert.equal(stepIndexAt(4_999), 0)
    assert.equal(stepIndexAt(5_000), 1)
    assert.equal(stepIndexAt(12_000), 2)
    assert.equal(stepIndexAt(30_000), 3)
    assert.equal(stepIndexAt(120_000), 3)
  })

  it("fills the bar steadily but never shows it finished before the reply", () => {
    let last = 0
    for (let ms = 0; ms <= 180_000; ms += 1_000) {
      const value = progressAt(ms)
      assert.ok(value >= last, `progress went backwards at ${ms} ms`)
      assert.ok(value >= 2 && value <= 95)
      last = value
    }
    assert.ok(progressAt(45_000) >= 80)
    assert.equal(progressAt(Number.NaN), 2)
  })
})

describe("design replies", () => {
  const now = new Date("2026-10-26T10:00:00Z")

  it("turns a successful reply into a saved design that remembers its photo", () => {
    const made = designFromReply(
      { success: true, imageUrl: "https://blob.example/new.png", designId: "design_1" },
      { style: "japandi", sourceImageUrl: "https://blob.example/room.jpg", now }
    )
    assert.deepEqual(made, {
      id: "design_1",
      imageUrl: "https://blob.example/new.png",
      style: "japandi",
      createdAt: now.toISOString(),
      sourceImageUrl: "https://blob.example/room.jpg",
    })
  })

  it("treats a reply without a picture as a failure", () => {
    const input = { style: "japandi", sourceImageUrl: null, now }
    assert.equal(designFromReply({ success: true }, input), null)
    assert.equal(designFromReply({ success: false, imageUrl: "x" }, input), null)
    assert.equal(designFromReply(null, input), null)
  })

  it("explains the daily limit in the server's words", () => {
    const failure = describeFailure(
      {
        success: false,
        errorCode: "DAILY_LIMIT_REACHED",
        errorMessage: "You've reached your limit of 10 designs in 24 hours. You can create more in about 3 hours.",
      },
      "Japandi"
    )
    assert.equal(failure.kind, "limit")
    assert.match(failure.message, /in about 3 hours/)
  })

  it("says nothing was saved when a design fails, and keeps the reference", () => {
    const failure = describeFailure(
      { success: false, errorCode: "WRONG_ROOM_TYPE", errorMessage: "Not a living room", requestId: "req_9" },
      "Modern Arabic"
    )
    assert.equal(failure.kind, "failed")
    assert.match(failure.message, /This Modern Arabic design did not come out right/)
    assert.match(failure.message, /nothing was saved/)
    assert.equal(failure.detail, "Not a living room")
    assert.equal(failure.requestId, "req_9")
  })

  it("does not blame the photo when the design never started", () => {
    const failure = describeFailure(
      { success: false, errorCode: "LIMIT_CHECK_FAILED", errorMessage: "We couldn't check your daily design allowance just now." },
      "Japandi"
    )
    assert.equal(failure.kind, "failed")
    assert.equal(failure.title, "This design did not start")
    assert.doesNotMatch(failure.message, /photo/)
    assert.match(failure.message, /Nothing was saved/)
  })

  it("asks people to sign in again, or to check their connection", () => {
    assert.equal(describeFailure({ success: false, errorCode: "UNAUTHORIZED" }, "Japandi").kind, "signin")
    assert.equal(describeFailure({ success: false, errorCode: "MISSING_IMAGE" }, "Japandi").kind, "no-photo")
    const offline = describeFailure(null, "Japandi")
    assert.equal(offline.kind, "failed")
    assert.match(offline.message, /internet connection/)
  })
})

describe("designs and comparing", () => {
  it("keeps the newest design first and at most 12", () => {
    let list: StudioDesign[] = []
    for (let i = 1; i <= 14; i++) list = addDesign(list, design(`d${i}`))
    assert.equal(list.length, 12)
    assert.equal(list[0].id, "d14")
    assert.equal(addDesign(list, design("d14")).length, 12)
  })

  it("numbers designs oldest first", () => {
    const list = [design("c"), design("b"), design("a")]
    assert.equal(designNumber(list, "c"), 3)
    assert.equal(designNumber(list, "a"), 1)
    assert.equal(designNumber(list, "missing"), 0)
  })

  it("opens the comparison with the design on show and the next one, or the photo", () => {
    const list = [design("c"), design("b"), design("a")]
    assert.deepEqual(defaultComparePair(list, "b"), ["b", "c"])
    assert.deepEqual(defaultComparePair([design("only")], "only"), ["only", ORIGINAL_PHOTO_ID])
    assert.deepEqual(defaultComparePair([], null), [ORIGINAL_PHOTO_ID, ORIGINAL_PHOTO_ID])
  })

  it("puts a tapped design on the right unless it is already showing", () => {
    assert.deepEqual(pickForCompare(["a", "b"], "c"), ["a", "c"])
    assert.deepEqual(pickForCompare(["a", "b"], "a"), ["a", "b"])
  })

  it("compares each design with the photo it was made from", () => {
    assert.equal(beforePhotoFor(design("x", "japandi", "https://blob.example/old.jpg"), "https://blob.example/new.jpg"), "https://blob.example/old.jpg")
    assert.equal(beforePhotoFor(design("y"), "https://blob.example/new.jpg"), "https://blob.example/new.jpg")
    assert.equal(beforePhotoFor(null, null), null)
  })
})
