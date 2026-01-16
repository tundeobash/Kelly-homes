/**
 * Detects if code is running during Next.js build phase
 * Used to prevent side effects (API calls, logging) during static generation
 */
export const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-production-export"
