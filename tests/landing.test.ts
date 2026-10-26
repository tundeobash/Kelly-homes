import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { HERO_PAIR, INVITE_EMAIL, LANDING_STYLES, SHOWCASE_ROOMS, inviteMailto } from "../lib/landing"

function onDisk(publicPath: string): boolean {
  return existsSync(join(process.cwd(), "public", publicPath))
}

describe("landing page", () => {
  it("has every before and after photo it shows", () => {
    assert.ok(onDisk(HERO_PAIR.before), HERO_PAIR.before)
    assert.ok(onDisk(HERO_PAIR.after), HERO_PAIR.after)
    assert.equal(SHOWCASE_ROOMS.length, 3)
    for (const room of SHOWCASE_ROOMS) {
      assert.ok(onDisk(room.before), room.before)
      assert.ok(onDisk(room.after), room.after)
    }
  })

  it("shows four real styles, Gulf ones first", () => {
    assert.deepEqual(
      LANDING_STYLES.map((s) => s.id),
      ["contemporary-majlis", "modern-arabic", "warm-modern-luxury", "japandi"]
    )
    for (const style of LANDING_STYLES) assert.ok(onDisk(style.cardImage), style.cardImage)
  })

  it("builds an invite email link only for a real address", () => {
    const link = inviteMailto(" hello@example.com ")
    assert.ok(link)
    assert.ok(link.startsWith("mailto:hello@example.com?subject=Kelly%20Spaces%20invite%20request"))
    assert.equal(inviteMailto(""), null)
    assert.equal(inviteMailto(null), null)
    assert.equal(inviteMailto("not an email"), null)
  })

  it("has a working invite address set, or none at all", () => {
    if (INVITE_EMAIL) assert.ok(inviteMailto(INVITE_EMAIL), "INVITE_EMAIL is not a valid address")
  })
})
