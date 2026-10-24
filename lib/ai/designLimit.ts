import { prisma } from "@/lib/prisma"
import {
  COUNTED_DESIGN_STATUSES,
  dailyLimitMessage,
  decideDesignAllowance,
  designLimitWindowStart,
  parseDailyDesignLimit,
} from "./designLimitPolicy"

export type DesignAttemptReservation =
  | { allowed: true; attemptId: string; limit: number; used: number }
  | { allowed: false; errorCode: "DAILY_LIMIT_REACHED"; message: string; limit: number; retryAt: string }
  | { allowed: false; errorCode: "LIMIT_CHECK_FAILED"; message: string; limit: number }

const LIMIT_CHECK_FAILED_MESSAGE =
  "We couldn't check your daily design allowance just now. Please try again in a minute."

/**
 * Check the user's daily allowance and, if there is room, record a new attempt.
 * Runs in one transaction under a per-user lock, so simultaneous clicks cannot
 * both take the last slot, and nothing is recorded if the check fails.
 * Fails closed: if the check itself fails, no design is generated.
 */
export async function reserveDesignAttempt(input: {
  userId: string
  provider: string
  requestId: string
}): Promise<DesignAttemptReservation> {
  const limit = parseDailyDesignLimit(process.env.DAILY_DESIGN_LIMIT)
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${input.userId}::text))) AS user_lock`
      const now = new Date()
      const rows = await tx.designGeneration.findMany({
        where: {
          userId: input.userId,
          createdAt: { gt: designLimitWindowStart(now) },
          status: { in: COUNTED_DESIGN_STATUSES },
        },
        select: { id: true, createdAt: true },
      })
      const decision = decideDesignAllowance({ rows, limit })
      if (!decision.allowed) return { decision, now, attemptId: null as string | null }
      const attempt = await tx.designGeneration.create({
        data: { userId: input.userId, provider: input.provider, status: "started" },
        select: { id: true },
      })
      return { decision, now, attemptId: attempt.id as string | null }
    })

    const { decision, now, attemptId } = outcome
    if (decision.allowed && attemptId) {
      console.log(`[${input.requestId}] Design allowance`, { used: decision.used, limit })
      return { allowed: true, attemptId, limit, used: decision.used }
    }
    if (!decision.allowed) {
      console.warn(`[${input.requestId}] Daily design limit reached`, {
        used: decision.used,
        limit,
        retryAt: decision.retryAt.toISOString(),
      })
      return {
        allowed: false,
        errorCode: "DAILY_LIMIT_REACHED",
        message: dailyLimitMessage(limit, decision.retryAt, now),
        limit,
        retryAt: decision.retryAt.toISOString(),
      }
    }
    throw new Error("Design attempt was not recorded")
  } catch (error) {
    console.error(`[${input.requestId}] Design limit check failed`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return { allowed: false, errorCode: "LIMIT_CHECK_FAILED", message: LIMIT_CHECK_FAILED_MESSAGE, limit }
  }
}

/** Mark an attempt as finished. Never throws: bookkeeping must not break a design. */
export async function finishDesignAttempt(
  attemptId: string,
  status: "completed" | "failed",
  requestId: string
): Promise<void> {
  try {
    await prisma.designGeneration.updateMany({
      where: { id: attemptId, status: "started" },
      data: { status },
    })
  } catch (error) {
    console.error(`[${requestId}] Could not record design attempt result`, {
      status,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
