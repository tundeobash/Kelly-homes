"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"
import type { StudioFailure } from "@/lib/design/studioFlow"

interface FailureViewProps {
  failure: StudioFailure
  photoUrl: string | null
  hasDesigns: boolean
  onRetry: () => void
  onChooseAnother: () => void
  onSeeDesigns: () => void
}

const primary =
  "flex h-[52px] w-full items-center justify-center rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
const secondary =
  "flex h-[52px] w-full items-center justify-center rounded-xl border border-ks-charcoal bg-white text-[16px] font-semibold text-ks-charcoal transition-colors duration-150 hover:bg-ks-paper"

export default function FailureView({
  failure,
  photoUrl,
  hasDesigns,
  onRetry,
  onChooseAnother,
  onSeeDesigns,
}: FailureViewProps) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="relative h-[300px] overflow-hidden rounded-2xl bg-ks-sand">
        {photoUrl && <img src={photoUrl} alt="Your room photo" className="h-full w-full object-cover opacity-[0.55]" />}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#B42318] shadow-[0_2px_10px_rgba(17,24,39,0.15)]">
            <AlertCircle className="h-[26px] w-[26px]" aria-hidden="true" />
          </span>
        </div>
      </div>

      <h1 className="mb-2 mt-6 font-serif text-[24px] font-semibold leading-tight text-ks-ink">{failure.title}</h1>
      <p role="alert" className="text-[15px] leading-relaxed text-[#4B5563]">
        {failure.message}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {failure.kind === "failed" && (
          <>
            <button type="button" onClick={onRetry} className={primary}>
              Try again
            </button>
            <button type="button" onClick={onChooseAnother} className={secondary}>
              Choose another style
            </button>
          </>
        )}
        {failure.kind === "limit" && (
          <button type="button" onClick={hasDesigns ? onSeeDesigns : onChooseAnother} className={primary}>
            {hasDesigns ? "See your designs" : "Back to styles"}
          </button>
        )}
        {failure.kind === "signin" && (
          <Link href="/auth" className={primary}>
            Sign in
          </Link>
        )}
        {failure.kind === "no-photo" && (
          <button type="button" onClick={onChooseAnother} className={primary}>
            Add a photo
          </button>
        )}
      </div>

      {(failure.detail || failure.requestId) && (
        <p className="mt-8 text-center text-[12px] leading-normal text-ks-stone">
          {failure.detail ? `${failure.detail} ` : ""}
          {failure.requestId ? `If this keeps happening, quote reference ${failure.requestId}.` : ""}
        </p>
      )}
    </div>
  )
}
