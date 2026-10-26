import { findStudioStyle } from "./design/studioStyles"
import type { StudioStyle } from "./design/studioStyles"

/**
 * Where "Ask for an invite", "Send feedback" and password-reset requests go.
 *
 * WHATSAPP_NUMBER: a public WhatsApp number with its country code, e.g. "+971 50 123 4567".
 * While it is "", the links open an email to INVITE_EMAIL instead.
 * INVITE_EMAIL: Ayo's choice, 26 Oct 2026; to be replaced by a Kelly Spaces address later.
 * Set both to "" to hide the links.
 */
export const WHATSAPP_NUMBER = ""
export const INVITE_EMAIL = "tundeobash@gmail.com"

const MESSAGES = {
  invite: {
    subject: "Kelly Spaces invite request",
    text: "Hello, I would like to try Kelly Spaces. Could you send me an invite link?",
  },
  passwordReset: {
    subject: "Kelly Spaces password reset",
    text: "Hello, please reset the password for my Kelly Spaces account. I signed up with this email address:",
  },
  feedback: {
    subject: "Kelly Spaces feedback",
    text: "Hello, here is my feedback on Kelly Spaces:",
  },
}

function mailto(email: string | null | undefined, subject: string, body: string): string | null {
  const address = (email || "").trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return null
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function inviteMailto(email: string | null | undefined): string | null {
  return mailto(email, MESSAGES.invite.subject, MESSAGES.invite.text)
}

/** There is no reset email yet, so people ask us for a reset. */
export function passwordResetMailto(email: string | null | undefined): string | null {
  return mailto(email, MESSAGES.passwordReset.subject, MESSAGES.passwordReset.text)
}

/** A link that opens a WhatsApp chat with the message typed in, or null if the number is not usable. */
export function whatsappLink(number: string | null | undefined, text: string): string | null {
  const digits = (number || "").replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export interface ContactLinks {
  invite: string | null
  passwordReset: string | null
  feedback: string | null
}

/** WhatsApp when a number is set, otherwise email. */
export function contactLinks(
  whatsappNumber: string | null | undefined = WHATSAPP_NUMBER,
  email: string | null | undefined = INVITE_EMAIL
): ContactLinks {
  const link = (message: { subject: string; text: string }) =>
    whatsappLink(whatsappNumber, message.text) ?? mailto(email, message.subject, message.text)
  return {
    invite: link(MESSAGES.invite),
    passwordReset: link(MESSAGES.passwordReset),
    feedback: link(MESSAGES.feedback),
  }
}

/** Real phone photos of an empty Gulf apartment and their designs, from the 24 Oct 2026 test. */
export const HERO_PAIR = {
  before: "/images/landing/hero-before.jpg",
  after: "/images/landing/hero-after.jpg",
  styleName: "Warm Modern Luxury",
}

export interface ShowcaseRoom {
  id: string
  styleName: string
  room: string
  before: string
  after: string
}

export const SHOWCASE_ROOMS: ShowcaseRoom[] = [
  { id: "living-majlis", styleName: "Contemporary Majlis", room: "Living room" },
  { id: "dining-scandinavian", styleName: "Scandinavian", room: "Dining area" },
  { id: "bedroom-japandi", styleName: "Japandi", room: "Bedroom" },
].map((room) => ({
  ...room,
  before: `/images/landing/${room.id}-before.jpg`,
  after: `/images/landing/${room.id}-after.jpg`,
}))

const LANDING_STYLE_IDS = ["contemporary-majlis", "modern-arabic", "warm-modern-luxury", "japandi"]

export const LANDING_STYLES: StudioStyle[] = LANDING_STYLE_IDS.map((id) => findStudioStyle(id)).filter(
  (style): style is StudioStyle => Boolean(style)
)
