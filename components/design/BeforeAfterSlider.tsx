"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent } from "react"
import { ChevronsLeftRight } from "lucide-react"

interface BeforeAfterSliderProps {
  beforeSrc: string | null
  beforeAlt?: string
  afterSrc: string
  afterAlt: string
  /** Called once, the first time the slider is moved. */
  onFirstMove?: () => void
}

/**
 * Before/after on one picture. Drag right to see more of the photo as it is,
 * left to see more of the new design. Arrow keys work too.
 */
export default function BeforeAfterSlider({
  beforeSrc,
  beforeAlt = "Before: your room as photographed",
  afterSrc,
  afterAlt,
  onFirstMove,
}: BeforeAfterSliderProps) {
  const [pos, setPos] = useState(50)
  const [touched, setTouched] = useState(false)
  const [ratio, setRatio] = useState(3 / 4)
  const [beforeFailed, setBeforeFailed] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const firstMove = useRef(onFirstMove)
  firstMove.current = onFirstMove

  useEffect(() => {
    if (touched) firstMove.current?.()
  }, [touched])

  const showBefore = Boolean(beforeSrc) && !beforeFailed

  const moveTo = useCallback((clientX: number) => {
    const box = boxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    if (rect.width <= 0) return
    const next = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.max(0, Math.min(100, next)))
    setTouched(true)
  }, [])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!showBefore) return
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    moveTo(e.clientX)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) moveTo(e.clientX)
  }
  const stopDragging = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null
    if (e.key === "ArrowLeft") next = pos - 5
    else if (e.key === "ArrowRight") next = pos + 5
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = 100
    if (next === null) return
    e.preventDefault()
    setPos(Math.max(0, Math.min(100, next)))
    setTouched(true)
  }

  return (
    <div
      ref={boxRef}
      className={`relative mx-auto w-full select-none overflow-hidden rounded-2xl bg-ks-sand ${
        showBefore ? "cursor-ew-resize touch-pan-y" : ""
      }`}
      style={{ aspectRatio: `${ratio}`, maxWidth: `calc(76vh * ${ratio})` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      <img
        src={afterSrc}
        alt={afterAlt}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        onLoad={(e) => {
          if (showBefore) return
          const img = e.currentTarget
          if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight)
        }}
      />

      {showBefore && beforeSrc && (
        <>
          <img
            src={beforeSrc}
            alt={beforeAlt}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight)
            }}
            onError={() => setBeforeFailed(true)}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_6px_rgba(17,24,39,0.35)]"
            style={{ left: `calc(${pos}% - 1px)` }}
          />
          <div
            role="slider"
            tabIndex={0}
            aria-label="Compare before and after"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            aria-valuetext={`${Math.round(pos)}% before photo`}
            onKeyDown={onKeyDown}
            className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ks-charcoal shadow-[0_2px_10px_rgba(17,24,39,0.25)] outline-none focus-visible:ring-2 focus-visible:ring-ks-gold"
            style={{ left: `${pos}%` }}
          >
            <ChevronsLeftRight className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[rgba(17,24,39,0.72)] px-2.5 py-1.5 text-[12px] font-medium leading-none text-white">
            Before
          </span>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-[rgba(17,24,39,0.72)] px-2.5 py-1.5 text-[12px] font-medium leading-none text-white">
            After
          </span>
          {!touched && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3.5 flex justify-center">
              <span className="flex items-center gap-1.5 rounded-full bg-[rgba(17,24,39,0.78)] px-3 py-2 text-[13px] font-medium leading-none text-white">
                <ChevronsLeftRight className="h-4 w-4" aria-hidden="true" />
                Drag to see before and after
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
