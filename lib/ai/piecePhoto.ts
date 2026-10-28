import sharp from "sharp"

/** Same limit as room photos. */
export const PIECE_PHOTO_MAX_BYTES = 10 * 1024 * 1024

/** A problem with the photo itself, worded for the person. */
export class PiecePhotoError extends Error {}

/** The photo as an upright JPEG, at most 1600 px on its longest side. */
export async function normalizePiecePhoto(file: unknown): Promise<{ buffer: Buffer; width: number; height: number }> {
  if (!(file instanceof Blob)) throw new PiecePhotoError("Please choose a photo.")
  if (file.type && !file.type.startsWith("image/")) throw new PiecePhotoError("Please choose a photo.")
  if (file.size > PIECE_PHOTO_MAX_BYTES) throw new PiecePhotoError("This photo is over 10 MB. Please choose a smaller one.")
  const input = Buffer.from(await file.arrayBuffer())
  try {
    const { data, info } = await sharp(input)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer({ resolveWithObject: true })
    return { buffer: data, width: info.width, height: info.height }
  } catch {
    throw new PiecePhotoError("We couldn't read that photo. Please try another one.")
  }
}
