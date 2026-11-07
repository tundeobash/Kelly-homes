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
import PieceSheet from "@/components/design/PieceSheet"
import QuoteSheet from "@/components/design/QuoteSheet"
import ChangePieceView from "@/components/design/ChangePieceView"
import SwapSheet from "@/components/design/SwapSheet"
import EstimateSheet from "@/components/design/EstimateSheet"
import ImageLightbox from "@/components/design/ImageLightbox"
import {
  addDesign,
  comparisonFor,
  defaultComparePair,
  describeFailure,
  designFromReply,
  designNumber,
  pickForCompare,
} from "@/lib/design/studioFlow"
import type { StageRoomReply, StudioDesign, StudioFailure } from "@/lib/design/studioFlow"
import { STUDIO_STYLES, findStudioStyle, styleDisplayName } from "@/lib/design/studioStyles"
import { picksFromResults } from "@/lib/design/mustInclude"
import { addPiece } from "@/lib/design/pieces"
import type { PieceMode, StudioPiece } from "@/lib/design/pieces"
import { budgetQuoteLine } from "@/lib/design/budget"
import { estimateFor, estimateTier } from "@/lib/design/estimate"
import type { BudgetTier } from "@/lib/design/budget"
import { readDetected, shortName } from "@/lib/design/pieceEdit"
import type { DetectedPiece, EditAction } from "@/lib/design/pieceEdit"
import { track } from "@/lib/tracking"
import {
  PENDING_FIRST_POLL_MS,
  PENDING_POLL_MS,
  QUICK_FAILURE_MS,
  isExpired,
  makePending,
  newDesignFor,
  pendingKey,
  readPending,
  studioDesignsFrom,
} from "@/lib/design/pendingDesign"
import type { PendingDesign } from "@/lib/design/pendingDesign"

export interface DesignStudioProject {
  id: string
  name: string
  roomType: string
  imageUrl: string | null
  /** Must-have pieces picked for the latest design (lib/design/mustInclude.ts). */
  mustInclude?: string[]
  /** The room's pieces the person loves, newest first (lib/design/pieces.ts). */
  pieces?: StudioPiece[]
  /** The room's budget band (lib/design/budget.ts). */
  budget?: BudgetTier | null
  /** Newest first, as stored. */
  designs: StudioDesign[]
  /** How many of the person's other rooms have designs, for "Get a quote for my home". */
  otherRoomsWithDesigns?: number
}

type View = "choose" | "generating" | "result" | "compare" | "failure" | "change"

/** A change to one piece, as sent to /api/ai/stage-room. */
interface EditPayload {
  action: EditAction
  baseDesignId: string
  target: DetectedPiece
  to?: { x: number; y: number } | null
  changes?: string[]
  text?: string
}

type GenerateOpts = {
  must?: string[]
  piece?: StudioPiece | null
  mode?: PieceMode
  baseDesignId?: string | null
  edit?: EditPayload
}

function editTitle(edit: EditPayload): string {
  const name = shortName(edit.target)
  if (edit.action === "remove") return `Removing the ${name}`
  if (edit.action === "move") return `Moving the ${name}`
  return `Swapping the ${name}`
}

