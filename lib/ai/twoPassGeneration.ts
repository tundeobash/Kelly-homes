import {
  renderWithStability,
  StabilityGenerationError,
} from "@/lib/ai/stabilityRenderer"
import { InvalidImageError, UnchangedImageError } from "@/lib/ai/generationValidation"

type RenderFn = typeof renderWithStability

function asStageError(error: unknown, stage: string): StabilityGenerationError {
  if (error instanceof StabilityGenerationError) {
    return new StabilityGenerationError(error.message, {
      stage,
      status: error.status,
    })
  }

  if (error instanceof UnchangedImageError || error instanceof InvalidImageError) {
    return new StabilityGenerationError(error.message, { stage })
  }

  const message = error instanceof Error ? error.message : "Unknown error"
  return new StabilityGenerationError(message, { stage })
}

/**
 * Whole-room pass, then a masked furniture pass.
 * If the first pass fails, the original photo is not reused and the second pass does not run.
 */
export async function runTwoPassStability(params: {
  imageBuffer: Buffer
  pass1Prompt: string
  pass2Prompt: string
  pass1Strength: number
  requestId: string
  createMask: (source: Buffer) => Promise<Buffer>
  render?: RenderFn
}): Promise<Buffer> {
  const render = params.render ?? renderWithStability

  let pass1Buffer: Buffer
  try {
    pass1Buffer = await render({
      imageBuffer: params.imageBuffer,
      prompt: params.pass1Prompt,
      strength: params.pass1Strength,
      requestId: `${params.requestId}-pass1`,
      mode: "image-to-image",
      stage: "pass1",
    })
  } catch (error) {
    throw asStageError(error, "pass1")
  }

  let mask: Buffer
  try {
    mask = await params.createMask(pass1Buffer)
  } catch (error) {
    throw asStageError(error, "mask")
  }

  try {
    return await render({
      imageBuffer: pass1Buffer,
      prompt: params.pass2Prompt,
      maskBuffer: mask,
      requestId: `${params.requestId}-pass2`,
      mode: "inpaint",
      stage: "pass2",
    })
  } catch (error) {
    throw asStageError(error, "pass2")
  }
}
