import { designStyles } from "../mock/styles"

/**
 * Styles as the design screen shows them: picture cards, Gulf styles first
 * (the GCC is the launch market), then the rest in their usual order.
 */

export const GULF_STYLE_IDS = ["contemporary-majlis", "modern-arabic", "warm-modern-luxury"]

export interface StudioStyle {
  id: string
  name: string
  /** Two short words for the card, e.g. "Hosting, low seating". */
  tagline: string
  /** A light 480 × 360 card photo (the full-size photos are 0.5–1 MB each). */
  cardImage: string
  gulf: boolean
}

export function styleCardImage(id: string): string {
  return `/images/styles/cards/${id}.jpg`
}

function tagline(tags: string[]): string {
  return tags
    .filter((tag) => tag.toLowerCase() !== "gulf")
    .slice(0, 2)
    .map((word, index) => (index === 0 ? word : word.toLowerCase()))
    .join(", ")
}

const ALL_STYLES: StudioStyle[] = designStyles.map((style) => ({
  id: style.id,
  name: style.name,
  tagline: tagline(style.tags),
  cardImage: styleCardImage(style.id),
  gulf: GULF_STYLE_IDS.indexOf(style.id) !== -1,
}))

export const STUDIO_STYLES: StudioStyle[] = [
  ...GULF_STYLE_IDS.map((id) => ALL_STYLES.find((style) => style.id === id)).filter(
    (style): style is StudioStyle => Boolean(style)
  ),
  ...ALL_STYLES.filter((style) => !style.gulf),
]

function styleKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-")
}

/** Finds a style by its id; older designs may have saved the display name instead. */
export function findStudioStyle(value: string | null | undefined): StudioStyle | null {
  if (!value) return null
  const key = styleKey(value)
  return STUDIO_STYLES.find((style) => style.id === key) ?? null
}

export function styleDisplayName(value: string | null | undefined): string {
  const found = findStudioStyle(value)
  if (found) return found.name
  if (!value || !value.trim()) return "Design"
  return value
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
