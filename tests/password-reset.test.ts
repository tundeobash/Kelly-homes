import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  appBaseUrl,
  hashResetToken,
  isWellFormedResetToken,
  newResetToken,
  resetEmail,
  resetLink,
} from "../lib/auth/passwordReset"
import { MIN_PASSWORD_LENGTH, passwordProblem } from "../lib/auth/passwordRules"
import { EMAIL_FROM, emailConfigured } from "../lib/email"

describe("reset links", () => {
  it("makes a fresh, well-formed token each time and stores only its hash", () => {
    const a = newResetToken()
    const b = newResetToken()
    assert.notEqual(a.token, b.token)
    assert.equal(isWellFormedResetToken(a.token), true)
    assert.equal(a.tokenHash, hashResetToken(a.token))
    assert.match(a.tokenHash, /^[0-9a-f]{64}$/)
    assert.notEqual(a.tokenHash, a.token)
  })

  it("rejects anything that isn't a token", () => {
    for (const bad of ["", "short", "x".repeat(44), "a/b".repeat(15), null, 42]) {
      assert.equal(isWellFormedResetToken(bad), false, String(bad))
    }
  })

  it("points live links at the live site, and other links back where they came from", () => {
    const live = { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "kelly-homes.vercel.app" }
    assert.equal(appBaseUrl(live, "https://kelly-homes-abc.vercel.app/api/auth/forgot-password"), "https://kelly-homes.vercel.app")
    assert.equal(
      appBaseUrl({ VERCEL_ENV: "preview" }, "https://kelly-homes-git-reset-x.vercel.app/api/auth/forgot-password"),
      "https://kelly-homes-git-reset-x.vercel.app"
    )
    assert.equal(appBaseUrl({}, "http://localhost:3001/api/auth/forgot-password"), "http://localhost:3001")
    assert.equal(resetLink("https://kelly-homes.vercel.app/", "T".repeat(43)), `https://kelly-homes.vercel.app/auth/reset/${"T".repeat(43)}`)
  })

  it("writes a short email with the link and a safe greeting", () => {
    const link = `https://kelly-homes.vercel.app/auth/reset/${"T".repeat(43)}`
    const email = resetEmail({ name: "Funmi <b>Obash</b>", link })
    assert.equal(email.subject, "Reset your Kelly Spaces password")
    assert.ok(email.text.includes(link))
    assert.ok(email.html.includes(link))
    assert.ok(email.text.startsWith("Hi Funmi"))
    assert.ok(!email.html.includes("<b>"))
    assert.ok(email.html.includes("1 hour"))
    assert.ok(resetEmail({ name: null, link }).text.startsWith("Hello,"))
  })
})

describe("password rules", () => {
  it("needs at least 8 characters, not just spaces", () => {
    assert.equal(MIN_PASSWORD_LENGTH, 8)
    assert.match(passwordProblem("short") || "", /at least 8/)
    assert.match(passwordProblem("        ") || "", /spaces/)
    assert.match(passwordProblem("x".repeat(129)) || "", /at most/)
    assert.equal(passwordProblem("garden-4718"), null)
    assert.notEqual(passwordProblem(undefined), null)
  })
})

describe("email", () => {
  it("sends from the Kelly Spaces domain once a key is set", () => {
    assert.equal(EMAIL_FROM, "Kelly Spaces <hello@kellyspaces.com>")
    assert.equal(emailConfigured({}), false)
    assert.equal(emailConfigured({ RESEND_API_KEY: "  " }), false)
    assert.equal(emailConfigured({ RESEND_API_KEY: "re_test" }), true)
  })
})
