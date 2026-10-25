"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"

interface ImageLightboxProps {
  src: string
  title: string
  onClose: () => void
}

/** One picture, full screen, whole photo visible. Escape or the close button returns. */
export default function ImageLightbox({ src, title, onClose }: ImageLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-[rgba(10,12,16,0.94)]"
      onClick={onClose}
    >
      <div className="flex h-14 flex-shrink-0 items-center justify-between px-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-semibold text-white">{title}</p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-white outline-none focus-visible:ring-2 focus-visible:ring-ks-gold"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
        <img
          src={src}
          alt={title}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
