"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ImagePlus, MoreHorizontal, Trash2 } from "lucide-react"

interface RoomCardProps {
  id: string
  name: string
  meta: string
  cover: string | null
  coverAlt: string
}

export default function RoomCard({ id, name, meta, cover, coverAlt }: RoomCardProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Some old rooms point at photos that no longer exist; show a placeholder instead of a gap.
  const [coverFailed, setCoverFailed] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setMenuOpen(false)
        return
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", close)
    }
  }, [menuOpen])

  const deleteRoom = async () => {
    setMenuOpen(false)
    if (!window.confirm(`Delete "${name}" and all its designs? This cannot be undone.`)) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("delete failed")
      setDeleted(true)
      router.refresh()
    } catch {
      setError("This room could not be deleted. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  if (deleted) return null

  return (
    <article className={`relative overflow-hidden rounded-2xl border border-ks-line bg-white ${deleting ? "opacity-50" : ""}`}>
      <Link href={`/project/${id}`} className="group block outline-none focus-visible:ring-2 focus-visible:ring-ks-charcoal">
        {cover && !coverFailed ? (
          <img
            src={cover}
            alt={coverAlt}
            loading="lazy"
            onError={() => setCoverFailed(true)}
            className="block h-[210px] w-full object-cover transition-opacity duration-150 group-hover:opacity-95"
          />
        ) : (
          <span className="flex h-[210px] w-full items-center justify-center bg-ks-sand text-ks-stone">
            <ImagePlus className="h-8 w-8" aria-hidden="true" />
          </span>
        )}
        <span className="block px-4 pb-4 pr-14 pt-3.5">
          <span className="block truncate text-[17px] font-semibold leading-snug text-ks-ink">{name}</span>
          <span className="mt-[3px] block text-[14px] leading-snug text-ks-stone">{meta}</span>
        </span>
      </Link>

      <div ref={menuRef} className="absolute bottom-3 right-2">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={`Options for ${name}`}
          aria-expanded={menuOpen}
          disabled={deleting}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[#4B5563] outline-none hover:bg-ks-paper focus-visible:ring-2 focus-visible:ring-ks-charcoal"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
        {menuOpen && (
          <div className="absolute bottom-12 right-0 z-10 w-44 overflow-hidden rounded-xl border border-ks-line bg-white py-1 shadow-[0_8px_24px_rgba(17,24,39,0.12)]">
            <button
              type="button"
              onClick={deleteRoom}
              className="flex h-11 w-full items-center gap-2.5 px-3.5 text-left text-[15px] font-medium text-[#B42318] hover:bg-ks-paper"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete room
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="px-4 pb-3 text-[13px] text-[#B42318]">
          {error}
        </p>
      )}
    </article>
  )
}
