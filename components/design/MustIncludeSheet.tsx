"use client"

import { useEffect, useRef } from "react"
import { Camera, Check, X } from "lucide-react"
import { MUST_INCLUDE_LIMIT, MUST_INCLUDE_OPTIONS, toggleMustInclude } from "@/lib/design/mustInclude"
import { pieceLabel } from "@/lib/design/pieces"
import type { StudioPiece } from "@/lib/design/pieces"

interface MustIncludeSheetProps {
  open: boolean
  picked: string[]
  roomType: string
  onChange: (ids: string[]) => void
  onClose: () => void
  /** A piece the person loves, for the next design. */
  piece: StudioPiece | null
  onAddPiece: () => void
  onRemovePiece: () => void
}

/** The "Must include" sheet on the style step: up to three pieces the design has to have. */
export default function MustIncludeSheet({
  open,
  picked,
  roomType,
  onChange,
  onClose,
  piece,
  onAddPiece,
  onRemovePiece,
}: MustIncludeSheetProps) {
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

  const livingDining = roomType.trim().toLowerCase() === "living and dining room"
  const options = MUST_INCLUDE_OPTIONS.filter((option) => !(livingDining && option.id === "dining-table"))
  const full = picked.length >= MUST_INCLUDE_LIMIT
  const count = picked.length + (piece ? 1 : 0)
  const countLabel = count === 0 ? "Nothing picked yet" : count === 1 ? "1 piece picked" : `${count} pieces picked`

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
        aria-labelledby="must-include-title"
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-[20px] bg-white font-sans text-ks-ink sm:max-w-[480px] sm:rounded-[20px]"
      >
        <div className="overflow-y-auto px-5 pt-2.5">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#D1D5DB] sm:hidden" />
          <div className="flex items-center justify-between gap-3 sm:pt-2">
            <h2
              id="must-include-title"
              ref={headingRef}
              tabIndex={-1}
              className="font-serif text-[26px] font-semibold leading-tight text-ks-ink outline-none"
            >
              Must include
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
            Pick what this room has to have. We fit it in, in a size that suits the space.
          </p>

          <h3 className="mb-2.5 mt-5 text-[13px] font-semibold leading-normal text-ks-stone">
            Furniture you need (up to {MUST_INCLUDE_LIMIT})
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
                  onClick={() => onChange(toggleMustInclude(picked, option.id))}
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
              ? "That's the most for one design. Make another design for more."
              : "In a small room we choose compact pieces, like a round table for two, rather than leave one out."}
          </p>
          {livingDining && (
            <p className="mt-2 text-[13px] leading-normal text-ks-stone">
              Your living and dining room always gets a dining table.
            </p>
          )}

          <h3 className="mb-2.5 mt-6 text-[13px] font-semibold leading-normal text-ks-stone">A piece you love</h3>
          {piece ? (
            <div className="flex items-center gap-3 rounded-2xl border border-ks-line bg-ks-paper p-3">
              <img src={piece.imageUrl} alt="" className="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-snug text-ks-ink">{pieceLabel(piece)}</p>
                <p className="text-[13px] leading-snug text-ks-stone">Goes into your next design</p>
              </div>
              <button
                type="button"
                onClick={onAddPiece}
                className="flex min-h-[44px] items-center px-1 text-[14px] font-medium text-ks-charcoal underline underline-offset-4"
              >
                Change
              </button>
              <button
                type="button"
                onClick={onRemovePiece}
                aria-label={`Remove ${pieceLabel(piece)}`}
                className="flex h-10 w-10 items-center justify-center rounded-full text-ks-stone hover:bg-white"
              >
                <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAddPiece}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-dashed border-[#9CA3AF] bg-ks-paper p-4 text-left outline-none transition-colors duration-150 hover:border-ks-charcoal focus-visible:ring-2 focus-visible:ring-ks-charcoal"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-ks-sand text-ks-charcoal">
                <Camera className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-semibold leading-snug text-ks-ink">Add a photo of a piece</span>
                <span className="text-[13px] leading-snug text-ks-stone">
                  In a shop, at a friend&apos;s home, or a screenshot. One piece per design.
                </span>
              </span>
            </button>
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
