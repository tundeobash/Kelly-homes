import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isSignupAllowed, isValidEmail, normalizeEmail, SIGNUPS_CLOSED_MESSAGE } from "../lib/auth/signupPolicy"

describe("isSignupAllowed", () => {
  it("is closed by default", () => {
    assert.equal(isSignupAllowed("someone@example.com", {}), false)
    assert.equal(isSignupAllowed("someone@example.com", { SIGNUPS_OPEN: "false" }), false)
    assert.match(SIGNUPS_CLOSED_MESSAGE, /closed/)
  })
  it("opens fully with SIGNUPS_OPEN=true", () => {
    assert.equal(isSignupAllowed("someone@example.com", { SIGNUPS_OPEN: "true" }), true)
    assert.equal(isSignupAllowed("someone@example.com", { SIGNUPS_OPEN: " TRUE " }), true)
  })
  it("lets in listed emails, ignoring case and spaces", () => {
    const env = { SIGNUP_ALLOWED_EMAILS: " Tester@Example.com , friend@example.org,," }
    assert.equal(isSignupAllowed("tester@example.com", env), true)
    assert.equal(isSignupAllowed("  FRIEND@example.org ", env), true)
    assert.equal(isSignupAllowed("stranger@example.com", env), false)
  })
  it("never lets in an empty email", () => {
    assert.equal(isSignupAllowed("", { SIGNUP_ALLOWED_EMAILS: "," }), false)
    assert.equal(normalizeEmail("  A@B.C "), "a@b.c")
  })
})

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    assert.equal(isValidEmail("tunde@example.com"), true)
    assert.equal(isValidEmail("a.b+c@sub.example.ae"), true)
  })
  it("rejects malformed ones", () => {
    for (const bad of ["", "plain", "a@b", "a b@example.com", "@example.com", "a@.com "]) {
      assert.equal(isValidEmail(bad), false, bad)
    }
  })
})
