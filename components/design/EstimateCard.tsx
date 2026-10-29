"use client"

import { ChevronRight, Loader2 } from "lucide-react"
import { PRICES_CHECKED, TIER_LABELS, estimateSummary, formatTotal } from "@/lib/design/estimate"
import type { Estimate, PriceTier } from "@/lib/design/estimate"

interface EstimateCardProps {
  /** null while the pieces are being found. */
  estimate: Estimate | null
  error: string | null
  tier: PriceTier
  onTierChange: (tier: PriceTier) => void
  onOpen: () => void
  onRetry: () => void
}

const TIERS: PriceTier[] = ["affordable", "mid", "premium"]

/** "Estimated cost" on the result: typical shop prices for the pieces in the design. */
export default function EstimateCard({ estimate, error, tier, onTierChange, onOpen, onRetry }: EstimateCardProps) {
  const total = estimate ? estimate.lines.length : 0
  const countLine = estimate
    ? estimate.ticked === total
      ? `${total} ${total === 1 ? "piece" : "pieces"}`
      : `${estimate.ticked} of ${total} pieces`
    : ""

  return (
    <section aria-live="polite" className="mt-3.5 rounded-2xl border border-ks-line bg-white px-3.5 pb-3 pt-3.5">
      <div className="flex items-center justify-between gap-2.5">
        <h2 className="font-sans text-[13px] font-semibold leading-normal text-ks-stone">Estimated cost</h2>
        {countLine && <span className="text-[13px] text-ks-stone">{countLine}</span>}
      </div>

      {error ? (
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="text-[14px] leading-snug text-ks-ink">We couldn&apos;t work out an estimate for this design.</p>
          <button
            type="button"
            onClick={onRetry}
            className="flex min-h-[40px] flex-shrink-0 items-center px-1 text-[14px] font-semibold text-ks-charcoal underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      ) : !estimate ? (
        <div className="mt-2">
          <div className="h-7 w-52 animate-pulse rounded-lg bg-ks-sand" />
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ks-stone">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Working out the estimate
          </p>
        </div>
      ) : estimate.lines.length === 0 ? (
        <p className="mt-1.5 text-[14px] leading-snug text-ks-ink">We couldn&apos;t find pieces to price in this design. Your quote covers it.</p>
      ) : estimate.priced === 0 ? (
        <>
          <p className="mt-1 font-serif text-[24px] font-semibold leading-tight text-ks-ink">Priced in your quote</p>
          <p className="mt-1 text-[13px] leading-snug text-[#4B5563]">
            {estimate.ticked === 0 ? "Tick at least one piece." : "These pieces have no typical shop price yet."}
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 font-serif text-[30px] font-semibold leading-tight text-ks-ink">{formatTotal(estimate.low, estimate.high)}</p>
          <p className="mt-1 text-[13px] leading-snug text-[#4B5563]">{estimateSummary(estimate, tier)}</p>
        </>
      )}

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
              className={`h-10 rounded-[9px] text-[14px] font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ks-charcoal ${
                on ? "bg-ks-charcoal text-white" : "text-ks-charcoal hover:bg-white"
              }`}
            >
              {TIER_LABELS[id]}
            </button>
          )
        })}
      </div>

      {estimate && estimate.lines.length > 0 && (
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 flex min-h-[44px] w-full items-center justify-between gap-2 text-left text-[15px] font-semibold text-ks-charcoal outline-none focus-visible:ring-2 focus-visible:ring-ks-charcoal"
        >
          See what&apos;s included
          <ChevronRight className="h-[18px] w-[18px] text-ks-stone" aria-hidden="true" />
        </button>
      )}
      <p className="mt-1 border-t border-[#F0EEE9] pt-2 text-[12px] leading-snug text-ks-stone">
        Typical UAE shop prices for similar pieces, checked {PRICES_CHECKED}. Your quote confirms the real price. Excludes delivery and fitting.
      </p>
    </section>
  )
}
