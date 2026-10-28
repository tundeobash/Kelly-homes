"use client"

import { useEffect, useRef, useState } from "react"
import { Check, X } from "lucide-react"
import { QUOTE_REPLY_PROMISE, canSendQuote, quoteItemsFor, quoteMessage } from "@/lib/design/quote"
import type { StudioDesign } from "@/lib/design/studioFlow"
import { quoteRequestLink } from "@/lib/landing"
import { track } from "@/lib/tracking"

interface QuoteSheetProps {
  open: boolean
  design: StudioDesign | null
  roomName: string
  styleName: string
  projectId: string
  /** Open with this item ticked and "Specific pieces" chosen, e.g. "piece:<id>". */
  preselect?: string | null
  onClose: () => void
}

/** "Get a quote": the whole room, or chosen pieces. Sends one message to us. */
export default function QuoteSheet({ open, design, roomName, styleName, projectId, preselect, onClose }: QuoteSheetProps) {
  const [wholeRoom, setWholeRoom] = useState(true)
  const [ticked, setTicked] = useState<string[]>([])
  const [other, setOther] = useState("")
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!open) return
    setWholeRoom(!preselect)
    setTicked(preselect ? [preselect] : [])
    setOther("")
    headingRef.current?.focus()
    track("quote_opened", projectId)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open, preselect, projectId])

  if (!open || !design) return null

  const items = quoteItemsFor(design)
  const chosen = items.filter((item) => ticked.includes(item.id))
  const request = { roomName, styleName, designUrl: design.imageUrl, wholeRoom, items: chosen, other }
  const ready = canSendQuote(request)
  const link = ready ? quoteRequestLink(quoteMessage(request)) : null

  const choice = (on: boolean, label: string, hint: string, select: () => void) => (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={select}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ks-charcoal ${
        on ? "border-ks-charcoal bg-ks-paper" : "border-ks-line bg-white hover:border-ks-charcoal"
      }`}
    >
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
          on ? "border-ks-charcoal" : "border-[#9CA3AF]"
        }`}
      >
        {on && <span className="h-2.5 w-2.5 rounded-full bg-ks-charcoal" />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold leading-snug text-ks-ink">{label}</span>
        <span className="text-[13px] leading-snug text-ks-stone">{hint}</span>
      </span>
    </button>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
    >
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-[rgba(17,24,39,0.5)]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-title"
        className="relative flex max-h-[90vh] w-full flex-col rounded-t-[20px] bg-white font-sans text-ks-ink sm:max-w-[480px] sm:rounded-[20px]"
      >
        <div className="overflow-y-auto px-5 pb-2 pt-2.5">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#D1D5DB] sm:hidden" />
          <div className="flex items-center justify-between gap-3 sm:pt-2">
            <h2 id="quote-title" ref={headingRef} tabIndex={-1} className="font-serif text-[26px] font-semibold leading-tight text-ks-ink outline-none">
              Get a quote
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
          <div className="mt-2 flex items-center gap-3">
            <img src={design.imageUrl} alt="" className="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
            <p className="text-[14px] leading-snug text-ks-stone">
              Prices from local makers and shops to make this {styleName} design real.
            </p>
          </div>

          <h3 className="mb-2.5 mt-5 text-[13px] font-semibold leading-normal text-ks-stone">What would you like a quote for?</h3>
          <div role="radiogroup" aria-label="What would you like a quote for?" className="flex flex-col gap-2">
            {choice(wholeRoom, "The whole room", "Everything in this design", () => setWholeRoom(true))}
            {choice(!wholeRoom, "Specific pieces", items.length > 0 ? "Pick the pieces you want" : "Tell us which pieces", () => setWholeRoom(false))}
          </div>

          {!wholeRoom && items.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {items.map((item) => {
                const on = ticked.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setTicked((list) => (on ? list.filter((x) => x !== item.id) : [...list, item.id]))}
                    className={`flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[15px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ks-charcoal focus-visible:ring-offset-2 ${
                      on ? "border-ks-charcoal bg-ks-charcoal text-white" : "border-[#D1D5DB] bg-white text-ks-charcoal hover:border-ks-charcoal"
                    }`}
                  >
                    {on && <Check className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden="true" />}
                    {item.label}
                  </button>
                )
              })}
            </div>
          )}

          <label htmlFor="quote-other" className="mt-4 block text-[14px] font-semibold text-ks-ink">
            {wholeRoom ? "Anything we should know?" : items.length > 0 ? "Anything else?" : "Which pieces?"}{" "}
            <span className="text-[14px] font-normal text-ks-stone">{wholeRoom || items.length > 0 ? "(optional)" : ""}</span>
          </label>
          <input
            id="quote-other"
            type="text"
            value={other}
            maxLength={300}
            onChange={(e) => setOther(e.target.value)}
            placeholder={wholeRoom ? "For example: budget, or when you move in" : "For example: the rug and the TV unit"}
            className="mt-1.5 h-12 w-full rounded-xl border border-[#D1D5DB] bg-white px-3.5 text-[16px] text-ks-ink outline-none focus:border-ks-charcoal"
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-ks-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
          <p className="text-[13px] leading-snug text-ks-stone">{QUOTE_REPLY_PROMISE} Your message opens ready to send.</p>
          {link ? (
            <a
              href={link}
              target={link.startsWith("https:") ? "_blank" : undefined}
              rel={link.startsWith("https:") ? "noopener noreferrer" : undefined}
              onClick={() => {
                track(wholeRoom ? "quote_room_sent" : "quote_pieces_sent", projectId)
                onClose()
              }}
              className="flex h-[52px] items-center justify-center rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            >
              Send quote request
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex h-[52px] cursor-not-allowed items-center justify-center rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white opacity-40"
            >
              {ready ? "Quotes are not set up yet" : "Pick at least one piece"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
