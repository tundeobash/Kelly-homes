/**
 * Per-user daily design limit: the rules, with no database access.
 *
 * Every AI design attempt that may cost money is recorded (see
 * lib/ai/designLimit.ts). A user may have at most `limit` counted attempts in
 * any rolling 24-hour window. Attempts that never reached the image service,
 * or that the service refused with an error, are marked "failed" and do not
 * count.
 */

export const DEFAULT_DAILY_DESIGN_LIMIT = 10
export const DESIGN_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000

/** "started" = running; "completed" = reached the image service; "failed" = not charged. */
export type DesignAttemptStatus = "started" | "completed" | "failed"

/** Attempts with these statuses use up the allowance. */
export const COUNTED_DESIGN_STATUSES: DesignAttemptStatus[] = ["started", "completed"]

export interface DesignAttemptRow {
  id: string
  createdAt: Date
}

export type DesignAllowance =
  | { allowed: true; used: number; limit: number }
  | { allowed: false; used: number; limit: number; retryAt: Date }

/** DAILY_DESIGN_LIMIT must be a whole number of at least 1; anything else means the default (10). */
export function parseDailyDesignLimit(raw: string | undefined | null): number {
  const value = (raw ?? "").trim()
  if (!/^\d+$/.test(value)) return DEFAULT_DAILY_DESIGN_LIMIT
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_DAILY_DESIGN_LIMIT
}

/** Attempts created strictly after this moment are inside the window. */
export function designLimitWindowStart(now: Date): Date {
  return new Date(now.getTime() - DESIGN_LIMIT_WINDOW_MS)
}

/**
 * Decide whether a new attempt may start.
 * `rows` are the user's counted attempts already inside the window.
 * (The caller holds a per-user lock, so no other attempt can sneak in meanwhile.)
 */
export function decideDesignAllowance(input: { rows: DesignAttemptRow[]; limit: number }): DesignAllowance {
  const used = input.rows.length
  if (used < input.limit) {
    return { allowed: true, used: used + 1, limit: input.limit }
  }
  // A slot frees up once enough of these attempts leave the 24-hour window.
  const oldestFirst = [...input.rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const freesSlot = oldestFirst[used - input.limit]
  const retryAt = new Date(freesSlot.createdAt.getTime() + DESIGN_LIMIT_WINDOW_MS)
  return { allowed: false, used, limit: input.limit, retryAt }
}

export function describeRetry(retryAt: Date, now: Date): string {
  const minutes = Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 60000))
  if (minutes <= 1) return "in about a minute"
  if (minutes < 60) return `in about ${minutes} minutes`
  const hours = Math.max(1, Math.round(minutes / 60))
  return hours === 1 ? "in about an hour" : `in about ${hours} hours`
}

export function dailyLimitMessage(limit: number, retryAt: Date, now: Date): string {
  return `You've reached your limit of ${limit} designs in 24 hours. You can create more ${describeRetry(retryAt, now)}.`
}

/**
 * Should a finished attempt count toward the limit?
 * It counts once it reached the image service, unless the service answered
 * with an HTTP error (it does not charge for those).
 */
export function attemptCounts(input: { reachedProvider: boolean; providerHttpStatus?: number | null }): boolean {
  if (!input.reachedProvider) return false
  const status = input.providerHttpStatus
  return !(typeof status === "number" && status >= 400)
}
