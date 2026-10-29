"use client"

import { AlertCircle, ArrowLeftRight, Check, ChevronRight, Dot, Plus, Receipt, Undo2 } from "lucide-react"
import BeforeAfterSlider from "@/components/design/BeforeAfterSlider"
import EstimateCard from "@/components/design/EstimateCard"
import type { BudgetTier } from "@/lib/design/budget"
import type { Estimate, PriceTier } from "@/lib/design/estimate"
import { editDetail, editHeadline, editMissedMessage } from "@/lib/design/pieceEdit"
import { missingMessage } from "@/lib/design/mustInclude"
import { contactLinks } from "@/lib/landing"
import { pieceLabel } from "@/lib/design/pieces"
import { QUOTE_REPLY_PROMISE } from "@/lib/design/quote"
import { STUDIO_STYLES, findStudioStyle } from "@/lib/design/studioStyles"
import type { StudioDesign } from "@/lib/design/studioFlow"

interface ResultViewProps {
  design: StudioDesign
  beforeSrc: string | null
  /** "Before" (room photo) or "Previous" (the design a changed piece was made from). */
  beforeLabel?: "Before" | "Previous"
  /** The design a changed piece was made from, while it is still kept. */
  previousId?: string | null
  styleName: string
  number: number
  total: number
  usedStyles: string[]
  onTryAnother: () => void
  onCompare: () => void
  onTryStyle: (styleId: string) => void
  onSliderMoved?: () => void
  /** Makes the same style again with the same must-have pieces. */
  onRetryMissing?: () => void
  /** Opens "Add a piece to this design". */
  onAddPiece?: () => void
  /** Opens "Get a quote", optionally with one item ticked (e.g. "piece:<id>"). */
  onQuote?: (preselect?: string) => void
  /** The room's budget band; changing it does not change the design. */
  budget: BudgetTier | null
  /** The instant estimate: null while the pieces are being found. */
  estimate: Estimate | null
  estimateError: string | null
  tier: PriceTier
  onTierChange: (tier: PriceTier) => void
  onOpenEstimate: () => void
  onRetryEstimate: () => void
  /** Opens "Change a piece". */
  onChangePiece?: () => void
  /** Shows another of the room's designs, e.g. the previous one. */
  onShowDesign?: (id: string) => void
  /** Repeats a change that did not work, when it can be repeated. */
  onRetryEdit?: () => void
}

