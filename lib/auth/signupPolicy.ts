/**
 * Who may create an account.
 *
 * Sign-up is closed by default. Three ways in:
 * - SIGNUP_INVITE_CODE: anyone who opens the invite link, kelly-homes.vercel.app/?invite=CODE
 *   (letters, numbers and dashes, at least 6; capitals don't matter). Change it to stop old links working.
 * - SIGNUP_ALLOWED_EMAILS: a comma-separated list of email addresses.
 * - SIGNUPS_OPEN=true: everyone.
 */

export const SIGNUPS_CLOSED_MESSAGE =
  "Sign-ups are closed for now. You need an invite link from the Kelly Spaces team."

const MIN_INVITE_CODE_LENGTH = 6

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function inviteCodeMatches(
  code: string | null | undefined,
  env: Record<string, string | undefined> = process.env
): boolean {
  const wanted = (env.SIGNUP_INVITE_CODE ?? "").trim().toLowerCase()
  const given = (code ?? "").trim().toLowerCase()
  return wanted.length >= MIN_INVITE_CODE_LENGTH && given === wanted
}

export function isSignupAllowed(
  email: string,
  env: Record<string, string | undefined> = process.env,
  inviteCode: string | null = null
): boolean {
  if ((env.SIGNUPS_OPEN ?? "").trim().toLowerCase() === "true") return true
  if (inviteCodeMatches(inviteCode, env)) return true
  const wanted = normalizeEmail(email)
  if (!wanted) return false
  return (env.SIGNUP_ALLOWED_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)
    .includes(wanted)
}
