"use client"

import { useEffect, useRef } from "react"
import { Check, X } from "lucide-react"
import { LEAVE_OUT_LIMIT, leaveOutOptionsFor, toggleLeaveOut } from "@/lib/design/leaveOut"

interface LeaveOutSheetProps {
  open: boolean
  picked: string[]
  /** Must include picks: picking one of those here takes it off that list. */
  mustInclude: string[]
  roomType: string
  onChange: (ids: string[]) => void
  onClose: () => void
}

/** The "Leave out" sheet on the style step: up to four pieces the design must not have. */
export default function LeaveOutSheet({ open, picked, mustInclude, roomType, onChange, onClose }: LeaveOutSheetProps) {
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

  const options = leaveOutOptionsFor(roomType)
  const full = picked.length >= LEAVE_OUT_LIMIT
  const clash = options.some((option) => mustInclude.includes(option.id))
  const countLabel = picked.length === 0 ? "Nothing picked yet" : picked.length === 1 ? "1 piece left out" : `${picked.length} pieces left out`

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
        aria-labelledby="leave-out-title"
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-[20px] bg-white font-sans text-ks-ink sm:max-w-[480px] sm:rounded-[20px]"
      >
        <div className="overflow-y-auto px-5 pt-2.5">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#D1D5DB] sm:hidden" />
          <div className="flex items-center justify-between gap-3 sm:pt-2">
            <h2
              id="leave-out-title"
              ref={headingRef}
              tabIndex={-1}
              className="font-serif text-[26px] font-semibold leading-tight text-ks-ink outline-none"
            >
              Leave out
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
          <p className="mt-1 text-[15px] leading-normal text-ks-stone">
            Pick what you don&apos;t want in this room. We keep it out of the design.
          </p>

          <h3 className="mb-2.5 mt-5 text-[13px] font-semibold leading-normal text-ks-stone">
            Leave out (up to {LEAVE_OUT_LIMIT})
          </h3>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => {
              const on = picked.includes(option.id)
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => onChange(toggleLeaveOut(picked, option.id))}
                  className={`flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[15px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ks-charcoal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                    on
                      ? "border-ks-charcoal bg-ks-charcoal text-white"
                      : "border-[#D1D5DB] bg-white text-ks-charcoal hover:border-ks-charcoal"
                  }`}
                >
                  {on && <Check className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden="true" />}
                  {option.label}
                </button>
              )
            })}
          </div>
          <p className="mt-2.5 text-[13px] leading-normal text-ks-stone">
            {full
              ? "That's the most for one design."
              : "We always keep the room\u2019s main piece, like the sofa or the bed."}
          </p>
          {clash && (
            <p className="mt-2 text-[13px] leading-normal text-ks-stone">
              Picking something you asked for in Must include takes it off that list.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-ks-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
          <p className="flex-1 text-[14px] text-ks-stone" aria-live="polite">
            {countLabel}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="h-[52px] rounded-xl bg-ks-charcoal px-7 text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
