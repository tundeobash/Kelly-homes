/**
 * Parts of the app that are mock-ups, not real features: the furniture catalogue,
 * cart and checkout, designer directory, furniture recommendations, depth estimation
 * and leftover test pages. They stay hidden unless NEXT_PUBLIC_SHOW_UNFINISHED=true
 * (for example in .env.local while working on them). The code is kept.
 */
export function showUnfinished(env: Record<string, string | undefined> = process.env): boolean {
  return (env.NEXT_PUBLIC_SHOW_UNFINISHED ?? "").trim().toLowerCase() === "true"
}

/** Body for a hidden API route's 404 reply. */
export const UNFINISHED_API_BODY = { error: "Not found" }
