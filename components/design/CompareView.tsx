"use client"

import { ArrowLeftRight, Plus } from "lucide-react"
import { ORIGINAL_PHOTO_ID, beforePhotoFor } from "@/lib/design/studioFlow"
import type { StudioDesign } from "@/lib/design/studioFlow"
import { styleDisplayName } from "@/lib/design/studioStyles"

export interface CompareItem {
  id: string
  name: string
  imageUrl: string
}

interface CompareViewProps {
  designs: StudioDesign[]
  roomPhoto: string | null
  roomName: string
  pair: [string, string]
  onPick: (id: string) => void
  onSwap: () => void
  onOpen: (item: CompareItem) => void
  onNewStyle: () => void
}

export function compareItems(designs: StudioDesign[], roomPhoto: string | null): CompareItem[] {
  const items: CompareItem[] = []
  const photo = beforePhotoFor(designs[0], roomPhoto)
  if (photo) items.push({ id: ORIGINAL_PHOTO_ID, name: "Your photo", imageUrl: photo })
  for (const design of designs) {
    items.push({ id: design.id, name: styleDisplayName(design.style), imageUrl: design.imageUrl })
  }
  return items
}

export default function CompareView({
  designs,
  roomPhoto,
  roomName,
  pair,
  onPick,
  onSwap,
  onOpen,
  onNewStyle,
}: CompareViewProps) {
  const items = compareItems(designs, roomPhoto)
  const left = items.find((item) => item.id === pair[0]) ?? items[0]
  const right = items.find((item) => item.id === pair[1]) ?? items[items.length - 1]

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-2 gap-3 lg:gap-6">
        {[left, right].map((item, index) =>
          item ? (
            <figure key={`${index}-${item.id}`} className="m-0">
              <button
                type="button"
                onClick={() => onOpen(item)}
                aria-label={`View ${item.name} full screen`}
                className="block w-full overflow-hidden rounded-xl bg-ks-sand outline-none focus-visible:ring-2 focus-visible:ring-ks-charcoal"
              >
                <img src={item.imageUrl} alt={item.name} className="block h-auto max-h-[70vh] w-full object-contain" />
              </button>
              <figcaption className="mt-2 text-[15px] font-semibold leading-snug text-ks-ink">{item.name}</figcaption>
            </figure>
          ) : null
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSwap}
          className="flex h-11 items-center gap-2 rounded-xl border border-ks-line bg-white px-3.5 text-[14px] font-medium text-ks-charcoal"
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          Swap sides
        </button>
        <p className="text-[13px] text-ks-stone">Tap a picture to see it full screen.</p>
      </div>

      <h2 className="mb-2.5 mt-6 font-sans text-[13px] font-semibold leading-normal text-ks-stone">All designs for this room</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const side = item.id === pair[0] ? "Left" : item.id === pair[1] ? "Right" : ""
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item.id)}
              aria-pressed={side !== ""}
              className="w-[84px] flex-shrink-0 text-left outline-none"
            >
              <span
                className={`relative block h-[112px] w-[84px] overflow-hidden rounded-[10px] border-[3px] ${
                  side ? "border-ks-gold" : "border-transparent"
                }`}
              >
                <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                {side && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ks-charcoal px-[7px] py-0.5 text-[11px] font-semibold leading-normal text-ks-gold">
                    {side}
                  </span>
                )}
              </span>
              <span className="mt-1.5 block truncate text-[12px] font-medium leading-snug text-ks-ink">{item.name}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onNewStyle}
          className="flex h-[112px] w-[84px] flex-shrink-0 flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#9CA3AF] text-ks-charcoal"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span className="text-[12px] font-medium leading-snug">New style</span>
        </button>
      </div>

      <p className="mt-8 text-center text-[13px] leading-normal text-ks-stone sm:text-left">
        Every design is saved to {roomName} automatically.
      </p>
    </div>
  )
}