/** A request kept in the waiting marker (localStorage), read back after coming to the room again. */
function readRequest(value: unknown): { style: string; opts: GenerateOpts } | null {
  if (!value || typeof value !== "object") return null
  const v = value as { style?: unknown; opts?: unknown }
  if (typeof v.style !== "string" || !v.style || !v.opts || typeof v.opts !== "object") return null
  return { style: v.style, opts: v.opts as GenerateOpts }
}

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
  // A piece for the next design ("around" mode), the room's pieces, and which piece sheet is open.
  const [piece, setPiece] = useState<StudioPiece | null>(null)
  const [pieces, setPieces] = useState<StudioPiece[]>(project.pieces ?? [])
  const [pieceSheet, setPieceSheet] = useState<PieceMode | "swap" | null>(null)
  const [budget, setBudget] = useState<BudgetTier | null>(project.budget ?? null)
  // "Change a piece": the pieces found per design, the piece being swapped, and what to swap in.
  const [detected, setDetected] = useState<Record<string, DetectedPiece[]>>(() => {
    const found: Record<string, DetectedPiece[]> = {}
    for (const d of project.designs) if (d.detected && d.detected.length > 0) found[d.id] = d.detected
    return found
  })
  // Per design: why the pieces could not be found; pieces left out of the estimate.
  const [detectErrors, setDetectErrors] = useState<Record<string, string>>({})
  const [excluded, setExcluded] = useState<Record<string, string[]>>({})
  const [estimateOpen, setEstimateOpen] = useState(false)
  const detecting = useRef<Set<string>>(new Set())
  const [swapTarget, setSwapTarget] = useState<DetectedPiece | null>(null)
  const [swapPiece, setSwapPiece] = useState<StudioPiece | null>(null)
  const [generatingTitle, setGeneratingTitle] = useState<string | null>(null)
  const [generatingPhoto, setGeneratingPhoto] = useState<string | null>(null)
  // The change that made each new design, so "Try again" can repeat it.
  const editRequests = useRef<Record<string, { style: string; opts: GenerateOpts }>>({})
  // "Get a quote" sheet: null when closed; preselect ticks items ("piece:<id>", "found:<id>").
  const [quote, setQuote] = useState<{ preselect: string | string[] | null } | null>(null)
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
  // The design being made, also kept in the browser so leaving the page and coming back picks it up.
  const pendingRef = useRef<PendingDesign | null>(null)
  // False once this page has been left (in-app navigation keeps the request running).
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  // The last design asked for, so "Try again" after a failure repeats it exactly.
  const lastRequest = useRef<{ style: string; opts: GenerateOpts } | null>(null)
  const closeLightbox = useCallback(() => setLightbox(null), [])

  const current = designs.find((d) => d.id === currentId) ?? designs[0] ?? null
  const shown: View = (view === "result" || view === "compare" || view === "change") && !current ? "choose" : view
  const roomLabel = project.roomType?.trim().toLowerCase() || "room"

  const go = useCallback((next: View) => {
    setView(next)
    window.scrollTo({ top: 0 })
  }, [])

  const savePending = useCallback(
    (pending: PendingDesign | null) => {
      try {
        if (pending) window.localStorage.setItem(pendingKey(project.id), JSON.stringify(pending))
        else window.localStorage.removeItem(pendingKey(project.id))
      } catch {
        // Private browsing can refuse storage: then leaving the page just won't pick the design up.
      }
    },
    [project.id]
  )

  const finishPending = useCallback(() => {
    pendingRef.current = null
    busy.current = false
    savePending(null)
  }, [savePending])

  /** The stored marker, if it is still the one for this design (a newer design replaces it). */
  const storedPending = useCallback(
    (pending: PendingDesign): PendingDesign | null => {
      let raw: string | null = null
      try {
        raw = window.localStorage.getItem(pendingKey(project.id))
      } catch {
        return null
      }
      const stored = readPending(raw, project.id, Date.now())
      return stored && stored.startedAt === pending.startedAt ? stored : null
    },
    [project.id]
  )

  // Came back while a design was still being made: wait for it here (tester feedback, 6 Nov).
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(pendingKey(project.id))
    } catch {
      return
    }
    if (!raw) return
    const pending = readPending(raw, project.id, Date.now())
    // Too old or unreadable, or it finished while away (it is already the design on show).
    if (!pending || newDesignFor(pending, project.designs)) {
      savePending(null)
      return
    }
    // "Try again" repeats what was asked for, even after leaving the page.
    const asked = readRequest(pending.request)
    if (asked) lastRequest.current = asked
    if (pending.failure) {
      // It failed after the page was left: show why.
      savePending(null)
      setGeneratingStyle(pending.style)
      setFailure(pending.failure)
      go("failure")
      return
    }
    pendingRef.current = pending
    busy.current = true
    setGeneratingStyle(pending.style)
    setGeneratingTitle(pending.title)
    setGeneratingPhoto(null)
    setStartedAt(pending.startedAt)
    go("generating")
    // Runs once, when the room opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While waiting, look for the finished design on the room. This also catches a reply the
  // phone dropped (locked screen, another app) and a page reopened mid-design.
  useEffect(() => {
    if (shown !== "generating") return
    let stopped = false
    const check = async () => {
      const pending = pendingRef.current
      if (!pending || stopped) return
      // A page left earlier may have heard back with a failure and noted it in the marker.
      const stored = storedPending(pending)
      if (stored?.failure) {
        finishPending()
        setFailure(stored.failure)
        go("failure")
        return
      }
      if (Date.now() - pending.startedAt < PENDING_FIRST_POLL_MS) return
      let list: StudioDesign[] | null = null
      try {
        const res = await fetch(`/api/projects/${project.id}`, { cache: "no-store" })
        if (res.ok) {
          const data = await res.json().catch(() => null)
          list = studioDesignsFrom(data?.aiDesigns)
        }
      } catch {
        list = null
      }
      if (stopped || pendingRef.current !== pending) return
      const found = list ? newDesignFor(pending, list) : null
      if (found && list) {
        const asked = readRequest(pending.request)
        if (asked?.opts.edit) editRequests.current[found.id] = asked
        finishPending()
        setDesigns(list)
        setCurrentId(found.id)
        setPicked(firstUnusedStyle(list))
        go("result")
        return
      }
      if (isExpired(pending, Date.now())) {
        finishPending()
        setFailure({
          kind: "failed",
          title: "This design did not finish",
          message: `Your ${styleDisplayName(pending.style)} design did not finish, so nothing was saved. Please try again.`,
        })
        go("failure")
      }
    }
    const timer = window.setInterval(() => void check(), PENDING_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [shown, project.id, go, finishPending, storedPending])

  /**
   * opts.must: the must-haves to ask for instead of the current picks (Try again on a design).
   * opts.piece / mode / baseDesignId: a piece to use instead of the current one; "place" adds it
   * to the design baseDesignId.
   */
  const generate = async (styleId: string, opts: GenerateOpts = {}) => {
    const usePiece = opts.piece !== undefined ? opts.piece : piece
    const mode: PieceMode | undefined = usePiece && !opts.edit ? opts.mode ?? "around" : undefined
    const requestOpts: GenerateOpts = {
      must: opts.must ?? mustInclude,
      piece: usePiece ?? null,
      mode,
      baseDesignId: opts.baseDesignId ?? null,
      edit: opts.edit,
    }
    lastRequest.current = { style: styleId, opts: requestOpts }
    if (busy.current) return
    if (!photoUrl) {
      go("choose")
      return
    }
    busy.current = true
    const editBase = opts.edit ? designs.find((d) => d.id === opts.edit!.baseDesignId) ?? null : null
    setGeneratingTitle(opts.edit ? editTitle(opts.edit) : null)
    setGeneratingPhoto(editBase ? editBase.imageUrl : null)
    setGeneratingStyle(styleId)
    setPicked(styleId)
    setStartedAt(Date.now())
    setFailure(null)
    go("generating")
    const pending = makePending({
      projectId: project.id,
      style: styleId,
      title: opts.edit ? editTitle(opts.edit) : null,
      designs,
      now: Date.now(),
      request: { style: styleId, opts: requestOpts },
    })
    pendingRef.current = pending
    savePending(pending)

    let reply: StageRoomReply | null = null
    // True when the connection itself failed (not an error page or an error reply).
    let dropped = false
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
          mustInclude: opts.edit ? [] : opts.must ?? mustInclude,
          piece: usePiece || undefined,
          pieceMode: mode,
          baseDesignId: mode === "place" ? opts.baseDesignId || undefined : undefined,
          edit: opts.edit
            ? {
                action: opts.edit.action,
                baseDesignId: opts.edit.baseDesignId,
                target: { name: opts.edit.target.name, kind: opts.edit.target.kind, box: opts.edit.target.box },
                to: opts.edit.to ?? undefined,
                changes: opts.edit.changes ?? [],
                text: opts.edit.text ?? "",
              }
            : undefined,
        }),
      })
      reply = (await res.json().catch(() => null)) as StageRoomReply | null
    } catch {
      reply = null
      dropped = true
    }
    // The check below already showed the design, or the wait was given up.
    if (pendingRef.current !== pending) return
    if (!mounted.current) {
      // The page was left. Its next visit finds a finished design on the room; a failure is
      // noted in the marker so that visit can say why. A newer design's marker is left alone.
      if (reply && reply.success !== true && storedPending(pending)) {
        savePending({ ...pending, failure: describeFailure(reply, styleDisplayName(styleId)) })
      }
      return
    }
    // The connection dropped after the request went out (often a phone locking or switching
    // apps). The design is probably still coming: keep waiting and let the check find it.
    if (dropped && Date.now() - pending.startedAt > QUICK_FAILURE_MS) return
    finishPending()

    const design = designFromReply(reply, { style: styleId, sourceImageUrl: photoUrl, now: new Date() })
    if (design) {
      if (opts.edit) editRequests.current[design.id] = { style: styleId, opts: requestOpts }
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

  const saveBudget = (tier: BudgetTier) => {
    const before = budget
    setBudget(tier)
    track("budget_set", project.id)
    void fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget: tier }),
    })
      .then((res) => {
        if (!res.ok) setBudget(before)
      })
      .catch(() => setBudget(before))
  }

  const findPieces = async (designId: string) => {
    if (detecting.current.has(designId)) return
    detecting.current.add(designId)
    setDetectErrors((all) => {
      const next = { ...all }
      delete next[designId]
      return next
    })
    try {
      const res = await fetch("/api/ai/detect-pieces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, designId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.errorMessage || "Please try again.")
      setDetected((all) => ({ ...all, [designId]: readDetected(data.pieces) ?? [] }))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again."
      setDetectErrors((all) => ({ ...all, [designId]: message }))
    } finally {
      detecting.current.delete(designId)
    }
  }

  const refindPieces = (designId: string) => {
    setDetected((all) => {
      const next = { ...all }
      delete next[designId]
      return next
    })
    void findPieces(designId)
  }

  // The estimate: find the pieces of each design shown, once.
  useEffect(() => {
    if (shown !== "result" || !current) return
    if (detected[current.id] || detectErrors[current.id]) return
    void findPieces(current.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, current?.id])

  const tier = estimateTier(budget)
  const currentPieces = current ? detected[current.id] ?? null : null
  const estimate = currentPieces && current ? estimateFor(currentPieces, tier, excluded[current.id] ?? []) : null

  const openChange = () => {
    if (!current) return
    track("change_opened", project.id)
    go("change")
    if (!detected[current.id] || detected[current.id].length === 0) refindPieces(current.id)
  }

  const changePiece = (edit: Omit<EditPayload, "baseDesignId">, withPiece: StudioPiece | null = null) => {
    if (!current) return
    track(edit.action === "swap" ? "piece_swapped" : edit.action === "move" ? "piece_moved" : "piece_removed", project.id)
    setSwapTarget(null)
    setSwapPiece(null)
    generate(current.style, { piece: withPiece, must: [], edit: { ...edit, baseDesignId: current.id } })
  }

  const openCompare = () => {
    track("compare_opened", project.id)
    setPair(defaultComparePair(designs, current?.id ?? null))
    go("compare")
  }

  const back = () => {
    if (shown === "compare" || shown === "change") go("result")
    else if (shown === "choose" && designs.length > 0) go("result")
    else if (shown === "failure") go(designs.length > 0 ? "result" : "choose")
    else router.push("/profile/me")
  }

  const backLabel =
    shown === "compare" || shown === "change" || ((shown === "choose" || shown === "failure") && designs.length > 0)
      ? "Back to your design"
      : "Back to your rooms"

  return (
    <div className="mx-auto max-w-6xl font-sans text-ks-ink">
      <header className="-mx-4 -mt-4 mb-5 flex h-14 items-center gap-2 border-b border-ks-line bg-white px-3 sm:mx-0 sm:mt-0 sm:rounded-2xl sm:border">
        <button
          type="button"
          onClick={back}
          aria-label={backLabel}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ks-charcoal outline-none hover:bg-ks-paper focus-visible:ring-2 focus-visible:ring-ks-charcoal"
        >
          <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ks-ink">
          {shown === "compare" ? "Compare designs" : shown === "change" ? "Change a piece" : project.name}
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
          piece={piece}
          onAddPiece={() => setPieceSheet("around")}
          onRemovePiece={() => setPiece(null)}
          budget={budget}
          onBudgetChange={saveBudget}
        />
      )}

      {shown === "generating" && (
        <GeneratingView
          photoUrl={generatingPhoto || photoUrl}
          styleName={styleDisplayName(generatingStyle)}
          roomLabel={roomLabel}
          roomName={project.name}
          startedAt={startedAt}
          title={generatingTitle || undefined}
        />
      )}

      {shown === "result" && current && (
        <ResultView
          design={current}
          beforeSrc={comparisonFor(current, designs, photoUrl).src}
          beforeLabel={comparisonFor(current, designs, photoUrl).label}
          previousId={comparisonFor(current, designs, photoUrl).previousId}
          styleName={styleDisplayName(current.style)}
          roomName={project.name}
          roomType={project.roomType}
          onImageSaved={() => track("image_saved", project.id)}
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
          onRetryMissing={() =>
            generate(current.style, {
              must: picksFromResults(current.mustInclude, project.roomType),
              piece: current.piece ?? null,
              mode: current.pieceMode ?? undefined,
              baseDesignId: current.baseDesignId ?? null,
            })
          }
          onAddPiece={() => setPieceSheet("place")}
          onQuote={(preselect) => setQuote({ preselect: preselect ?? null })}
          budget={budget}
          estimate={estimate}
          estimateError={detectErrors[current.id] ?? null}
          tier={tier}
          onTierChange={saveBudget}
          onOpenEstimate={() => {
            track("estimate_opened", project.id)
            setEstimateOpen(true)
          }}
          onRetryEstimate={() => refindPieces(current.id)}
          onChangePiece={openChange}
          onShowDesign={(id) => {
            setCurrentId(id)
            window.scrollTo({ top: 0 })
          }}
          onRetryEdit={
            editRequests.current[current.id]
              ? () => {
                  const again = editRequests.current[current.id]
                  generate(again.style, again.opts)
                }
              : undefined
          }
        />
      )}

      {shown === "change" && current && (
        <ChangePieceView
          imageUrl={current.imageUrl}
          styleName={styleDisplayName(current.style)}
          pieces={detected[current.id] ?? null}
          error={detectErrors[current.id] ?? null}
          onRetry={() => refindPieces(current.id)}
          onSwap={(target) => {
            setSwapPiece(null)
            setSwapTarget(target)
          }}
          onMove={(target, to) => changePiece({ action: "move", target, to })}
          onRemove={(target) => changePiece({ action: "remove", target })}
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
          onRetry={() =>
            lastRequest.current
              ? generate(lastRequest.current.style, lastRequest.current.opts)
              : generate(generatingStyle)
          }
          onChooseAnother={() => go("choose")}
          onSeeDesigns={() => go("result")}
        />
      )}

      {lightbox && <ImageLightbox src={lightbox.imageUrl} title={lightbox.name} onClose={closeLightbox} />}

      <QuoteSheet
        open={quote !== null && shown === "result"}
        design={current}
        roomName={project.name}
        styleName={current ? styleDisplayName(current.style) : ""}
        projectId={project.id}
        preselect={quote?.preselect ?? null}
        found={currentPieces ?? []}
        tier={tier}
        budgetLine={budgetQuoteLine(project.roomType, budget)}
        homeRoomCount={(project.otherRoomsWithDesigns ?? 0) + (designs.length > 0 ? 1 : 0)}
        onClose={() => setQuote(null)}
      />

      {current && (
        <EstimateSheet
          open={estimateOpen && shown === "result"}
          imageUrl={current.imageUrl}
          estimate={estimate}
          excluded={excluded[current.id] ?? []}
          onToggle={(pieceId) =>
            setExcluded((all) => {
              const list = all[current.id] ?? []
              const next = list.includes(pieceId) ? list.filter((id) => id !== pieceId) : [...list, pieceId]
              return { ...all, [current.id]: next }
            })
          }
          tier={tier}
          onTierChange={saveBudget}
          onQuote={(pieceIds) => {
            setEstimateOpen(false)
            setQuote({ preselect: pieceIds.map((id) => `found:${id}`) })
          }}
          onClose={() => setEstimateOpen(false)}
        />
      )}

      <SwapSheet
        open={swapTarget !== null && shown === "change"}
        target={swapTarget}
        pieces={pieces}
        chosen={swapPiece}
        onChoose={setSwapPiece}
        onAddPhoto={() => setPieceSheet("swap")}
        onSwap={(request) =>
          swapTarget &&
          changePiece({ action: "swap", target: swapTarget, changes: request.changes, text: request.text }, request.piece)
        }
        onClose={() => {
          setSwapTarget(null)
          setSwapPiece(null)
        }}
      />

      <PieceSheet
        open={pieceSheet !== null}
        projectId={project.id}
        pieces={pieces}
        title={pieceSheet === "place" ? "Add a piece to this design" : "A piece you love"}
        useLabel={pieceSheet === "place" ? "Add it to my design" : pieceSheet === "swap" ? "Swap it in" : "Use this piece"}
        onClose={() => setPieceSheet(null)}
        onSaved={(saved) => setPieces((list) => addPiece(list, saved))}
        onUse={(chosen) => {
          const purpose = pieceSheet
          setPieceSheet(null)
          if (purpose === "place" && current) {
            generate(current.style, { must: [], piece: chosen, mode: "place", baseDesignId: current.id })
          } else if (purpose === "swap") {
            setSwapPiece(chosen)
          } else {
            setPiece(chosen)
          }
        }}
      />
    </div>
  )
}
