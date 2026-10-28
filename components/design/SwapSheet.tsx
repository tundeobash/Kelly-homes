"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Check, X } from "lucide-react"
import { SWAP_CHANGES, shortName } from "@/lib/design/pieceEdit"
import type { DetectedPiece } from "@/lib/design/pieceEdit"
import { pieceLabel } from "@/lib/design/pieces"
import type { StudioPiece } from "@/lib/design/pieces"

interface SwapSheetProps {
  open: boolean
  target: DetectedPiece | null
  /** The room's pieces the person loves. */
  pieces: StudioPiece[]
  /** A piece picked to swap in, if any. */
  chosen: StudioPiece | null
  onChoose: (piece: StudioPiece | null) => void
  /** Opens "A piece you love" to add a new photo. */
  onAddPhoto: () => void
  onSwap: (request: { changes: string[]; text: string; piece: StudioPiece | null }) => void
  onClose: () => void
}

function capital(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** "Swap the sofa": quick changes, a piece you love, or what they describe. */
export default function SwapSheet({ open, target, pieces, chosen, onChoose, onAddPhoto, onSwap, onClose }: SwapSheetProps) {
  const [changes, setChanges] = useState<string[]>([])
  const [text, setText] = useState("")
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!open) return
    setChanges([])
    setText("")
    headingRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open, target])

  if (!open || !target) return null

  const short = shortName(target)
  const labels = changes.map((id) => SWAP_CHANGES.find((c) => c.id === id)?.label ?? id)
  if (text.trim()) labels.push(`“${text.trim()}”`)
  const summary = chosen
    ? `Swapping for: your ${pieceLabel(chosen).toLowerCase()}`
    : labels.length > 0
      ? `Swapping for: ${labels.join(" · ")}`
      : `We'll choose a different ${short} that suits the room.`

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
        aria-labelledby="swap-title"
        className="relative flex max-h-[90vh] w-full flex-col rounded-t-[20px] bg-white font-sans text-ks-ink sm:max-w-[480px] sm:rounded-[20px]"
      >
        <div className="overflow-y-auto px-5 pb-2 pt-2.5">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#D1D5DB] sm:hidden" />
          <div className="flex items-center justify-between gap-3 sm:pt-2">
            <div className="min-w-0">
              <h2
                id="swap-title"
                ref={headingRef}
                tabIndex={-1}
                className="font-serif text-[26px] font-semibold leading-tight text-ks-ink outline-none"
              >
                Swap the {short}
              </h2>
              <p className="mt-0.5 truncate text-[13px] text-ks-stone">{capital(target.name)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-ks-charcoal outline-none hover:bg-ks-paper focus-visible:ring-2 focus-visible:ring-ks-charcoal"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <h3 className="mb-2.5 mt-5 text-[13px] font-semibold leading-normal text-ks-stone">Quick changes</h3>
          <div className="flex flex-wrap gap-2">
            {SWAP_CHANGES.map((change) => {
              const on = changes.includes(change.id)
              return (
                <button
                  key={change.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setChanges((list) => (on ? list.filter((x) => x !== change.id) : [...list, change.id].slice(-4)))
                    if (chosen) onChoose(null)
                  }}
                  className={`flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[15px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ks-charcoal focus-visible:ring-offset-2 ${
                    on ? "border-ks-charcoal bg-ks-charcoal text-white" : "border-[#D1D5DB] bg-white text-ks-charcoal hover:border-ks-charcoal"
                  }`}
                >
                  {on && <Check className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden="true" />}
                  {change.label}
                </button>
              )
            })}
          </div>

          <h3 className="mb-2.5 mt-6 text-[13px] font-semibold leading-normal text-ks-stone">Or a piece you love</h3>
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pieces.map((piece) => {
              const on = chosen?.id === piece.id
              return (
                <button
                  key={piece.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    onChoose(on ? null : piece)
                    setChanges([])
                    setText("")
                  }}
                  className="w-24 flex-shrink-0 text-left outline-none"
                >
                  <span
                    className={`relative block h-24 w-24 overflow-hidden rounded-xl border-[3px] ${
                      on ? "border-ks-gold" : "border-transparent"
                    }`}
                  >
                    <img src={piece.imageUrl} alt="" className="h-full w-full object-cover" />
                    {on && (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ks-charcoal text-ks-gold">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block truncate text-[13px] font-medium leading-snug text-ks-ink">{pieceLabel(piece)}</span>
                </button>
              )
            })}
            <button type="button" onClick={onAddPhoto} className="w-24 flex-shrink-0 text-left outline-none">
              <span className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-[#9CA3AF] bg-ks-paper text-ks-charcoal">
                <Camera className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="mt-1.5 block text-[13px] font-medium leading-snug text-ks-ink">Add a photo</span>
            </button>
          </div>

          <label htmlFor="swap-text" className="mb-2 mt-6 block text-[13px] font-semibold leading-normal text-ks-stone">
            Or describe it
          </label>
          <input
            id="swap-text"
            type="text"
            value={text}
            maxLength={200}
            onChange={(e) => {
              setText(e.target.value)
              if (chosen && e.target.value) onChoose(null)
            }}
            placeholder={`For example: a low cream ${short} with wooden legs`}
            className="h-12 w-full rounded-xl border border-[#D1D5DB] bg-white px-3.5 text-[16px] text-ks-ink outline-none focus:border-ks-charcoal"
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-ks-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
          <p className="text-[14px] leading-snug text-[#4B5563]" aria-live="polite">
            {summary}
          </p>
          <button
            type="button"
            onClick={() => onSwap({ changes: chosen ? [] : changes, text: chosen ? "" : text.trim(), piece: chosen })}
            className="h-[52px] rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            Swap the {short}
          </button>
          <p className="text-center text-[13px] leading-snug text-ks-stone">Everything else stays as it is. About a minute.</p>
        </div>
      </div>
    </div>
  )
}
