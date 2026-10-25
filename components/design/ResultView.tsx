"use client"

import BeforeAfterSlider from "@/components/design/BeforeAfterSlider"
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
}: ResultViewProps) {
  const used = new Set(usedStyles.map((style) => findStudioStyle(style)?.id ?? style))
  const nextStyles = STUDIO_STYLES.filter((style) => !used.has(style.id)).slice(0, 6)

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
      <BeforeAfterSlider
        key={design.id}
        beforeSrc={beforeSrc}
        afterSrc={design.imageUrl}
        afterAlt={`After: ${styleName} design of your room`}
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
