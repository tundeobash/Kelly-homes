/**
 * Saving a design picture to the phone or computer (tester feedback, 6 Nov 2026).
 * Phones get the share sheet ("Save Image"), computers a download; if the picture
 * cannot be fetched, it opens on its own so it can be saved by hand.
 */

/** A readable file name, e.g. "Kelly Spaces - Bedroom - Japandi.jpg". */
export function designFileName(roomName: string, styleName: string, contentType?: string | null): string {
  const clean = (value: string) =>
    value
      .replace(/[\\/:*?"<>|#%{}^~[\]`]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40)
  const parts = ["Kelly Spaces", clean(roomName), clean(styleName)].filter(Boolean)
  const type = (contentType || "").toLowerCase()
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"
  return `${parts.join(" - ")}.${ext}`
}

export type SaveOutcome = "shared" | "downloaded" | "opened" | "cancelled"

type ShareNavigator = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean
  share?: (data: { files?: File[]; title?: string }) => Promise<void>
}

/** Fetches the picture once, so the share sheet can open straight from the tap. */
export async function fetchDesignImage(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: "cors" })
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

function prefersShareSheet(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(pointer: coarse)").matches ?? false
}

export async function saveDesignImage(input: {
  url: string
  blob: Blob | null
  roomName: string
  styleName: string
}): Promise<SaveOutcome> {
  const blob = input.blob ?? (await fetchDesignImage(input.url))
  if (!blob) {
    window.open(input.url, "_blank", "noopener")
    return "opened"
  }
  const name = designFileName(input.roomName, input.styleName, blob.type)
  const file = new File([blob], name, { type: blob.type || "image/jpeg" })
  const nav = navigator as ShareNavigator
  if (prefersShareSheet() && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name })
      return "shared"
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled"
      // Not allowed here (e.g. the tap was too long ago): fall back to a download.
    }
  }
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
  return "downloaded"
}
