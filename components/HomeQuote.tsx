"use client"

/**
 * "Get a quote for my home" (sketch approved by Ayo 7 Nov 2026): a card on Your rooms when
 * two or more rooms have designs, and a sheet that sends one quote request for every room
 * ticked. Each room uses its latest design unless another is picked ("Change design").
 */

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, Check, X } from "lucide-react"
import {
  HOME_TIMINGS,
  canSendHomeQuote,
  chosenDesign,
  designWhen,
  homeQuoteMessage,
  homeTotal,
  homeTotalLabel,
  roomEstimate,
  roomsWithDesigns,
  showHomeQuote,
  tiersPhrase,
} from "@/lib/design/homeQuote"
import type { HomeRoom, HomeTiming } from "@/lib/design/homeQuote"
import { TIER_LABELS, formatTotal } from "@/lib/design/estimate"
import { QUOTE_REPLY_PROMISE } from "@/lib/design/quote"
import { readDetected } from "@/lib/design/pieceEdit"
import type { DetectedPiece } from "@/lib/design/pieceEdit"
import { styleDisplayName } from "@/lib/design/studioStyles"
import { quoteRequestLink } from "@/lib/landing"
import { track } from "@/lib/tracking"

interface YourHomeProps {
  rooms: HomeRoom[]
  /** Opened from a design's "Get a quote" (/profile/me?quote=home). */
  openOnLoad?: boolean
}

