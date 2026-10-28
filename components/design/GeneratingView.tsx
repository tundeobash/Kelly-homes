"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { DESIGN_STEPS, progressAt, stepIndexAt } from "@/lib/design/studioFlow"

interface GeneratingViewProps {
  photoUrl: string | null
  styleName: string
  roomLabel: string
  roomName: string
  startedAt: number
  /** Heading instead of "Designing your …", e.g. "Swapping the sofa". */
  title?: string
}

export default function GeneratingView({ photoUrl, styleName, roomLabel, roomName, startedAt, title }: GeneratingViewProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  const elapsed = Math.max(0, now - startedAt)
  const progress = progressAt(elapsed)
  const current = stepIndexAt(elapsed)

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
      <div className="relative overflow-hidden rounded-2xl bg-ks-sand">
        {photoUrl && (
          <img
            src={photoUrl}
            alt={`Your room, being redesigned in ${styleName} style`}
            className="block max-h-[52vh] w-full object-cover saturate-[0.6] brightness-[0.92] lg:max-h-[76vh]"
          />
        )}
        <div
          aria-hidden="true"
          className="ks-scan absolute inset-x-0 h-0.5 bg-ks-gold shadow-[0_0_18px_6px_rgba(201,169,106,0.45)]"
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-[rgba(17,24,39,0.72)] px-2.5 py-1.5 text-[13px] font-medium leading-none text-white">
          {styleName}
        </span>
      </div>

      <div className="mt-6 lg:mt-2">
        <h1 className="mb-3.5 font-serif text-[24px] font-semibold leading-tight text-ks-ink">
          {title || `Designing your ${roomLabel}`}
        </h1>
        <div
          role="progressbar"
          aria-label="Design progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-1.5 overflow-hidden rounded-full bg-ks-sand"
        >
          <div className="h-full rounded-full bg-ks-charcoal transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-[13px] text-ks-stone">Usually 30 to 50 seconds</p>

        <ol className="mt-5 flex flex-col gap-3.5" aria-live="polite">
          {DESIGN_STEPS.map((step, index) => {
            const done = index < current
            const active = index === current
            return (
              <li key={step} className="flex items-center gap-3">
                {done ? (
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ks-charcoal text-ks-gold">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
                  </span>
                ) : active ? (
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-ks-charcoal">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-ks-charcoal" />
                  </span>
                ) : (
                  <span className="h-6 w-6 flex-shrink-0 rounded-full border-2 border-[#D1D5DB]" />
                )}
                <span
                  className={`text-[15px] leading-snug ${
                    active ? "font-semibold text-ks-ink" : done ? "text-ks-ink" : "text-ks-stone"
                  }`}
                >
                  {step}
                  {done && <span className="sr-only"> (done)</span>}
                </span>
              </li>
            )
          })}
        </ol>

        <p className="mt-8 text-center text-[13px] leading-normal text-ks-stone lg:text-left">
          Keep this page open. Your design saves to {roomName} when it is ready.
        </p>
      </div>
    </div>
  )
}
