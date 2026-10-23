import { createHash } from "crypto"

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}

export class UnchangedImageError extends Error {
  readonly code = "UNCHANGED_IMAGE"

  constructor() {
    super("The AI service returned an image identical to the input. It was not saved.")
    this.name = "UnchangedImageError"
  }
}

export class InvalidImageError extends Error {
  readonly code = "INVALID_IMAGE"

  constructor(message: string) {
    super(message)
    this.name = "InvalidImageError"
  }
}

/**
 * Reject empty, non-image, or byte-for-byte unchanged provider output
 * before it can be stored as a finished design.
 */
export function validateGeneratedImage(
  output: Buffer,
  references: Buffer[],
  options?: { minBytes?: number }
): void {
  const minBytes = options?.minBytes ?? 10 * 1024

  if (!Buffer.isBuffer(output) || output.length < minBytes) {
    throw new InvalidImageError(
      `Generated image is too small (${output?.length ?? 0} bytes).`
    )
  }

  const isPng = output.length >= 4 && output.subarray(0, 4).equals(PNG_SIGNATURE)
  const isJpeg = output.length >= 3 && output.subarray(0, 3).equals(JPEG_SIGNATURE)
  if (!isPng && !isJpeg) {
    throw new InvalidImageError("Generated image is not a PNG or JPEG.")
  }

  const outputHash = sha256(output)
  for (const reference of references) {
    if (reference && sha256(reference) === outputHash) {
      throw new UnchangedImageError()
    }
  }
}
