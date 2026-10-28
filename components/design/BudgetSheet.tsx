"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { BUDGET_TIERS, budgetCoverage, budgetPrice } from "@/lib/design/budget"
import type { BudgetTier } from "@/lib/design/budget"

interface BudgetSheetProps {
  open: boolean
  roomType: string
  value: BudgetTier | null
  onChange: (tier: BudgetTier) => void
  onClose: () => void
}

/** "Your budget" on the style step: a band in AED. It goes into the quote; the design stays the same. */
export default function BudgetSheet({ open, roomType, value, onChange, onClose }: BudgetSheetProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!open) return
    headingRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

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
        aria-labelledby="budget-title"
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-[20px] bg-white font-sans text-ks-ink sm:max-w-[480px] sm:rounded-[20px]"
      >
        <div className="overflow-y-auto px-5 pt-2.5">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#D1D5DB] sm:hidden" />
          <div className="flex items-center justify-between gap-3 sm:pt-2">
            <h2
              id="budget-title"
              ref={headingRef}
              tabIndex={-1}
              className="font-serif text-[26px] font-semibold leading-tight text-ks-ink outline-none"
            >
              Your budget
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-ks-charcoal outline-none hover:bg-ks-paper focus-visible:ring-2 focus-visible:ring-ks-charcoal"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-[15px] leading-normal text-[#4B5563]">{budgetCoverage(roomType)}</p>
          <p className="mt-1.5 text-[14px] leading-normal text-ks-stone">
            Your design looks the same at any budget. We use it to pick real pieces and prices for your quote.
          </p>

          <div role="radiogroup" aria-label="Budget for this room" className="mt-4 flex flex-col gap-2.5">
            {BUDGET_TIERS.map((tier) => {
              const on = tier.id === value
              const price = budgetPrice(roomType, tier.id)
              return (
                <button
                  key={tier.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(tier.id)}
                  className={`flex w-full items-start gap-3 rounded-[14px] border-2 px-3.5 py-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ks-charcoal ${
                    on ? "border-ks-gold bg-[#FBF8F2]" : "border-ks-line bg-white hover:border-[#D1D5DB]"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      on ? "border-ks-charcoal" : "border-[#9CA3AF]"
                    }`}
                  >
                    {on && <span className="h-2.5 w-2.5 rounded-full bg-ks-charcoal" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline justify-between gap-2.5">
                      <span className="text-[16px] font-semibold leading-snug text-ks-ink">{tier.label}</span>
                      {price && (
                        <span className="whitespace-nowrap text-[14px] font-semibold text-ks-charcoal">{price}</span>
                      )}
                    </span>
                    <span className="text-[14px] leading-snug text-[#4B5563]">{tier.what}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-ks-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="h-[52px] rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            Done
          </button>
          <p className="text-center text-[13px] leading-snug text-ks-stone">
            You can change it any time. Delivery and fitting are quoted separately.
          </p>
        </div>
      </div>
    </div>
  )
}
