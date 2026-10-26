import { createHash, randomBytes } from "crypto"

/**
 * "Forgot password?" links. The link carries a random token; only its SHA-256 hash is
 * stored (table PasswordReset), so a database copy can't be used to reset anyone.
 * Each link works once, for one hour. Server only.
 */

/** Keep in step with the SQL in app/api/auth/forgot-password/route.ts (interval '1 hour'). */
export const RESET_LINK_MINUTES = 60
export const MAX_RESET_EMAILS_PER_HOUR = 3

export const RESET_LINK_INVALID =
  "This link has expired or has already been used. Ask for a new one below."

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function newResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashResetToken(token) }
}

/** Tokens are always 43 URL-safe characters (32 random bytes). */
export function isWellFormedResetToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value)
}

/**
 * Where reset links point. The live site uses its own production address; previews and
 * the laptop use the address the request came in on, so the link opens the same site.
 */
export function appBaseUrl(env: Record<string, string | undefined>, requestUrl: string): string {
  const production = (env.VERCEL_PROJECT_PRODUCTION_URL || "").trim()
  if (env.VERCEL_ENV === "production" && production) return `https://${production.replace(/^https?:\/\//, "")}`
  return new URL(requestUrl).origin
}

export function resetLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/auth/reset/${token}`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}

export function resetEmail({ name, link }: { name?: string | null; link: string }): {
  subject: string
  html: string
  text: string
} {
  const firstName = (name || "").trim().split(/\s+/)[0] || ""
  const greeting = firstName ? `Hi ${firstName},` : "Hello,"
  const subject = "Reset your Kelly Spaces password"
  const lines = [
    greeting,
    "",
    "We got a request to reset the password for your Kelly Spaces account. To choose a new password, open this link. It works once, for 1 hour:",
    "",
    link,
    "",
    "If you didn't ask for this, you can ignore this email. Your password stays the same.",
    "",
    "Kelly Spaces",
  ]
  const safeLink = escapeHtml(link)
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FAFAF8;">
    <div style="max-width:480px;margin:0 auto;padding:32px 20px;font-family:Inter,Helvetica,Arial,sans-serif;color:#111827;">
      <p style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#1F2933;">Kelly Spaces</p>
      <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;padding:28px 24px;">
        <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;color:#111827;">Reset your password</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#4B5563;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#4B5563;">We got a request to reset the password for your Kelly Spaces account. The button works once, for 1 hour.</p>
        <a href="${safeLink}" style="display:inline-block;background:#1F2933;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;padding:14px 24px;border-radius:12px;">Choose a new password</a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:#6B7280;">If the button doesn't work, copy this link into your browser:<br><a href="${safeLink}" style="color:#1F2933;word-break:break-all;">${safeLink}</a></p>
      </div>
      <p style="margin:20px 4px 0;font-size:13px;line-height:1.55;color:#6B7280;">If you didn't ask for this, you can ignore this email. Your password stays the same.</p>
    </div>
  </body>
</html>`
  return { subject, html, text: lines.join("\n") }
}
