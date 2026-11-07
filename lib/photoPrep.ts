/**
 * Room photos are made smaller in the browser before upload (7 Nov 2026: a tester's
 * camera-roll photo would not upload). Vercel refuses request bodies over about 4.5 MB,
 * and new phones take photos bigger than that. Photos are sent with the longest side at
 * most 2,048 px, as JPEG; photos already small enough are sent as they are. HEIC/HEIF
 * photos work where the browser can read them (Safari can).
 *
 * The size rules are pure and tested; preparePhoto needs a browser.
 */

export const PHOTO_MAX_SIDE = 2048
/** At or under this, a JPG/PNG/WebP that fits PHOTO_MAX_SIDE goes up unchanged. */
export const PHOTO_SEND_AS_IS_BYTES = 3.5 * 1024 * 1024
/** Bigger than this is not a phone photo: refuse before trying to read it. */
export const PHOTO_MAX_PICK_BYTES = 40 * 1024 * 1024
export const PHOTO_JPEG_QUALITY = 0.86

/** What /api/upload is sent. */
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"]
/** What the file pickers offer. */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif"

export const PHOTO_UNREADABLE =
  "We couldn't read this photo. Please choose a JPG or PNG, or take a screenshot of it and choose that."
export const PHOTO_TOO_BIG = "This photo is too large. Please choose a smaller one."

/** The size to draw at: the same shape, longest side at most `max`. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 }
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** A photo that can go up unchanged: an upload type, small in bytes and in pixels. */
export function canSendAsIs(file: { type: string; size: number }, width: number, height: number): boolean {
  return (
    UPLOAD_TYPES.includes(file.type) &&
    file.size <= PHOTO_SEND_AS_IS_BYTES &&
    Math.max(width, height) <= PHOTO_MAX_SIDE
  )
}

/** "IMG_1234.HEIC" → "IMG_1234.jpg" */
export function jpegName(name: string): string {
  const base = (name || "photo").replace(/\.[^./\\]+$/, "") || "photo"
  return `${base}.jpg`
}

/** The message for a failed upload response, including Vercel's own "too large" refusal. */
export function uploadErrorMessage(status: number, error?: unknown): string {
  if (status === 413) return PHOTO_TOO_BIG
  return typeof error === "string" && error.trim() ? error : "The photo could not be uploaded. Please try again."
}

export class PhotoPrepError extends Error {}

interface Decoded {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

/** An <img> applies the photo's orientation (EXIF) when drawn, so phone photos stay upright. */
function decodeWithImage(file: Blob): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () =>
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("unreadable"))
    }
    img.src = url
  })
}

async function decodeWithBitmap(file: Blob): Promise<Decoded> {
  const bitmap = await createImageBitmap(file)
  return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
}

/**
 * The photo to upload: unchanged when it is already small, otherwise redrawn at most
 * 2,048 px on its longest side as JPEG. Throws PhotoPrepError with a message for people.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (file.size > PHOTO_MAX_PICK_BYTES) throw new PhotoPrepError(PHOTO_TOO_BIG)
  if (file.type && !file.type.startsWith("image/")) throw new PhotoPrepError("Please choose a photo.")

  let decoded: Decoded | null = null
  try {
    decoded = await decodeWithImage(file)
  } catch {
    try {
      decoded = await decodeWithBitmap(file)
    } catch {
      decoded = null
    }
  }
  if (!decoded || !decoded.width || !decoded.height) {
    // Can't read it here: a small photo of a type we upload may still be fine on the server.
    if (UPLOAD_TYPES.includes(file.type) && file.size <= PHOTO_SEND_AS_IS_BYTES) return file
    throw new PhotoPrepError(PHOTO_UNREADABLE)
  }

  try {
    if (canSendAsIs(file, decoded.width, decoded.height)) return file
    const size = fitWithin(decoded.width, decoded.height)
    const canvas = document.createElement("canvas")
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no canvas")
    context.drawImage(decoded.source, 0, 0, size.width, size.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY))
    if (!blob) throw new Error("no blob")
    return new File([blob], jpegName(file.name), { type: "image/jpeg", lastModified: Date.now() })
  } catch {
    if (UPLOAD_TYPES.includes(file.type) && file.size <= PHOTO_SEND_AS_IS_BYTES) return file
    throw new PhotoPrepError(PHOTO_UNREADABLE)
  } finally {
    decoded.release()
  }
}
