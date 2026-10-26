import { findStudioStyle } from "./design/studioStyles"
import type { StudioStyle } from "./design/studioStyles"

/**
 * Where "Ask for an invite" emails go. While this is empty the link is hidden;
 * the page still says sign-up is by invitation.
 */
export const INVITE_EMAIL = ""

export function inviteMailto(email: string | null | undefined): string | null {
  const address = (email || "").trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return null
  const subject = encodeURIComponent("Kelly Spaces invite request")
  const body = encodeURIComponent("Hello, I would like to try Kelly Spaces. Please invite this email address.")
  return `mailto:${address}?subject=${subject}&body=${body}`
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
