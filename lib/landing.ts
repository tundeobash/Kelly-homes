import { findStudioStyle } from "./design/studioStyles"
import type { StudioStyle } from "./design/studioStyles"

/**
 * Where "Ask for an invite" emails go (Ayo's choice, 26 Oct 2026; to be replaced
 * by a Kelly Spaces address later). Set it to "" to hide the link; the page
 * still says sign-up is by invitation.
 */
export const INVITE_EMAIL = "tundeobash@gmail.com"

function mailto(email: string | null | undefined, subject: string, body: string): string | null {
  const address = (email || "").trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return null
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function inviteMailto(email: string | null | undefined): string | null {
  return mailto(email, "Kelly Spaces invite request", "Hello, I would like to try Kelly Spaces. Please invite this email address.")
}

/** There is no reset email yet, so people ask for a reset by email. */
export function passwordResetMailto(email: string | null | undefined): string | null {
  return mailto(
    email,
    "Kelly Spaces password reset",
    "Hello, please reset the password for my Kelly Spaces account. I signed up with this email address."
  )
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
