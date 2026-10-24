/**
 * Who may create an account.
 *
 * Sign-up is closed by default. To let specific people in, set
 * SIGNUP_ALLOWED_EMAILS to a comma-separated list of email addresses.
 * To open sign-up to everyone, set SIGNUPS_OPEN=true.
 */

export const SIGNUPS_CLOSED_MESSAGE =
  "Sign-ups are closed for now. Ask the Kelly Spaces team for an invite."

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isSignupAllowed(
  email: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  if ((env.SIGNUPS_OPEN ?? "").trim().toLowerCase() === "true") return true
  const wanted = normalizeEmail(email)
  if (!wanted) return false
  return (env.SIGNUP_ALLOWED_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)
    .includes(wanted)
}
