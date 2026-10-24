import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  attemptCounts,
  COUNTED_DESIGN_STATUSES,
  DEFAULT_DAILY_DESIGN_LIMIT,
  DESIGN_LIMIT_WINDOW_MS,
  dailyLimitMessage,
  decideDesignAllowance,
  describeRetry,
  designLimitWindowStart,
  parseDailyDesignLimit,
} from "../lib/ai/designLimitPolicy"
import type { DesignAttemptRow } from "../lib/ai/designLimitPolicy"

const HOUR = 60 * 60 * 1000
const now = new Date("2026-10-24T12:00:00.000Z")

/** `count` earlier attempts, one per hour, the first `startHoursAgo` hours ago (shuffled order). */
function attempts(count: number, startHoursAgo: number): DesignAttemptRow[] {
  const list = Array.from({ length: count }, (_, i) => ({
    id: `a_${i}`,
    createdAt: new Date(now.getTime() - (startHoursAgo - i) * HOUR),
  }))
  return list.reverse()
}

describe("parseDailyDesignLimit", () => {
  it("defaults to 10", () => {
    assert.equal(DEFAULT_DAILY_DESIGN_LIMIT, 10)
    assert.equal(parseDailyDesignLimit(undefined), 10)
    assert.equal(parseDailyDesignLimit(""), 10)
  })
  it("accepts whole numbers of at least 1", () => {
    assert.equal(parseDailyDesignLimit("25"), 25)
    assert.equal(parseDailyDesignLimit(" 3 "), 3)
    assert.equal(parseDailyDesignLimit("1"), 1)
  })
  it("ignores zero, negatives, decimals and junk", () => {
    for (const raw of ["0", "-5", "2.5", "ten", "1e3", "Infinity"]) {
      assert.equal(parseDailyDesignLimit(raw), 10, raw)
    }
  })
})

describe("decideDesignAllowance", () => {
  it("allows the first design of the day", () => {
    assert.deepEqual(decideDesignAllowance({ rows: [], limit: 10 }), { allowed: true, used: 1, limit: 10 })
  })

  it("allows the 10th design and blocks the 11th", () => {
    const tenth = decideDesignAllowance({ rows: attempts(9, 9), limit: 10 })
    assert.equal(tenth.allowed, true)
    assert.equal(tenth.used, 10)

    const eleventh = decideDesignAllowance({ rows: attempts(10, 10), limit: 10 })
    assert.equal(eleventh.allowed, false)
    if (!eleventh.allowed) {
      assert.equal(eleventh.used, 10)
      // The oldest of the ten (10 hours ago) leaves the window in 14 hours.
      assert.equal(eleventh.retryAt.toISOString(), new Date(now.getTime() + 14 * HOUR).toISOString())
    }
  })

  it("waits for enough attempts to expire when the user is over the limit", () => {
    // 12 counted attempts (e.g. after the limit was lowered): 3 must expire.
    const decision = decideDesignAllowance({ rows: attempts(12, 12), limit: 10 })
    assert.equal(decision.allowed, false)
    if (!decision.allowed) {
      assert.equal(decision.retryAt.toISOString(), new Date(now.getTime() + (24 - 10) * HOUR).toISOString())
    }
  })

  it("respects a custom limit", () => {
    assert.equal(decideDesignAllowance({ rows: attempts(2, 2), limit: 2 }).allowed, false)
    assert.equal(decideDesignAllowance({ rows: attempts(1, 1), limit: 2 }).allowed, true)
  })
})

describe("attemptCounts", () => {
  it("does not count attempts that never reached the image service", () => {
    assert.equal(attemptCounts({ reachedProvider: false }), false)
  })
  it("counts attempts that reached it, including bad or late images", () => {
    assert.equal(attemptCounts({ reachedProvider: true }), true)
    assert.equal(attemptCounts({ reachedProvider: true, providerHttpStatus: null }), true) // timeout / no reply
    assert.equal(attemptCounts({ reachedProvider: true, providerHttpStatus: 200 }), true) // image rejected afterwards
  })
  it("does not count HTTP errors from the image service", () => {
    assert.equal(attemptCounts({ reachedProvider: true, providerHttpStatus: 400 }), false)
    assert.equal(attemptCounts({ reachedProvider: true, providerHttpStatus: 429 }), false)
    assert.equal(attemptCounts({ reachedProvider: true, providerHttpStatus: 500 }), false)
  })
})

describe("window and wording", () => {
  it("uses a rolling 24-hour window", () => {
    assert.equal(DESIGN_LIMIT_WINDOW_MS, 24 * HOUR)
    assert.equal(designLimitWindowStart(now).toISOString(), "2026-10-23T12:00:00.000Z")
  })
  it("counts running and finished attempts, not failed ones", () => {
    assert.deepEqual([...COUNTED_DESIGN_STATUSES].sort(), ["completed", "started"])
  })
  it("describes the wait in plain words", () => {
    assert.equal(describeRetry(new Date(now.getTime() + 20 * 1000), now), "in about a minute")
    assert.equal(describeRetry(new Date(now.getTime() + 25 * 60 * 1000), now), "in about 25 minutes")
    assert.equal(describeRetry(new Date(now.getTime() + 65 * 60 * 1000), now), "in about an hour")
    assert.equal(describeRetry(new Date(now.getTime() + 14 * HOUR), now), "in about 14 hours")
    assert.equal(describeRetry(new Date(now.getTime() - HOUR), now), "in about a minute")
  })
  it("explains the limit to the user", () => {
    assert.equal(
      dailyLimitMessage(10, new Date(now.getTime() + 3 * HOUR), now),
      "You've reached your limit of 10 designs in 24 hours. You can create more in about 3 hours."
    )
  })
})
