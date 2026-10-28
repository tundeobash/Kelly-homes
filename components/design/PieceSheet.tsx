"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, ChevronLeft, Loader2, X } from "lucide-react"
import { cleanBox, cleanPiece, pieceLabel } from "@/lib/design/pieces"
import type { PieceBox, StudioPiece } from "@/lib/design/pieces"
import { track } from "@/lib/tracking"

type Stage = "choose" | "tap" | "confirm"

interface PieceSheetProps {
  open: boolean
  projectId: string
  /** The room's pieces, newest first. */
  pieces: StudioPiece[]
  title: string
  /** Words on the final button, e.g. "Use this piece" or "Add it to my design". */
  useLabel: string
  onClose: () => void
  /** The piece to use now. */
  onUse: (piece: StudioPiece) => void
  /** A new piece was saved to the room. */
  onSaved: (piece: StudioPiece) => void
}

/** Phone photos can be large: send at most 1600 px, upright, as JPEG. Falls back to the original file. */
async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88))
    return blob || file
  } catch {
    return file
  }
}

/**
 * "A piece you love": pick one of the room's pieces, or add a photo, tap the piece,
 * check its name and (optionally) its width. Used for "design around a piece" and
 * for "add a piece to this design".
 */
export default function PieceSheet({ open, projectId, pieces, title, useLabel, onClose, onUse, onSaved }: PieceSheetProps) {
  const [stage, setStage] = useState<Stage>("choose")
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null)
  const [box, setBox] = useState<PieceBox | null>(null)
  const [name, setName] = useState("")
  const [kind, setKind] = useState("")
  const [description, setDescription] = useState("")
  const [width, setWidth] = useState("")
  const [busy, setBusy] = useState<"photo" | "find" | "save" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const reset = () => {
    setStage("choose")
    setPhoto((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return null
    })
    setTap(null)
    setBox(null)
    setName("")
    setKind("")
    setDescription("")
    setWidth("")
    setBusy(null)
    setError(null)
  }

  useEffect(() => {
    if (!open) return
    headingRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const close = () => {
    if (busy === "save") return
    onClose()
  }

  const choosePhoto = async (file: File) => {
    setError(null)
    if (!file.type.startsWith("image/") && file.type !== "") {
      setError("Please choose a photo.")
      return
    }
    setBusy("photo")
    const blob = await shrinkPhoto(file)
    setBusy(null)
    if (blob.size > 10 * 1024 * 1024) {
      setError("This photo is over 10 MB. Please choose a smaller one.")
      return
    }
    setPhoto((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return { blob, url: URL.createObjectURL(blob) }
    })
    setTap(null)
    setBox(null)
    setStage("tap")
  }

  const find = async (point: { x: number; y: number }) => {
    if (!photo || busy) return
    setTap(point)
    setBox(null)
    setError(null)
    setBusy("find")
    try {
      const form = new FormData()
      form.append("file", photo.blob, "piece.jpg")
      form.append("x", String(point.x))
      form.append("y", String(point.y))
      const res = await fetch("/api/pieces/identify", { method: "POST", body: form })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.errorMessage || "We couldn't read that photo. Please try another one.")
      const found = data.piece || {}
      setBox(cleanBox(found.box))
      setName(typeof found.name === "string" ? found.name : "")
      setKind(typeof found.kind === "string" ? found.kind : "")
      setDescription(typeof found.description === "string" ? found.description : "")
      setStage("confirm")
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't read that photo. Please try another one.")
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!photo || !tap || busy || !name.trim()) return
    setBusy("save")
    setError(null)
    try {
      const form = new FormData()
      form.append("file", photo.blob, "piece.jpg")
      form.append("projectId", projectId)
      form.append("x", String(tap.x))
      form.append("y", String(tap.y))
      if (box) form.append("box", JSON.stringify(box))
      form.append("name", name.trim())
      form.append("kind", kind)
      form.append("description", description)
      if (width.trim()) form.append("widthCm", width.trim())
      const res = await fetch("/api/pieces", { method: "POST", body: form })
      const data = await res.json().catch(() => null)
      const piece = cleanPiece(data?.piece)
      if (!res.ok || !data?.success || !piece) throw new Error(data?.errorMessage || "We couldn't save this piece. Please try again.")
      track("piece_added", projectId)
      onSaved(piece)
      onUse(piece)
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save this piece. Please try again.")
      setBusy(null)
    }
  }

  const tapOn = (e: React.MouseEvent<HTMLButtonElement>) => {
    const img = e.currentTarget.querySelector("img")
    if (!img) return
    // A keyboard press has no position: use the middle of the photo.
    if (e.detail === 0) {
      void find({ x: 0.5, y: 0.5 })
      return
    }
    const rect = img.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    void find({ x, y })
  }

  const heading =
    stage === "choose" ? title : stage === "tap" ? "Tap the piece you mean" : name ? "Is this the piece?" : "What is this piece?"

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      onKeyDown={(e) => {
        if (e.key === "Escape") close()
      }}
    >
      <button type="button" aria-label="Close" tabIndex={-1} onClick={close} className="absolute inset-0 cursor-default bg-[rgba(17,24,39,0.5)]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="piece-sheet-title"
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-[20px] bg-white font-sans text-ks-ink sm:max-w-[520px] sm:rounded-[20px]"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void choosePhoto(file)
            e.target.value = ""
          }}
        />
        <div className="overflow-y-auto px-5 pb-2 pt-2.5">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#D1D5DB] sm:hidden" />
          <div className="flex items-center gap-2 sm:pt-2">
            {stage !== "choose" && (
              <button
                type="button"
                onClick={() => (stage === "confirm" ? setStage("tap") : reset())}
                aria-label="Back"
                disabled={busy === "save"}
                className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl text-ks-charcoal outline-none hover:bg-ks-paper focus-visible:ring-2 focus-visible:ring-ks-charcoal"
              >
                <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
              </button>
            )}
            <h2
              id="piece-sheet-title"
              ref={headingRef}
              tabIndex={-1}
              className="min-w-0 flex-1 font-serif text-[24px] font-semibold leading-tight text-ks-ink outline-none"
            >
              {heading}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-ks-charcoal outline-none hover:bg-ks-paper focus-visible:ring-2 focus-visible:ring-ks-charcoal"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {stage === "choose" && (
            <>
              <p className="mt-1 text-[15px] leading-normal text-ks-stone">
                A photo of a piece you like, in a shop, at a friend&apos;s home, or a screenshot. We put that piece into your design.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy === "photo"}
                className="mt-4 flex w-full items-center gap-3.5 rounded-2xl border border-dashed border-[#9CA3AF] bg-ks-paper p-4 text-left outline-none transition-colors duration-150 hover:border-ks-charcoal focus-visible:ring-2 focus-visible:ring-ks-charcoal disabled:opacity-60"
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-ks-sand text-ks-charcoal">
                  {busy === "photo" ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Camera className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-semibold leading-snug text-ks-ink">Add a photo of a piece</span>
                  <span className="text-[13px] leading-snug text-ks-stone">One piece per design</span>
                </span>
              </button>

              {pieces.length > 0 && (
                <>
                  <h3 className="mb-2.5 mt-5 text-[13px] font-semibold leading-normal text-ks-stone">Your pieces</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {pieces.map((piece) => (
                      <button
                        key={piece.id}
                        type="button"
                        onClick={() => onUse(piece)}
                        className="group text-left outline-none"
                      >
                        <img
                          src={piece.imageUrl}
                          alt=""
                          className="aspect-square w-full rounded-xl border border-ks-line object-cover transition-opacity duration-150 group-hover:opacity-90 group-focus-visible:ring-2 group-focus-visible:ring-ks-charcoal"
                        />
                        <span className="mt-1.5 block truncate text-[13px] font-medium leading-snug text-ks-ink">{pieceLabel(piece)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {stage !== "choose" && photo && (
            <>
              <p className="mt-1 text-[14px] leading-normal text-ks-stone">
                {stage === "tap" ? "We'll find it and name it." : "Not right? Tap the piece again."}
              </p>
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={tapOn}
                  disabled={busy === "find" || busy === "save"}
                  aria-label="Tap the piece in your photo"
                  className="relative inline-block cursor-crosshair overflow-hidden rounded-2xl bg-ks-paper outline-none focus-visible:ring-2 focus-visible:ring-ks-charcoal"
                >
                  <img src={photo.url} alt="Your photo" className="block max-h-[46vh] w-auto max-w-full" />
                  {box && (
                    <span
                      className="pointer-events-none absolute rounded-lg border-[3px] border-ks-gold shadow-[0_0_0_2px_#fff,0_0_0_9999px_rgba(17,24,39,0.35)]"
                      style={{
                        left: `${box.left * 100}%`,
                        top: `${box.top * 100}%`,
                        width: `${(box.right - box.left) * 100}%`,
                        height: `${(box.bottom - box.top) * 100}%`,
                      }}
                    />
                  )}
                  {!box && tap && (
                    <span
                      className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ks-gold shadow-[0_0_0_2px_#fff]"
                      style={{ left: `${tap.x * 100}%`, top: `${tap.y * 100}%` }}
                    />
                  )}
                  {busy === "find" && (
                    <span className="absolute inset-0 flex items-center justify-center bg-[rgba(17,24,39,0.35)]">
                      <span className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[14px] font-medium text-ks-charcoal">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Finding the piece
                      </span>
                    </span>
                  )}
                </button>
              </div>
            </>
          )}

          {stage === "confirm" && (
            <div className="mt-4 flex flex-col">
              <label htmlFor="piece-name" className="text-[14px] font-semibold text-ks-ink">
                What is it?
              </label>
              <input
                id="piece-name"
                type="text"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="For example: round fabric pouf"
                className="mt-1.5 h-12 rounded-xl border border-[#D1D5DB] bg-white px-3.5 text-[16px] text-ks-ink outline-none focus:border-ks-charcoal"
              />
              <label htmlFor="piece-width" className="mt-3.5 text-[14px] font-semibold text-ks-ink">
                About how wide? <span className="text-[14px] font-normal text-ks-stone">(optional)</span>
              </label>
              <div className="mt-1.5 flex items-center gap-2.5">
                <input
                  id="piece-width"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={600}
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="For example 55"
                  className="h-12 w-[170px] rounded-xl border border-[#D1D5DB] bg-white px-3.5 text-[16px] text-ks-ink outline-none focus:border-ks-charcoal"
                />
                <span className="text-[15px] text-ks-stone">cm</span>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[14px] leading-snug text-[#B42318]">
              {error}
            </p>
          )}
        </div>

        {stage === "confirm" && (
          <div className="flex flex-col gap-2 border-t border-ks-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
            <p className="text-[13px] leading-snug text-ks-stone">Only this piece is kept, not the rest of your photo.</p>
            <button
              type="button"
              onClick={save}
              disabled={!name.trim() || busy !== null}
              className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy === "save" ? "Saving your piece" : useLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
