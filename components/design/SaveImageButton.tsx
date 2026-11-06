"use client"

import { useEffect, useState } from "react"
import { Check, Download, Loader2 } from "lucide-react"
import { fetchDesignImage, saveDesignImage } from "@/lib/design/saveImage"

interface SaveImageButtonProps {
  imageUrl: string
  roomName: string
  styleName: string
  onSaved?: () => void
}

type Prepared = { url: string; status: "loading" } | { url: string; status: "ready"; blob: Blob } | { url: string; status: "failed" }

/**
 * "Save image" on the result: share sheet on phones, download on computers.
 * The picture is fetched as soon as the result shows, so the tap opens the share sheet
 * straight away (phones refuse it after a wait). If it cannot be fetched, the tap opens
 * the picture on its own page instead, where it can be saved by hand.
 */
export default function SaveImageButton({ imageUrl, roomName, styleName, onSaved }: SaveImageButtonProps) {
  const [prepared, setPrepared] = useState<Prepared>({ url: imageUrl, status: "loading" })
  const [state, setState] = useState<"idle" | "saving" | "done">("idle")

  useEffect(() => {
    let active = true
    setPrepared({ url: imageUrl, status: "loading" })
    setState("idle")
    void fetchDesignImage(imageUrl).then((blob) => {
      if (!active) return
      setPrepared(blob ? { url: imageUrl, status: "ready", blob } : { url: imageUrl, status: "failed" })
    })
    return () => {
      active = false
    }
  }, [imageUrl])

  useEffect(() => {
    if (state !== "done") return
    const timer = window.setTimeout(() => setState("idle"), 2_500)
    return () => window.clearTimeout(timer)
  }, [state])

  const current = prepared.url === imageUrl ? prepared : ({ url: imageUrl, status: "loading" } as Prepared)
  const preparing = current.status === "loading"

  const save = async () => {
    if (state === "saving" || current.status === "loading") return
    if (current.status === "failed") {
      // Straight from the tap, so the browser allows the new tab.
      window.open(imageUrl, "_blank", "noopener")
      return
    }
    setState("saving")
    const outcome = await saveDesignImage({ url: imageUrl, blob: current.blob, roomName, styleName })
    if (outcome === "shared" || outcome === "downloaded") {
      onSaved?.()
      setState("done")
    } else {
      setState("idle")
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={preparing}
      aria-label={`Save the ${styleName} design image`}
      className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border border-ks-line bg-white px-3 text-[13px] font-semibold text-ks-charcoal outline-none transition-colors duration-150 hover:bg-ks-paper focus-visible:ring-2 focus-visible:ring-ks-charcoal disabled:cursor-default disabled:opacity-60 disabled:hover:bg-white"
    >
      {state === "saving" || preparing ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : state === "done" ? (
        <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
      ) : (
        <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      )}
      {state === "done" ? "Saved" : "Save image"}
    </button>
  )
}
