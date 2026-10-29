"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { TIER_LABELS, formatRange, formatTotal, pieceTitle } from "@/lib/design/estimate"
import type { Estimate, PriceTier } from "@/lib/design/estimate"
import type { PieceBox } from "@/lib/design/pieces"

interface EstimateSheetProps {
  open: boolean
  imageUrl: string
  estimate: Estimate | null
  excluded: string[]
  onToggle: (pieceId: string) => void
  tier: PriceTier
  onTierChange: (tier: PriceTier) => void
  /** Opens "Get a quote" with these pieces ticked. */
  onQuote: (pieceIds: string[]) => void
  onClose: () => void
}

const TIERS: PriceTier[] = ["affordable", "mid", "premium"]

/** A square crop of the design around one piece, without stretching it. */
function PieceThumb({ src, box, ratio }: { src: string; box: PieceBox; ratio: number }) {
  // Square side as a fraction of the picture's width (sw) and height (sh): sw * width = sh * height.
  const bw = box.right - box.left
  const bh = box.bottom - box.top
  let sw = Math.max(bw, bh / ratio) * 1.15
  let sh = sw * ratio
  if (sh > 1) {
    sh = 1
    sw = 1 / ratio
  }
  if (sw > 1) {
    sw = 1
    sh = ratio
  }
  const cx = (box.left + box.right) / 2
  const cy = (box.top + box.bottom) / 2
  const left = Math.min(Math.max(cx - sw / 2, 0), 1 - sw)
  const top = Math.min(Math.max(cy - sh / 2, 0), 1 - sh)
  return (
    <span
      aria-hidden="true"
      className="block h-11 w-11 flex-shrink-0 rounded-[10px] bg-ks-sand bg-no-repeat"
      style={{
        backgroundImage: `url("${src}")`,
        backgroundSize: `${100 / sw}% ${100 / sh}%`,
        backgroundPosition: `${sw >= 1 ? 0 : (left / (1 - sw)) * 100}% ${sh >= 1 ? 0 : (top / (1 - sh)) * 100}%`,
      }}
    />
  )
}

/** "What's in this design": each piece with its typical price; untick what you don't want. */
export default function EstimateSheet({
  open,
  imageUrl,
  estimate,
  excluded,
  onToggle,
  tier,
  onTierChange,
  onQuote,
  onClose,
}: EstimateSheetProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [ratio, setRatio] = useState(3 / 4)

  useEffect(() => {
    if (!open) return
    headingRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // The design's proportions, so the crops are not stretched.
  useEffect(() => {
    if (!open || !imageUrl) return
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight)
    }
    img.src = imageUrl
  }, [open, imageUrl])

  if (!open || !estimate) return null

  const ticked = estimate.lines.filter((line) => !excluded.includes(line.piece.id))
  const total = estimate.lines.length
  const note = [
    estimate.open > 0
      ? `${estimate.open === 1 ? "1 piece has" : `${estimate.open} pieces have`} no typical price yet; your quote covers ${estimate.open === 1 ? "it" : "them"}.`
      : "",
    "Typical UAE shop prices for similar pieces, in AED. Excludes delivery, fitting and made-to-measure work.",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(17,24,39,0.5)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="estimate-title"
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-[20px] bg-white font-sans text-ks-ink sm:max-w-[480px] sm:rounded-[20px]"
      >
        <div className="flex-shrink-0 px-5 pt-2.5">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#D1D5DB] sm:hidden" />
          <div className="flex items-center justify-between gap-3 sm:pt-2">
            <h2
              id="estimate-title"
              ref={headingRef}
              tabIndex={-1}
              className="font-serif text-[25px] font-semibold leading-tight text-ks-ink outline-none"
            >
              What&apos;s in this design
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-ks-charcoal outline-none hover:bg-ks-paper focus-visible:ring-2 focus-visible:ring-ks-charcoal"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-0.5 text-[14px] leading-snug text-[#4B5563]">Untick anything you already have or don&apos;t want.</p>
          <div role="radiogroup" aria-label="Budget" className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-[#F3F1EC] p-1">
            {TIERS.map((id) => {
              const on = id === tier
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onTierChange(id)}
                  className={`h-[38px] rounded-[9px] text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ks-charcoal ${
                    on ? "bg-ks-charcoal text-white" : "text-ks-charcoal hover:bg-white"
                  }`}
                >
                  {TIER_LABELS[id]}
                </button>
              )
            })}
          </div>
        </div>

        <ul className="mt-2 flex-1 overflow-y-auto px-5">
          {estimate.lines.map((line) => {
            const on = !excluded.includes(line.piece.id)
            const id = `estimate-${line.piece.id}`
            return (
              <li key={line.piece.id} className="border-b border-[#F0EEE9]">
                <label htmlFor={id} className="flex min-h-[60px] cursor-pointer items-center gap-3 py-1.5">
                  <input
                    id={id}
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(line.piece.id)}
                    className="h-5 w-5 flex-shrink-0 accent-ks-charcoal"
                  />
                  <span className={on ? "" : "opacity-40"}>
                    <PieceThumb src={imageUrl} box={line.piece.box} ratio={ratio} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-[15px] font-medium leading-snug ${on ? "text-ks-ink" : "text-[#9CA3AF]"}`}>
                      {pieceTitle(line.piece)}
                    </span>
                    {line.qty > 1 && <span className="text-[12px] text-ks-stone">{line.qty} pieces</span>}
                  </span>
                  <span
                    className={`whitespace-nowrap text-right text-[13px] ${
                      !on ? "text-[#9CA3AF] line-through" : line.range ? "font-semibold text-ks-charcoal" : "font-medium text-ks-stone"
                    }`}
                  >
                    {line.range ? formatRange(line.range) : "In your quote"}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-ks-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
          <div aria-live="polite" className="flex items-baseline justify-between gap-2.5">
            <span className="text-[14px] text-[#4B5563]">
              {ticked.length} of {total} pieces
            </span>
            <span className="font-serif text-[22px] font-semibold text-ks-ink">
              {estimate.priced > 0 ? formatTotal(estimate.low, estimate.high) : "In your quote"}
            </span>
          </div>
          <p className="text-[12px] leading-snug text-ks-stone">{note}</p>
          <button
            type="button"
            disabled={ticked.length === 0}
            onClick={() => onQuote(ticked.map((line) => line.piece.id))}
            className="h-[52px] rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ticked.length === 0 ? "Tick at least one piece" : `Get a quote for ${ticked.length === total ? "all" : "these"} ${ticked.length}`}
          </button>
        </div>
      </div>
    </div>
  )
}
