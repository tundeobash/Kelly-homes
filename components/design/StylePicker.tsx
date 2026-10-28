"use client"

import { useRef, useState } from "react"
import { Check, ChevronRight, ImagePlus, Loader2, Plus, Sofa, X } from "lucide-react"
import MustIncludeSheet from "@/components/design/MustIncludeSheet"
import { findMustInclude } from "@/lib/design/mustInclude"
import { STUDIO_STYLES } from "@/lib/design/studioStyles"
import type { StudioStyle } from "@/lib/design/studioStyles"

interface StylePickerProps {
  photoUrl: string | null
  picked: string
  onPick: (id: string) => void
  note: string
  onNoteChange: (value: string) => void
  onDesign: () => void
  onPhotoFile: (file: File) => void
  uploading: boolean
  uploadError: string | null
  roomType: string
  /** Must-have piece ids (lib/design/mustInclude.ts). */
  mustInclude: string[]
  onMustIncludeChange: (ids: string[]) => void
}

const gulfStyles = STUDIO_STYLES.filter((style) => style.gulf)
const moreStyles = STUDIO_STYLES.filter((style) => !style.gulf)

function StyleCard({
  style,
  selected,
  onPick,
  className = "",
}: {
  style: StudioStyle
  selected: boolean
  onPick: (id: string) => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(style.id)}
      aria-pressed={selected}
      className={`group text-left outline-none ${className}`}
    >
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl border-[3px] transition-colors duration-150 group-focus-visible:ring-2 group-focus-visible:ring-ks-charcoal ${
          selected ? "border-ks-gold" : "border-transparent"
        }`}
      >
        <img
          src={style.cardImage}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
        {selected && (
          <span className="absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-ks-charcoal text-ks-gold">
            <Check className="h-[15px] w-[15px]" strokeWidth={2.6} aria-hidden="true" />
          </span>
        )}
      </div>
      <span className="mt-2 block text-[15px] font-semibold leading-snug text-ks-ink">{style.name}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-ks-stone">{style.tagline}</span>
    </button>
  )
}

export default function StylePicker({
  photoUrl,
  picked,
  onPick,
  note,
  onNoteChange,
  onDesign,
  onPhotoFile,
  uploading,
  uploadError,
  roomType,
  mustInclude,
  onMustIncludeChange,
}: StylePickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [noteOpen, setNoteOpen] = useState(note.trim().length > 0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const pickedStyle = STUDIO_STYLES.find((style) => style.id === picked) ?? null
  const canDesign = Boolean(photoUrl) && Boolean(pickedStyle) && !uploading

  return (
    <div className="flex flex-col">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPhotoFile(file)
          e.target.value = ""
        }}
      />

      {photoUrl ? (
        <section className="flex items-center gap-3.5 rounded-2xl border border-ks-line bg-white p-3">
          <img src={photoUrl} alt="Your room photo" className="h-20 w-[60px] flex-shrink-0 rounded-[10px] object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-snug text-ks-ink">Your room</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ks-stone">This is the photo we redesign</p>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex min-h-[44px] items-center gap-2 px-1 text-[14px] font-medium text-ks-charcoal underline underline-offset-4 disabled:opacity-60"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {uploading ? "Uploading" : "Change photo"}
          </button>
        </section>
      ) : (
        <section className="flex flex-col items-center rounded-2xl border border-dashed border-[#9CA3AF] bg-white px-6 py-10 text-center">
          <ImagePlus className="h-8 w-8 text-ks-charcoal" aria-hidden="true" />
          <p className="mt-3 text-[16px] font-semibold text-ks-ink">Add a photo of your room</p>
          <p className="mt-1 max-w-xs text-[14px] leading-normal text-ks-stone">
            Stand in a corner and take the photo straight on, with the lights on.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-5 flex h-12 items-center gap-2 rounded-xl bg-ks-charcoal px-5 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {uploading ? "Uploading" : "Choose a photo"}
          </button>
        </section>
      )}
      {uploadError && (
        <p role="alert" className="mt-2 text-[13px] text-[#B42318]">
          {uploadError}
        </p>
      )}

      <h1 className="mb-1.5 mt-7 font-serif text-[28px] font-semibold leading-tight text-ks-ink">Choose a style</h1>
      <p className="text-[15px] leading-normal text-ks-stone">Pick one. Your walls, windows and doors stay as they are.</p>

      <h2 className="mb-2.5 mt-6 font-sans text-[13px] font-semibold leading-normal text-ks-stone">Made for Gulf homes</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {gulfStyles.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            selected={style.id === picked}
            onPick={onPick}
            className="w-[152px] flex-shrink-0 sm:w-auto"
          />
        ))}
      </div>

      <h2 className="mb-2.5 mt-6 font-sans text-[13px] font-semibold leading-normal text-ks-stone">More styles</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        {moreStyles.map((style) => (
          <StyleCard key={style.id} style={style} selected={style.id === picked} onPick={onPick} />
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-ks-line bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:mx-0 sm:mb-4 sm:rounded-2xl sm:border sm:shadow-[0_4px_20px_rgba(17,24,39,0.08)]">
        {noteOpen && (
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <label htmlFor="design-note" className="text-[13px] font-medium text-ks-ink">
                Anything to add? (optional)
              </label>
              <button
                type="button"
                onClick={() => {
                  onNoteChange("")
                  setNoteOpen(false)
                }}
                aria-label="Remove note"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ks-stone"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <textarea
              id="design-note"
              value={note}
              maxLength={500}
              rows={2}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="For example: more plants, or a dining table for six"
              className="mt-1 w-full resize-none rounded-xl border border-ks-line bg-ks-paper px-3 py-2 text-[15px] leading-normal text-ks-ink outline-none focus:border-ks-charcoal"
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[14px] text-ks-stone">
            Style: <span className="text-[14px] font-semibold text-ks-ink">{pickedStyle ? pickedStyle.name : "none yet"}</span>
          </p>
          {!noteOpen && (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="flex h-11 flex-shrink-0 items-center gap-1.5 px-1 text-[14px] font-medium text-ks-charcoal"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a note
            </button>
          )}
        </div>
        {mustInclude.length === 0 ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="mt-1 flex min-h-[60px] w-full items-center gap-3 rounded-xl border border-ks-line bg-ks-paper px-3 py-2.5 text-left outline-none transition-colors duration-150 hover:border-ks-charcoal focus-visible:ring-2 focus-visible:ring-ks-charcoal"
          >
            <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] bg-ks-sand text-ks-charcoal">
              <Sofa className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold leading-snug text-ks-ink">Must include</span>
              <span className="text-[13px] leading-snug text-ks-stone">Furniture this room has to have</span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] flex-shrink-0 text-ks-stone" aria-hidden="true" />
          </button>
        ) : (
          <div className="mt-1 rounded-xl border border-ks-line bg-ks-paper px-3 pb-3 pt-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] font-semibold text-ks-ink">Must include</span>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex min-h-[40px] items-center px-1 text-[14px] font-medium text-ks-charcoal underline underline-offset-4"
              >
                Edit
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {mustInclude.map((id) => {
                const label = findMustInclude(id)?.label ?? id
                return (
                  <span
                    key={id}
                    className="flex h-10 items-center gap-1 rounded-full border border-[#D1D5DB] bg-white pl-3.5 pr-1 text-[14px] font-medium text-ks-charcoal"
                  >
                    {label}
                    <button
                      type="button"
                      aria-label={`Remove ${label}`}
                      onClick={() => onMustIncludeChange(mustInclude.filter((x) => x !== id))}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ks-stone hover:bg-ks-paper"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onDesign}
          disabled={!canDesign}
          className="mt-2.5 flex h-[52px] w-full items-center justify-center rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {photoUrl ? "Design my room" : "Add a photo first"}
        </button>
      </div>

      <MustIncludeSheet
        open={sheetOpen}
        picked={mustInclude}
        roomType={roomType}
        onChange={onMustIncludeChange}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