export default function ResultView({
  design,
  beforeSrc,
  beforeLabel = "Before",
  previousId = null,
  styleName,
  number,
  total,
  usedStyles,
  onTryAnother,
  onCompare,
  onTryStyle,
  onSliderMoved,
  onRetryMissing,
  onAddPiece,
  onQuote,
  budget,
  estimate,
  estimateError,
  tier,
  onTierChange,
  onOpenEstimate,
  onRetryEstimate,
  onChangePiece,
  onShowDesign,
  onRetryEdit,
}: ResultViewProps) {
  const edit = design.edit ?? null
  const editMissed = edit ? editMissedMessage(edit) : null
  const feedback = contactLinks().feedback
  const used = new Set(usedStyles.map((style) => findStudioStyle(style)?.id ?? style))
  const nextStyles = STUDIO_STYLES.filter((style) => !used.has(style.id)).slice(0, 6)
  const asked = design.mustInclude ?? []
  const shownPieces = asked.filter((r) => r.included !== false)
  const piece = design.piece ?? null
  const pieceShown = piece !== null && design.pieceIncluded !== false
  const missing = missingMessage(asked, piece && design.pieceIncluded === false ? [`your ${piece.name.toLowerCase()}`] : [])
  const unchecked = asked.some((r) => r.included === null) || (piece !== null && design.pieceIncluded == null)

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
      <BeforeAfterSlider
        key={design.id}
        beforeSrc={beforeSrc}
        afterSrc={design.imageUrl}
        afterAlt={edit ? `New: ${editHeadline(edit).toLowerCase()}` : `After: ${styleName} design of your room`}
        beforeAlt={beforeLabel === "Previous" ? "Previous: the design before this change" : undefined}
        beforeLabel={beforeLabel}
        afterLabel={beforeLabel === "Previous" ? "New" : "After"}
        onFirstMove={onSliderMoved}
      />

      <div className="pb-28 lg:pb-0">
        <div className="mt-4 flex items-baseline justify-between gap-3 lg:mt-2">
          <h1 className="font-serif text-[24px] font-semibold leading-tight text-ks-ink lg:text-[34px]">{styleName}</h1>
          <p className="whitespace-nowrap text-[13px] text-ks-stone">
            Design {number} of {total}
          </p>
        </div>
        <p className="mt-1.5 text-[13px] leading-normal text-ks-stone">
          Walls, windows and doors come from your photo. Furniture and decor are imagined by AI.
        </p>
        <EstimateCard
          estimate={estimate}
          error={estimateError}
          tier={tier}
          onTierChange={onTierChange}
          onOpen={onOpenEstimate}
          onRetry={onRetryEstimate}
        />
        {onQuote && (
          <button
            type="button"
            onClick={() => onQuote()}
            className="mt-3.5 flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-ks-sand px-3.5 py-2.5 text-left outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ks-charcoal"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-ks-charcoal">
              <Receipt className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold leading-snug text-ks-ink">Get a quote</span>
              <span className="text-[13px] leading-snug text-ks-charcoal">
                {budget && budget !== "unsure" ? "Real prices within your budget." : "For the whole room or chosen pieces."}{" "}
                {QUOTE_REPLY_PROMISE}
              </span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] flex-shrink-0 text-ks-charcoal" aria-hidden="true" />
          </button>
        )}
        {edit && (
          <section className="mt-3.5 rounded-2xl border border-ks-line bg-white px-3.5 py-3">
            <h2 className="font-sans text-[13px] font-semibold leading-normal text-ks-stone">What changed</h2>
            <div className="mt-1.5 flex items-start gap-2.5">
              {piece && edit.withPiece ? (
                <img src={piece.imageUrl} alt="" className="mt-0.5 h-9 w-9 flex-shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ks-sand text-ks-charcoal">
                  <ArrowLeftRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug text-ks-ink">{editHeadline(edit)}</p>
                {editDetail(edit) && <p className="mt-0.5 text-[13px] leading-snug text-ks-stone">{editDetail(edit)}</p>}
                {piece && edit.withPiece && onQuote && (
                  <button
                    type="button"
                    onClick={() => onQuote(`piece:${piece.id}`)}
                    className="inline-flex min-h-[32px] items-center text-[14px] font-medium text-ks-charcoal underline underline-offset-4"
                  >
                    Want this one? Get a quote for it
                  </button>
                )}
              </div>
            </div>
            {editMissed && (
              <div className="mt-2.5 flex items-center gap-2.5 rounded-[10px] bg-[#FBF3E4] px-2.5 py-1.5">
                <AlertCircle className="h-[18px] w-[18px] flex-shrink-0 text-[#92400E]" aria-hidden="true" />
                <p className="flex-1 text-[14px] leading-snug text-ks-ink">{editMissed}</p>
                {onRetryEdit && (
                  <button
                    type="button"
                    onClick={onRetryEdit}
                    className="flex min-h-[40px] items-center px-1 text-[14px] font-semibold text-ks-charcoal underline underline-offset-4"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {onChangePiece && (
                <button
                  type="button"
                  onClick={onChangePiece}
                  className="min-h-[44px] rounded-xl border border-[#D1D5DB] bg-white px-2 text-[14px] font-semibold text-ks-charcoal hover:border-ks-charcoal"
                >
                  Change another piece
                </button>
              )}
              {previousId && onShowDesign && (
                <button
                  type="button"
                  onClick={() => onShowDesign(previousId)}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#D1D5DB] bg-white px-2 text-[14px] font-semibold text-ks-charcoal hover:border-ks-charcoal"
                >
                  <Undo2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  Previous design
                </button>
              )}
            </div>
          </section>
        )}
        {!edit && (asked.length > 0 || piece) && (
          <section className="mt-3.5 rounded-2xl border border-ks-line bg-white px-3.5 py-3">
            {(shownPieces.length > 0 || pieceShown) && (
              <>
                <h2 className="font-sans text-[13px] font-semibold leading-normal text-ks-stone">
                  {unchecked ? "You asked for" : "Included as you asked"}
                </h2>
                <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                  {shownPieces.map((piece) => (
                    <li key={piece.id} className="flex items-center gap-2 text-[15px] font-medium text-ks-ink">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ks-sand text-ks-charcoal">
                        {piece.included ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                        ) : (
                          <Dot className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                      {piece.label}
                    </li>
                  ))}
                </ul>
                {piece && pieceShown && (
                  <div className="mt-2 flex items-start gap-2.5">
                    <img src={piece.imageUrl} alt="" className="mt-0.5 h-9 w-9 flex-shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[15px] font-medium leading-snug text-ks-ink">
                        {design.pieceIncluded ? (
                          <Check className="h-3.5 w-3.5 flex-shrink-0 text-ks-charcoal" strokeWidth={2.4} aria-hidden="true" />
                        ) : null}
                        Your {pieceLabel(piece).toLowerCase()}
                      </p>
                      {onQuote && (
                        <button
                          type="button"
                          onClick={() => onQuote(`piece:${piece.id}`)}
                          className="inline-flex min-h-[32px] items-center text-[14px] font-medium text-ks-charcoal underline underline-offset-4"
                        >
                          Want this one? Get a quote for it
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {missing && (
              <div className={`flex items-center gap-2.5 rounded-[10px] bg-[#FBF3E4] px-2.5 py-1.5 ${shownPieces.length > 0 ? "mt-2.5" : ""}`}>
                <AlertCircle className="h-[18px] w-[18px] flex-shrink-0 text-[#92400E]" aria-hidden="true" />
                <p className="flex-1 text-[14px] leading-snug text-ks-ink">{missing}</p>
                {onRetryMissing && (
                  <button
                    type="button"
                    onClick={onRetryMissing}
                    className="flex min-h-[40px] items-center px-1 text-[14px] font-semibold text-ks-charcoal underline underline-offset-4"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}
          </section>
        )}
        {onChangePiece && !edit && (
          <button
            type="button"
            onClick={onChangePiece}
            className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-ks-line bg-white px-3.5 py-2 text-left outline-none transition-colors duration-150 hover:border-ks-charcoal focus-visible:ring-2 focus-visible:ring-ks-charcoal"
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#D1D5DB] text-ks-charcoal">
              <ArrowLeftRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold leading-snug text-ks-ink">Change a piece</span>
              <span className="text-[13px] leading-snug text-ks-stone">Swap, move or remove any piece; the rest stays</span>
            </span>
          </button>
        )}
        {onAddPiece && (
          <button
            type="button"
            onClick={onAddPiece}
            className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-ks-line bg-white px-3.5 py-2 text-left outline-none transition-colors duration-150 hover:border-ks-charcoal focus-visible:ring-2 focus-visible:ring-ks-charcoal"
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#D1D5DB] text-ks-charcoal">
              <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold leading-snug text-ks-ink">Add a piece to this design</span>
              <span className="text-[13px] leading-snug text-ks-stone">A photo of a piece you love; the rest stays as it is</span>
            </span>
          </button>
        )}
        {feedback && (
          <p className="mt-2 text-[13px] leading-normal text-ks-stone">
            Something look wrong?{" "}
            <a
              href={feedback}
              target={feedback.startsWith("https:") ? "_blank" : undefined}
              rel={feedback.startsWith("https:") ? "noopener noreferrer" : undefined}
              className="text-[13px] font-medium text-ks-charcoal underline underline-offset-4"
            >
              Send feedback
            </a>
          </p>
        )}

        <div className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-2 gap-3 border-t border-ks-line bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
          <button
            type="button"
            onClick={onTryAnother}
            className="flex h-[52px] items-center justify-center rounded-xl bg-ks-charcoal text-[15px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            Try another style
          </button>
          <button
            type="button"
            onClick={onCompare}
            className="flex h-[52px] items-center justify-center rounded-xl border border-ks-charcoal bg-white text-[15px] font-semibold text-ks-charcoal transition-colors duration-150 hover:bg-ks-paper"
          >
            Compare
          </button>
        </div>

        {nextStyles.length > 0 && (
          <div className="hidden lg:block">
            <h2 className="mb-3 mt-8 font-sans text-[13px] font-semibold leading-normal text-ks-stone">Try next</h2>
            <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
              {nextStyles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => onTryStyle(style.id)}
                  className="group text-left outline-none"
                >
                  <img
                    src={style.cardImage}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-[10px] object-cover transition-opacity duration-150 group-hover:opacity-90 group-focus-visible:ring-2 group-focus-visible:ring-ks-charcoal"
                  />
                  <span className="mt-1.5 block text-[13px] font-semibold leading-snug text-ks-ink">{style.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
