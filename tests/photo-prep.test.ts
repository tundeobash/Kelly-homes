import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PHOTO_ACCEPT,
  PHOTO_MAX_SIDE,
  PHOTO_SEND_AS_IS_BYTES,
  PHOTO_TOO_BIG,
  canSendAsIs,
  fitWithin,
  jpegName,
  uploadErrorMessage,
} from "../lib/photoPrep"

describe("room photos before upload", () => {
  it("keeps the shape and brings the longest side down to 2,048 px", () => {
    assert.equal(PHOTO_MAX_SIDE, 2048)
    assert.deepEqual(fitWithin(4032, 3024), { width: 2048, height: 1536 }) // 12 MP landscape
    assert.deepEqual(fitWithin(5712, 4284), { width: 2048, height: 1536 }) // 24 MP
    assert.deepEqual(fitWithin(3024, 4032), { width: 1536, height: 2048 }) // portrait
    assert.deepEqual(fitWithin(1200, 900), { width: 1200, height: 900 }) // never made bigger
    assert.deepEqual(fitWithin(0, 900), { width: 0, height: 0 })
  })

  it("sends small JPG, PNG and WebP photos as they are, and remakes the rest", () => {
    const small = PHOTO_SEND_AS_IS_BYTES - 1
    assert.equal(canSendAsIs({ type: "image/jpeg", size: small }, 2048, 1536), true)
    assert.equal(canSendAsIs({ type: "image/png", size: small }, 1000, 800), true)
    assert.equal(canSendAsIs({ type: "image/jpeg", size: 5_200_000 }, 4032, 3024), false) // the ~4.5 MB limit
    assert.equal(canSendAsIs({ type: "image/jpeg", size: small }, 4032, 3024), false) // too many pixels
    assert.equal(canSendAsIs({ type: "image/heic", size: 1_000_000 }, 1000, 800), false) // HEIC is always remade
    assert.ok(PHOTO_SEND_AS_IS_BYTES < 4.5 * 1024 * 1024)
  })

  it("offers HEIC photos and names remade photos .jpg", () => {
    assert.match(PHOTO_ACCEPT, /image\/heic/)
    assert.equal(jpegName("IMG_1234.HEIC"), "IMG_1234.jpg")
    assert.equal(jpegName("room.photo.png"), "room.photo.jpg")
    assert.equal(jpegName(""), "photo.jpg")
  })

  it("explains Vercel's too-large refusal plainly", () => {
    assert.equal(uploadErrorMessage(413), PHOTO_TOO_BIG)
    assert.equal(uploadErrorMessage(400, "File must be an image"), "File must be an image")
    assert.equal(uploadErrorMessage(500), "The photo could not be uploaded. Please try again.")
  })
})
