"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronLeft } from "lucide-react"
import StylePicker from "@/components/design/StylePicker"
import GeneratingView from "@/components/design/GeneratingView"
import ResultView from "@/components/design/ResultView"
import CompareView from "@/components/design/CompareView"
import type { CompareItem } from "@/components/design/CompareView"
import FailureView from "@/components/design/FailureView"
import ImageLightbox from "@/components/design/ImageLightbox"
import {
  addDesign,
  beforePhotoFor,
  defaultComparePair,
  describeFailure,
  designFromReply,
  designNumber,
  pickForCompare,
} from "@/lib/design/studioFlow"
import type { StageRoomReply, StudioDesign, StudioFailure } from "@/lib/design/studioFlow"
import { STUDIO_STYLES, findStudioStyle, styleDisplayName } from "@/lib/design/studioStyles"
import { picksFromResults } from "@/lib/design/mustInclude"
import { track } from "@/lib/tracking"

export interface DesignStudioProject {
  id: string
  name: string
  roomType: string
  imageUrl: string | null
  /** Must-have pieces picked for the latest design (lib/design/mustInclude.ts). */
  mustInclude?: string[]
  /** Newest first, as stored. */
  designs: StudioDesign[]
}

type View = "choose" | "generating" | "result" | "compare" | "failure"

function firstUnusedStyle(designs: StudioDesign[]): string {
  const used = new Set(designs.map((d) => findStudioStyle(d.style)?.id ?? d.style))
  return (STUDIO_STYLES.find((style) => !used.has(style.id)) ?? STUDIO_STYLES[0]).id
}

/**
 * The design screen for one room: choose a style, wait, see the result with a
 * before/after slider, try another style, and compare. Designs save automatically
 * (the server stores each one on the room before it replies).
 */