/** The "Your home" card and the whole-home quote sheet, for the Your rooms page. */
export default function YourHome({ rooms, openOnLoad = false }: YourHomeProps) {
  const withDesigns = roomsWithDesigns(rooms)
  const [open, setOpen] = useState(openOnLoad && withDesigns.length > 0)

  const close = () => {
    setOpen(false)
    // Drop ?quote=home so a reload doesn't open it again (no navigation, so a mail link isn't cut off).
    if (openOnLoad && window.location.search) window.history.replaceState(null, "", "/profile/me")
  }

  if (withDesigns.length === 0) return null

  const total = homeTotal(withDesigns.map((room) => roomEstimate(room.budget, chosenDesign(room)?.detected).range))
  const totalLabel = homeTotalLabel(total)

  return (
    <>
      {showHomeQuote(rooms) && (
        <section
          aria-label="Your home"
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-ks-sand bg-[#FBF8F2] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <div aria-hidden="true" className="flex flex-shrink-0">
              {withDesigns.slice(0, 3).map((room, index) => (
                <img
                  key={room.id}
                  src={chosenDesign(room)?.imageUrl}
                  alt=""
                  className={`h-11 w-11 rounded-xl border-2 border-[#FBF8F2] object-cover ${index > 0 ? "-ml-3.5" : ""}`}
                />
              ))}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug text-[#4B5563]">Your home · {withDesigns.length} rooms</p>
              <p className="mt-0.5 font-serif text-[21px] font-semibold leading-tight text-ks-ink">
                {totalLabel ?? "One quote for every room"}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-ks-stone">
                {totalLabel
                  ? `Our estimate for every room's latest design, ${tiersPhrase(withDesigns.map((room) => roomEstimate(room.budget, null).tier))}.`
                  : "Local makers and shops price every room's latest design."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-12 flex-shrink-0 items-center justify-center rounded-xl bg-ks-charcoal px-5 text-[15px] font-semibold text-white outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ks-charcoal focus-visible:ring-offset-2"
          >
            Get a quote for my home
          </button>
        </section>
      )}
      <HomeQuoteSheet open={open} rooms={withDesigns} onClose={close} />
    </>
  )
}

interface HomeQuoteSheetProps {
  open: boolean
  /** Rooms with at least one design, newest activity first. */
  rooms: HomeRoom[]
  onClose: () => void
}

function HomeQuoteSheet({ open, rooms, onClose }: HomeQuoteSheetProps) {
  const [excluded, setExcluded] = useState<string[]>([])
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [found, setFound] = useState<Record<string, DetectedPiece[]>>({})
  const [failed, setFailed] = useState<string[]>([])
  const [timing, setTiming] = useState<HomeTiming | null>(null)
  const [notes, setNotes] = useState("")
  const [picking, setPicking] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const looking = useRef<Set<string>>(new Set())

  // Fresh each time it opens; count the opening; keep the page behind still.
  useEffect(() => {
    if (!open) return
    setExcluded([])
    setPicking(null)
    setTiming(null)
    setNotes("")
    track("quote_home_opened")
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [open, picking])

  const piecesOf = (design: { id: string; detected?: DetectedPiece[] | null }) => found[design.id] ?? design.detected ?? null

  // Find the pieces of each chosen design that hasn't been priced yet (same call as on the design screen).
  const chosenIds = rooms.map((room) => `${room.id}:${chosenDesign(room, picks[room.id])?.id ?? ""}`).join(",")
  useEffect(() => {
    if (!open) return
    for (const room of rooms) {
      const design = chosenDesign(room, picks[room.id])
      if (!design || piecesOf(design) || failed.includes(design.id) || looking.current.has(design.id)) continue
      looking.current.add(design.id)
      void fetch("/api/ai/detect-pieces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: room.id, designId: design.id }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null)
          if (!res.ok || !data?.success) throw new Error("not found")
          setFound((all) => ({ ...all, [design.id]: readDetected(data.pieces) ?? [] }))
        })
        .catch(() => setFailed((all) => [...all, design.id]))
        .finally(() => looking.current.delete(design.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chosenIds])

  if (!open) return null

  const lines = rooms.map((room) => {
    const design = chosenDesign(room, picks[room.id])!
    const pieces = piecesOf(design)
    const estimate = roomEstimate(room.budget, pieces)
    const pending = !pieces && !failed.includes(design.id)
    return { room, design, estimate, pending, included: !excluded.includes(room.id) }
  })
  const included = lines.filter((line) => line.included)
  const total = homeTotal(included.map((line) => line.estimate.range))
  const totalLabel = homeTotalLabel(total)
  const stillPricing = included.some((line) => line.pending)
  const request = {
    rooms: included.map((line) => ({
      name: line.room.name,
      style: line.design.style,
      tier: line.estimate.tier,
      range: line.estimate.range,
      designUrl: line.design.imageUrl,
    })),
    timing,
    notes,
  }
  const ready = canSendHomeQuote(request)
  const link = ready ? quoteRequestLink(homeQuoteMessage(request)) : null

  const pickingRoom = picking ? rooms.find((room) => room.id === picking) ?? null : null
  const now = new Date()

  const toggleRoom = (roomId: string) =>
    setExcluded((all) => (all.includes(roomId) ? all.filter((id) => id !== roomId) : [...all, roomId]))

  const openPicker = (room: HomeRoom) => {
    setDraft(chosenDesign(room, picks[room.id])?.id ?? null)
    setPicking(room.id)
  }

  const usePick = () => {
    if (pickingRoom && draft) setPicks((all) => ({ ...all, [pickingRoom.id]: draft }))
    setPicking(null)
  }

  const rangeText = (line: (typeof lines)[number]) =>
    line.estimate.range
      ? formatTotal(line.estimate.range[0], line.estimate.range[1])
      : line.pending
        ? "Working out the estimate…"
        : "Priced in your quote"

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return
        if (picking) setPicking(null)
        else onClose()
      }}
    >
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-[rgba(17,24,39,0.5)]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-quote-title"
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-[20px] bg-white font-sans text-ks-ink sm:max-w-[480px] sm:rounded-[20px]"
      >
        {pickingRoom ? (
          <>
            <div className="overflow-y-auto px-5 pb-2 pt-2.5">
              <div aria-hidden="true" className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-[#D1D5DB] sm:hidden" />
              <div className="flex items-center gap-1 sm:pt-2">
                <button
                  type="button"
                  aria-label="Back"
                  onClick={() => setPicking(null)}
                  className="-ml-3 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-ks-charcoal outline-none hover:bg-ks-paper focus-visible:ring-2 focus-visible:ring-ks-charcoal"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </button>
                <h2 id="home-quote-title" ref={headingRef} tabIndex={-1} className="truncate font-serif text-[24px] font-semibold leading-tight text-ks-ink outline-none">
                  {pickingRoom.name} design
                </h2>
              </div>
              <p className="mt-1 text-[14px] leading-snug text-ks-stone">Your quote uses the design you pick. Newest first.</p>

              <div role="radiogroup" aria-label={`${pickingRoom.name} designs`} className="mt-4 grid grid-cols-2 gap-3">
                {pickingRoom.designs.map((design) => {
                  const on = design.id === draft
                  const estimate = roomEstimate(pickingRoom.budget, piecesOf(design))
                  const when = designWhen(design.createdAt, now)
                  return (
                    <button
                      key={design.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setDraft(design.id)}
                      className={`relative overflow-hidden rounded-[14px] bg-white text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ks-charcoal focus-visible:ring-offset-2 ${
                        on ? "border-2 border-ks-charcoal" : "border border-ks-line hover:border-ks-charcoal"
                      }`}
                    >
                      <img src={design.imageUrl} alt="" className="block h-[120px] w-full object-cover" />
                      {on && (
                        <span aria-hidden="true" className="absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-ks-charcoal text-white">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                      <span className="block px-2.5 pb-2.5 pt-2">
                        <span className="block truncate text-[14px] font-semibold leading-snug text-ks-ink">{styleDisplayName(design.style)}</span>
                        <span className="block truncate text-[12px] leading-snug text-ks-stone">
                          {[when, estimate.range ? formatTotal(estimate.range[0], estimate.range[1]) : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mt-3 border-t border-ks-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={usePick}
                className="flex h-[52px] w-full items-center justify-center rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ks-charcoal focus-visible:ring-offset-2"
              >
                Use this design
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="overflow-y-auto px-5 pb-2 pt-2.5">
              <div aria-hidden="true" className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-[#D1D5DB] sm:hidden" />
              <div className="flex items-center justify-between gap-3 sm:pt-2">
                <h2 id="home-quote-title" ref={headingRef} tabIndex={-1} className="font-serif text-[24px] font-semibold leading-tight text-ks-ink outline-none">
                  Get a quote for your home
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
              <p className="mt-0.5 text-[14px] leading-snug text-ks-stone">
                One request for every room you tick. Local makers and shops price your designs.
              </p>

              <h3 className="mb-1.5 mt-4 text-[13px] font-semibold leading-normal text-ks-stone">Rooms</h3>
              <ul className="flex flex-col">
                {lines.map((line, index) => {
                  const inputId = `home-room-${line.room.id}`
                  return (
                    <li
                      key={line.room.id}
                      className={`flex items-center gap-3 py-2 ${index < lines.length - 1 ? "border-b border-ks-line" : ""}`}
                    >
                      <img
                        src={line.design.imageUrl}
                        alt=""
                        className={`h-14 w-14 flex-shrink-0 rounded-xl object-cover transition-opacity duration-150 ${line.included ? "" : "opacity-40"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={inputId} className="block truncate text-[15px] font-semibold leading-snug text-ks-ink">
                          {line.room.name}
                        </label>
                        <p className="truncate text-[13px] leading-snug text-ks-stone">
                          {styleDisplayName(line.design.style)} · {TIER_LABELS[line.estimate.tier]}
                        </p>
                        <p className="text-[13px] leading-snug">
                          <span className={line.estimate.range ? "font-semibold text-ks-charcoal" : "text-ks-stone"}>{rangeText(line)}</span>
                          {line.room.designs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => openPicker(line.room)}
                              className="ml-2 rounded text-[13px] font-medium text-ks-charcoal underline underline-offset-2 outline-none hover:text-ks-ink focus-visible:ring-2 focus-visible:ring-ks-charcoal"
                            >
                              Change design
                            </button>
                          )}
                        </p>
                      </div>
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={line.included}
                        onChange={() => toggleRoom(line.room.id)}
                        className="m-[11px] h-[22px] w-[22px] flex-shrink-0 cursor-pointer accent-ks-charcoal"
                      />
                    </li>
                  )
                })}
              </ul>

              {included.length > 0 && (
                <div className="mt-2.5 rounded-[14px] border border-ks-sand bg-[#FBF8F2] px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="text-[13px] font-semibold text-[#4B5563]">
                      Our estimate · {included.length === 1 ? "1 room" : `${included.length} rooms`}
                    </span>
                    <span className="font-serif text-[19px] font-semibold text-ks-ink">
                      {totalLabel ?? (stillPricing ? "…" : "In your quote")}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-normal text-ks-stone">
                    {total.open > 0 && totalLabel && !stillPricing
                      ? `${total.open === 1 ? "1 room is" : `${total.open} rooms are`} priced in your quote. `
                      : ""}
                    Each room at its own budget. Curtains and made-to-measure pieces are priced in your quote.
                  </p>
                </div>
              )}

              <h3 className="mb-2 mt-4 text-[14px] font-semibold text-ks-ink">
                When do you need it? <span className="text-[14px] font-normal text-ks-stone">(optional)</span>
              </h3>
              <div role="group" aria-label="When do you need it?" className="flex flex-wrap gap-1.5">
                {HOME_TIMINGS.map((option) => {
                  const on = timing === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTiming(on ? null : option.id)}
                      className={`flex h-10 items-center rounded-full border px-3.5 text-[14px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ks-charcoal focus-visible:ring-offset-2 ${
                        on ? "border-ks-charcoal bg-ks-charcoal text-white" : "border-[#D1D5DB] bg-white text-ks-charcoal hover:border-ks-charcoal"
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>

              <label htmlFor="home-quote-notes" className="mt-4 block text-[14px] font-semibold text-ks-ink">
                Anything we should know? <span className="text-[14px] font-normal text-ks-stone">(optional)</span>
              </label>
              <input
                id="home-quote-notes"
                type="text"
                value={notes}
                maxLength={300}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="For example: area, floor, service lift"
                className="mt-1.5 h-12 w-full rounded-xl border border-[#D1D5DB] bg-white px-3.5 text-[16px] text-ks-ink outline-none focus:border-ks-charcoal"
              />
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-ks-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
              <p className="text-[13px] leading-snug text-ks-stone">
                {QUOTE_REPLY_PROMISE} Your message opens ready to send, with each room's design and estimate.
              </p>
              {link ? (
                <a
                  href={link}
                  target={link.startsWith("https:") ? "_blank" : undefined}
                  rel={link.startsWith("https:") ? "noopener noreferrer" : undefined}
                  onClick={() => {
                    track("quote_home_sent")
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
                  {ready ? "Quotes are not set up yet" : "Tick at least one room"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
