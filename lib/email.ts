/**
 * Sending email through Resend (resend.com), using its web API directly.
 * Needs RESEND_API_KEY (Vercel, added by Ayo) and the kellyspaces.com domain verified in Resend.
 * Replies go to Ayo's inbox. Server only.
 */
import { INVITE_EMAIL } from "./landing"

export const EMAIL_FROM = "Kelly Spaces <hello@kellyspaces.com>"

export function emailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean((env.RESEND_API_KEY || "").trim())
}

export async function sendEmail(message: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const key = (process.env.RESEND_API_KEY || "").trim()
  if (!key) throw new Error("RESEND_API_KEY is not set")

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: INVITE_EMAIL || undefined,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Resend answered ${res.status}: ${detail.slice(0, 300)}`)
  }
}
