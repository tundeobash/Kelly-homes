/**
 * Invite codes travel in links such as kelly-homes.vercel.app/?invite=CODE (shared on WhatsApp).
 * This only tidies the code; lib/auth/signupPolicy.ts decides whether it is the right one.
 * Safe to use in the browser.
 */
export function cleanInviteCode(value: string | null | undefined): string | null {
  const code = (value || "").trim()
  return /^[A-Za-z0-9_-]{6,64}$/.test(code) ? code : null
}
