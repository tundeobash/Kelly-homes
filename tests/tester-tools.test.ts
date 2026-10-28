import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SIGNUPS_CLOSED_MESSAGE, inviteCodeMatches, isSignupAllowed } from "../lib/auth/signupPolicy"
import { cleanInviteCode } from "../lib/invite"
import { contactLinks, whatsappLink } from "../lib/landing"
import { TRACKED_EVENTS, cleanProjectId, isTrackedEvent } from "../lib/tracking"
import { filesOnlyThisRoomUses, isBlobUrl, roomBlobUrls, shouldDeleteFiles } from "../lib/blobFiles"

describe("invite links", () => {
  const env = { SIGNUP_INVITE_CODE: "Majlis-2026" }

  it("lets anyone with the right code sign up", () => {
    assert.equal(isSignupAllowed("new@example.com", env, "majlis-2026"), true)
    assert.equal(isSignupAllowed("new@example.com", env, " Majlis-2026 "), true)
  })

  it("keeps everyone else out", () => {
    assert.equal(isSignupAllowed("new@example.com", env, "wrong-code"), false)
    assert.equal(isSignupAllowed("new@example.com", env, null), false)
    assert.equal(isSignupAllowed("new@example.com", {}, "majlis-2026"), false)
    assert.match(SIGNUPS_CLOSED_MESSAGE, /invite link/)
  })

  it("ignores codes too short to be safe", () => {
    assert.equal(inviteCodeMatches("abc", { SIGNUP_INVITE_CODE: "abc" }), false)
    assert.equal(inviteCodeMatches("", { SIGNUP_INVITE_CODE: "" }), false)
  })

  it("still accepts the email list", () => {
    assert.equal(isSignupAllowed("friend@example.com", { SIGNUP_ALLOWED_EMAILS: "friend@example.com" }, null), true)
  })

  it("tidies codes from links", () => {
    assert.equal(cleanInviteCode(" Majlis-2026 "), "Majlis-2026")
    assert.equal(cleanInviteCode("abc"), null)
    assert.equal(cleanInviteCode("has spaces in it"), null)
    assert.equal(cleanInviteCode(null), null)
  })
})

describe("contact links", () => {
  it("use WhatsApp when a number is set", () => {
    assert.equal(whatsappLink("+971 50 123 4567", "Hi"), "https://wa.me/971501234567?text=Hi")
    assert.equal(whatsappLink("123", "Hi"), null)
    const links = contactLinks("+971 50 123 4567", "hello@example.com")
    assert.ok(links.invite?.startsWith("https://wa.me/971501234567?text="))
    assert.ok(links.feedback?.startsWith("https://wa.me/"))
    assert.ok(links.passwordReset?.startsWith("https://wa.me/"))
  })

  it("fall back to email without a number", () => {
    const links = contactLinks("", "hello@example.com")
    assert.ok(links.invite?.startsWith("mailto:hello@example.com?subject=Kelly%20Spaces%20invite%20request"))
    assert.ok(links.feedback?.startsWith("mailto:hello@example.com?subject=Kelly%20Spaces%20feedback"))
    assert.ok(links.passwordReset?.startsWith("mailto:hello@example.com?subject=Kelly%20Spaces%20password%20reset"))
    assert.deepEqual(contactLinks("", ""), { invite: null, passwordReset: null, feedback: null })
  })
})

describe("tracking", () => {
  it("accepts only the five tester actions", () => {
    assert.deepEqual([...TRACKED_EVENTS], [
      "app_open",
      "slider_used",
      "compare_opened",
      "fullscreen_opened",
      "try_another_style",
      "piece_added",
      "maker_quote_opened",
    ])
    assert.equal(isTrackedEvent("compare_opened"), true)
    assert.equal(isTrackedEvent("drop table"), false)
    assert.equal(isTrackedEvent(42), false)
  })

  it("keeps only tidy room ids", () => {
    assert.equal(cleanProjectId("cmvm6k8uu0001tl6bwytu93vs"), "cmvm6k8uu0001tl6bwytu93vs")
    assert.equal(cleanProjectId("x'; drop"), null)
    assert.equal(cleanProjectId(undefined), null)
  })
})

describe("deleting a room's files", () => {
  const blob = (name: string) => `https://abc123.public.blob.vercel-storage.com/${name}`

  it("finds the photo, every design and each design's photo, once each", () => {
    const urls = roomBlobUrls({
      imageUrl: blob("room.jpg"),
      aiDesignsJson: [
        { imageUrl: blob("d2.png"), sourceImageUrl: blob("room.jpg") },
        { imageUrl: blob("d1.png"), sourceImageUrl: blob("old-room.jpg") },
        { imageUrl: "/uploads/legacy.png" },
        null,
      ],
    })
    assert.deepEqual(urls, [blob("room.jpg"), blob("d2.png"), blob("d1.png"), blob("old-room.jpg")])
  })

  it("never touches files elsewhere", () => {
    assert.equal(isBlobUrl("https://example.com/room.jpg"), false)
    assert.equal(isBlobUrl("http://abc.public.blob.vercel-storage.com/x.png"), false)
    assert.equal(isBlobUrl("https://evil.com/?h=.public.blob.vercel-storage.com"), false)
    assert.deepEqual(roomBlobUrls({ imageUrl: null, aiDesignsJson: "not a list" }), [])
  })

  it("keeps files another room still shows", () => {
    const room = { imageUrl: blob("room.jpg"), aiDesignsJson: [{ imageUrl: blob("d1.png"), sourceImageUrl: blob("room.jpg") }] }
    const other = { imageUrl: blob("room.jpg"), aiDesignsJson: [] }
    assert.deepEqual(filesOnlyThisRoomUses(room, [other]), [blob("d1.png")])
    assert.deepEqual(filesOnlyThisRoomUses(room, []), [blob("room.jpg"), blob("d1.png")])
  })

  it("deletes files only on the live site", () => {
    assert.equal(shouldDeleteFiles({ VERCEL_ENV: "production" }), true)
    assert.equal(shouldDeleteFiles({ VERCEL_ENV: "preview" }), false)
    assert.equal(shouldDeleteFiles({}), false)
  })
})
