"use client"

import { useEffect, useState } from "react"
import type { MouseEvent } from "react"
import { ArrowLeftRight, Loader2, Move, Trash2 } from "lucide-react"
import { shortName } from "@/lib/design/pieceEdit"
import type { DetectedPiece } from "@/lib/design/pieceEdit"

interface ChangePieceViewProps {
  imageUrl: string
  styleName: string
  /** null while they are being found. */
  pieces: DetectedPiece[] | null
  error: string | null
  onRetry: () => void
  onSwap: (piece: DetectedPiece) => void
  onMove: (piece: DetectedPiece, to: { x: number; y: number }) => void
  onRemove: (piece: DetectedPiece) => void
}

type Mode = "pick" | "remove" | "move"

function pct(n: number): string {
  return `${Math.round(n * 10000) / 100}%`
}

function capital(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/**
 * "Change a piece": dots on the pieces found in the design. Tap one, then swap it,
 * move it (tap the new spot) or remove it. Each change makes a new design.
 */
export default function ChangePieceView({ imageUrl, styleName, pieces, error, onRetry, onSwap, onMove, onRemove }: ChangePieceViewProps) {
  const [ratio, setRatio] = useState(3 / 4)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("pick")
  const [to, setTo] = useState<{ x: number; y: number } | null>(null)

  // A new design or a new list starts afresh.
  useEffect(() => {
    setPickedId(null)
    setMode("pick")
    setTo(null)
  }, [imageUrl, pieces])

  const picked = pieces?.find((p) => p.id === pickedId) ?? null
  const short = picked ? shortName(picked) : ""

  const tapSpot = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const x = Math.min(0.98, Math.max(0.02, (e.clientX - rect.left) / rect.width))
    const y = Math.min(0.98, Math.max(0.02, (e.clientY - rect.top) / rect.height))
    setTo({ x, y })
  }

  const actionClass =
    "flex h-[52px] items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold outline-none transition-opacity duration-150 focus-visible:ring-2 focus-visible:ring-ks-charcoal focus-visible:ring-offset-2"

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
      <div
        className="relative mx-auto w-full select-none overflow-hidden rounded-2xl bg-ks-sand"
        style={{ aspectRatio: `${ratio}`, maxWidth: `calc(76vh * ${ratio})` }}
      >
        <img
          src={imageUrl}
          alt={`Your ${styleName} design`}
          draggable={false}
          className="absolute inset-0 h-full w-full"
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight)
          }}
        />

        {picked && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-xl border-[3px] border-ks-gold shadow-[0_0_0_2px_#fff,0_0_0_9999px_rgba(17,24,39,0.38)]"
            style={{
              left: pct(picked.box.left),
              top: pct(picked.box.top),
              width: pct(picked.box.right - picked.box.left),
              height: pct(picked.box.bottom - picked.box.top),
            }}
          />
        )}

        {mode === "move" && picked ? (
          <button
            type="button"
            onClick={tapSpot}
            aria-label={`Tap where the ${short} should go`}
            className="absolute inset-0 cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ks-gold"
          >
            {to && (
              <>
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                  <line
                    x1={pct(picked.point.x)}
                    y1={pct(picked.point.y)}
                    x2={pct(to.x)}
                    y2={pct(to.y)}
                    stroke="#fff"
                    strokeWidth="2"
                    strokeDasharray="6 5"
                    style={{ filter: "drop-shadow(0 0 2px rgba(17,24,39,0.6))" }}
                  />
                </svg>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-ks-gold shadow-[0_2px_8px_rgba(17,24,39,0.5)]"
                  style={{ left: pct(to.x), top: pct(to.y) }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -translate-x-1/2 rounded-full bg-ks-charcoal px-2.5 py-1 text-[12px] font-semibold text-white"
                  style={{ left: pct(Math.min(0.88, Math.max(0.12, to.x))), top: `calc(${pct(to.y)} - 44px)` }}
                >
                  New spot
                </span>
              </>
            )}
          </button>
        ) : (
          pieces?.map((piece) => {
            const on = piece.id === pickedId
            return (
              <button
                key={piece.id}
                type="button"
                aria-label={capital(piece.name)}
                aria-pressed={on}
                onClick={() => {
                  setPickedId(on ? null : piece.id)
                  setMode("pick")
                }}
                className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-ks-gold"
                style={{ left: pct(Math.min(0.96, Math.max(0.04, piece.point.x))), top: pct(Math.min(0.96, Math.max(0.04, piece.point.y))) }}
              >
                <span
                  className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white shadow-[0_1px_6px_rgba(17,24,39,0.45)] ${
                    on ? "bg-ks-gold" : "bg-white"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${on ? "bg-white" : "bg-ks-charcoal"}`} />
                </span>
              </button>
            )
          })
        )}

        {pieces === null && !error && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="flex items-center gap-2 rounded-full bg-[rgba(17,24,39,0.78)] px-3 py-2 text-[13px] font-medium leading-none text-white">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Finding the pieces
            </span>
          </div>
        )}
      </div>

      <section aria-live="polite" className="mt-4 pb-10 lg:mt-2">
        {error ? (
          <>
            <p className="text-[18px] font-semibold leading-snug text-ks-ink">We couldn&apos;t find the pieces</p>
            <p className="mt-1 text-[14px] leading-normal text-ks-stone">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 h-12 rounded-xl border border-ks-charcoal bg-white px-5 text-[15px] font-semibold text-ks-charcoal"
            >
              Try again
            </button>
          </>
        ) : pieces !== null && pieces.length === 0 ? (
          <>
            <p className="text-[18px] font-semibold leading-snug text-ks-ink">No pieces found in this design</p>
            <p className="mt-1 text-[14px] leading-normal text-ks-stone">Try again, or add a piece you love from the design screen.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 h-12 rounded-xl border border-ks-charcoal bg-white px-5 text-[15px] font-semibold text-ks-charcoal"
            >
              Try again
            </button>
          </>
        ) : !picked ? (
          <>
            <p className="text-[18px] font-semibold leading-snug text-ks-ink">
              {pieces === null ? "Finding the pieces in your design" : "Tap a dot to choose a piece"}
            </p>
            <p className="mt-1 text-[14px] leading-normal text-ks-stone">You can swap it for something else, move it or remove it.</p>
          </>
        ) : mode === "move" ? (
          <>
            <p className="text-[18px] font-semibold leading-snug text-ks-ink">Tap where the {short} should go</p>
            <p className="mt-1 text-[14px] leading-normal text-ks-stone">Everything else stays where it is.</p>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                disabled={!to}
                onClick={() => to && onMove(picked, to)}
                className={`${actionClass} bg-ks-charcoal text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Move it here
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("pick")
                  setTo(null)
                }}
                className={`${actionClass} border border-[#D1D5DB] bg-white px-5 text-ks-charcoal`}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[18px] font-semibold leading-snug text-ks-ink">{capital(picked.name)}</p>
            <p className="mt-0.5 text-[13px] leading-normal text-ks-stone">Tap another dot to pick a different piece</p>
            {mode === "remove" ? (
              <div className="mt-3 rounded-xl border border-ks-sand bg-[#FBF8F2] p-3">
                <p className="text-[14px] leading-normal text-ks-ink">
                  Remove the {short}? Everything else stays as it is. About a minute.
                </p>
                <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    onClick={() => onRemove(picked)}
                    className="h-11 rounded-[10px] bg-ks-charcoal text-[15px] font-semibold text-white hover:opacity-90"
                  >
                    Remove it
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("pick")}
                    className="h-11 rounded-[10px] border border-[#D1D5DB] bg-white px-5 text-[15px] font-medium text-ks-charcoal"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => onSwap(picked)} className={`${actionClass} bg-ks-charcoal text-white hover:opacity-90`}>
                  <ArrowLeftRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  Swap
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTo(null)
                    setMode("move")
                  }}
                  className={`${actionClass} border border-ks-charcoal bg-white text-ks-charcoal`}
                >
                  <Move className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  Move
                </button>
                <button
                  type="button"
                  onClick={() => setMode("remove")}
                  className={`${actionClass} border border-ks-charcoal bg-white text-ks-charcoal`}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  Remove
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