export default function DesignStudio({ project }: { project: DesignStudioProject }) {
  const router = useRouter()
  const [designs, setDesigns] = useState<StudioDesign[]>(project.designs)
  const [currentId, setCurrentId] = useState<string | null>(project.designs[0]?.id ?? null)
  const [view, setView] = useState<View>(project.designs.length > 0 ? "result" : "choose")
  const [photoUrl, setPhotoUrl] = useState<string | null>(project.imageUrl)
  const [picked, setPicked] = useState<string>(() => firstUnusedStyle(project.designs))
  const [note, setNote] = useState("")
  const [mustInclude, setMustInclude] = useState<string[]>(project.mustInclude ?? [])
  const [startedAt, setStartedAt] = useState(0)
  const [generatingStyle, setGeneratingStyle] = useState<string>(picked)
  const [failure, setFailure] = useState<StudioFailure | null>(null)
  const [pair, setPair] = useState<[string, string]>(() =>
    defaultComparePair(project.designs, project.designs[0]?.id ?? null)
  )
  const [lightbox, setLightbox] = useState<CompareItem | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const busy = useRef(false)
  const closeLightbox = useCallback(() => setLightbox(null), [])

  const current = designs.find((d) => d.id === currentId) ?? designs[0] ?? null
  const shown: View = (view === "result" || view === "compare") && !current ? "choose" : view
  const roomLabel = project.roomType?.trim().toLowerCase() || "room"

  const go = useCallback((next: View) => {
    setView(next)
    window.scrollTo({ top: 0 })
  }, [])

  // Leaving mid-design would lose sight of it, so ask first.
  useEffect(() => {
    if (shown !== "generating") return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [shown])

  /** mustOverride: the pieces to ask for instead of the current picks (Try again on a design). */
  const generate = async (styleId: string, mustOverride?: string[]) => {
    if (busy.current) return
    if (!photoUrl) {
      go("choose")
      return
    }
    busy.current = true
    setGeneratingStyle(styleId)
    setPicked(styleId)
    setStartedAt(Date.now())
    setFailure(null)
    go("generating")

    let reply: StageRoomReply | null = null
    try {
      const res = await fetch("/api/ai/stage-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No image address: the server uses this room's stored photo.
        body: JSON.stringify({
          projectId: project.id,
          style: styleId,
          roomType: project.roomType || undefined,
          prompt: note.trim() || undefined,
          mustInclude: mustOverride ?? mustInclude,
        }),
      })
      reply = (await res.json().catch(() => null)) as StageRoomReply | null
    } catch {
      reply = null
    }
    busy.current = false

    const design = designFromReply(reply, { style: styleId, sourceImageUrl: photoUrl, now: new Date() })
    if (design) {
      const next = addDesign(designs, design)
      setDesigns(next)
      setCurrentId(design.id)
      setPicked(firstUnusedStyle(next))
      go("result")
    } else {
      setFailure(describeFailure(reply, styleDisplayName(styleId)))
      go("failure")
    }
  }

  const uploadPhoto = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("This photo is over 10 MB. Please choose a smaller one.")
      const form = new FormData()
      form.append("file", file)
      form.append("projectId", project.id)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form })
      const uploadData = await uploadRes.json().catch(() => ({}))
      if (!uploadRes.ok) throw new Error(uploadData.error || "The photo could not be uploaded. Please try again.")
      const url: string | undefined = uploadData.url || uploadData.imageUrl
      if (!url) throw new Error("The photo could not be uploaded. Please try again.")
      const saveRes = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      })
      if (!saveRes.ok) {
        const saveData = await saveRes.json().catch(() => ({}))
        throw new Error(saveData.error || "The photo could not be saved to this room. Please try again.")
      }
      setPhotoUrl(url)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The photo could not be uploaded. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const openCompare = () => {
    track("compare_opened", project.id)
    setPair(defaultComparePair(designs, current?.id ?? null))
    go("compare")
  }

  const back = () => {
    if (shown === "compare") go("result")
    else if (shown === "choose" && designs.length > 0) go("result")
    else if (shown === "failure") go(designs.length > 0 ? "result" : "choose")
    else router.push("/profile/me")
  }

  const backLabel =
    shown === "compare" || ((shown === "choose" || shown === "failure") && designs.length > 0)
      ? "Back to your design"
      : "Back to your rooms"

  return (
    <div className="mx-auto max-w-6xl font-sans text-ks-ink">
      <header className="-mx-4 -mt-4 mb-5 flex h-14 items-center gap-2 border-b border-ks-line bg-white px-3 sm:mx-0 sm:mt-0 sm:rounded-2xl sm:border">
        {shown !== "generating" ? (
          <button
            type="button"
            onClick={back}
            aria-label={backLabel}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ks-charcoal outline-none hover:bg-ks-paper focus-visible:ring-2 focus-visible:ring-ks-charcoal"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ks-ink">
          {shown === "compare" ? "Compare designs" : project.name}
        </p>
        {shown === "result" && (
          <span className="mr-1 flex items-center gap-1.5 rounded-full bg-ks-sand px-2.5 py-1.5 text-[13px] font-medium leading-none text-ks-charcoal">
            <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
            Saved
          </span>
        )}
      </header>

      {shown === "choose" && (
        <StylePicker
          photoUrl={photoUrl}
          picked={picked}
          onPick={setPicked}
          note={note}
          onNoteChange={setNote}
          onDesign={() => generate(picked)}
          onPhotoFile={uploadPhoto}
          uploading={uploading}
          uploadError={uploadError}
          roomType={project.roomType}
          mustInclude={mustInclude}
          onMustIncludeChange={setMustInclude}
        />
      )}

      {shown === "generating" && (
        <GeneratingView
          photoUrl={photoUrl}
          styleName={styleDisplayName(generatingStyle)}
          roomLabel={roomLabel}
          roomName={project.name}
          startedAt={startedAt}
        />
      )}

      {shown === "result" && current && (
        <ResultView
          design={current}
          beforeSrc={beforePhotoFor(current, photoUrl)}
          styleName={styleDisplayName(current.style)}
          number={designNumber(designs, current.id)}
          total={designs.length}
          usedStyles={designs.map((d) => d.style)}
          onTryAnother={() => {
            track("try_another_style", project.id)
            setPicked(firstUnusedStyle(designs))
            go("choose")
          }}
          onCompare={openCompare}
          onTryStyle={(styleId) => {
            track("try_another_style", project.id)
            generate(styleId)
          }}
          onSliderMoved={() => track("slider_used", project.id)}
          onRetryMissing={() => generate(current.style, picksFromResults(current.mustInclude, project.roomType))}
        />
      )}

      {shown === "compare" && (
        <CompareView
          designs={designs}
          roomPhoto={photoUrl}
          roomName={project.name}
          pair={pair}
          onPick={(id) => setPair((p) => pickForCompare(p, id))}
          onSwap={() => setPair((p) => [p[1], p[0]])}
          onOpen={(item) => {
            track("fullscreen_opened", project.id)
            setLightbox(item)
          }}
          onNewStyle={() => {
            track("try_another_style", project.id)
            setPicked(firstUnusedStyle(designs))
            go("choose")
          }}
        />
      )}

      {shown === "failure" && failure && (
        <FailureView
          failure={failure}
          photoUrl={photoUrl}
          hasDesigns={designs.length > 0}
          onRetry={() => generate(generatingStyle)}
          onChooseAnother={() => go("choose")}
          onSeeDesigns={() => go("result")}
        />
      )}

      {lightbox && <ImageLightbox src={lightbox.imageUrl} title={lightbox.name} onClose={closeLightbox} />}
    </div>
  )
}
