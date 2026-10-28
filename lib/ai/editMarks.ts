import sharp from "sharp"
import { markSvg } from "@/lib/design/pieceEdit"
import type { PieceBox } from "@/lib/design/pieces"

/**
 * A copy of the design with the piece to change outlined in red (and, for a move, a red
 * dot where it should go). It goes to the image model as the second picture.
 */
export async function markEditImage(image: Buffer, box: PieceBox, to: { x: number; y: number } | null): Promise<Buffer> {
  const meta = await sharp(image).metadata()
  const width = meta.width || 0
  const height = meta.height || 0
  if (!width || !height) throw new Error("The design picture could not be read.")
  const overlay = Buffer.from(markSvg(width, height, box, to))
  return sharp(image).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer()
}
