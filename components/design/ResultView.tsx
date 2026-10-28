"use client"

import { AlertCircle, Check, Dot } from "lucide-react"
import BeforeAfterSlider from "@/components/design/BeforeAfterSlider"
import { missingMessage } from "@/lib/design/mustInclude"
import { contactLinks } from "@/lib/landing"
import { STUDIO_STYLES, findStudioStyle } from "@/lib/design/studioStyles"
import type { StudioDesign } from "@/lib/design/studioFlow"

interface ResultViewProps {
  design: StudioDesign
  beforeSrc: string | null
  styleName: string
  number: number
  total: number
  usedStyles: string[]
  onTryAnother: () => void
  onCompare: () => void
  onTryStyle: (styleId: string) => void
  onSliderMoved?: () => void
  /** Makes the same style again with the same must-have pieces. */
  onRetryMissing?: () => void
}

export default function ResultView({
  design,
  beforeSrc,
  styleName,
  number,
  total,
  usedStyles,
  onTryAnother,
  onCompare,
  onTryStyle,
  onSliderMoved,
  onRetryMissing,
}: ResultViewProps) {
  const feedback = contactLinks().feedback
  const used = new Set(usedStyles.map((style) => findStudioStyle(style)?.id ?? style))
  const nextStyles = STUDIO_STYLES.filter((style) => !used.has(style.id)).slice(0, 6)
  const asked = design.mustInclude ?? []
  const shownPieces = asked.filter((r) => r.included !== false)
  const missing = missingMessage(asked)
  const unchecked = asked.some((r) => r.included === null)

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
      <BeforeAfterSlider
        key={design.id}
        beforeSrc={beforeSrc}
        afterSrc={design.imageUrl}
        afterAlt={`After: ${styleName} design of your room`}
        onFirstMove={onSliderMoved}
      />

      <div className="pb-28 lg:pb-0">
        <div className="mt-4 flex items-baseline justify-between gap-3 lg:mt-2">
          <h1 className="font-serif text-[24px] font-semibold leading-tight text-ks-ink lg:text-[34px]">{styleName}</h1>
          <p className="whitespace-nowrap text-[13px] text-ks-stone">
            Design {number} of {total}
          </p>
        </div>
        <p className="mt-1.5 text-[13px] leading-normal text-ks-stone">
          Walls, windows and doors come from your photo. Furniture and decor are imagined by AI.
        </p>
        {asked.length > 0 && (
          <section className="mt-3.5 rounded-2xl border border-ks-line bg-white px-3.5 py-3">
            {shownPieces.length > 0 && (
              <>
                <h2 className="font-sans text-[13px] font-semibold leading-normal text-ks-stone">
                  {unchecked ? "You asked for" : "Included as you asked"}
                </h2>
                <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                  {shownPieces.map((piece) => (
                    <li key={piece.id} className="flex items-center gap-2 text-[15px] font-medium text-ks-ink">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ks-sand text-ks-charcoal">
                        {piece.included ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                        ) : (
                          <Dot className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                      {piece.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {missing && (
              <div className={`flex items-center gap-2.5 rounded-[10px] bg-[#FBF3E4] px-2.5 py-1.5 ${shownPieces.length > 0 ? "mt-2.5" : ""}`}>
                <AlertCircle className="h-[18px] w-[18px] flex-shrink-0 text-[#92400E]" aria-hidden="true" />
                <p className="flex-1 text-[14px] leading-snug text-ks-ink">{missing}</p>
                {onRetryMissing && (
                  <button
                    type="button"
                    onClick={onRetryMissing}
                    className="flex min-h-[40px] items-center px-1 text-[14px] font-semibold text-ks-charcoal underline underline-offset-4"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}
          </section>
        )}
        {feedback && (
          <p className="mt-2 text-[13px] leading-normal text-ks-stone">
            Something look wrong?{" "}
            <a
              href={feedback}
              target={feedback.startsWith("https:") ? "_blank" : undefined}
              rel={feedback.startsWith("https:") ? "noopener noreferrer" : undefined}
              className="text-[13px] font-medium text-ks-charcoal underline underline-offset-4"
            >
              Send feedback
            </a>
          </p>
        )}

        <div className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-2 gap-3 border-t border-ks-line bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
          <button
            type="button"
            onClick={onTryAnother}
            className="flex h-[52px] items-center justify-center rounded-xl bg-ks-charcoal text-[15px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            Try another style
          </button>
          <button
            type="button"
            onClick={onCompare}
            className="flex h-[52px] items-center justify-center rounded-xl border border-ks-charcoal bg-white text-[15px] font-semibold text-ks-charcoal transition-colors duration-150 hover:bg-ks-paper"
          >
            Compare
          </button>
        </div>

        {nextStyles.length > 0 && (
          <div className="hidden lg:block">
            <h2 className="mb-3 mt-8 font-sans text-[13px] font-semibold leading-normal text-ks-stone">Try next</h2>
            <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
              {nextStyles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => onTryStyle(style.id)}
                  className="group text-left outline-none"
                >
                  <img
                    src={style.cardImage}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-[10px] object-cover transition-opacity duration-150 group-hover:opacity-90 group-focus-visible:ring-2 group-focus-visible:ring-ks-charcoal"
                  />
                  <span className="mt-1.5 block text-[13px] font-semibold leading-snug text-ks-ink">{style.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
