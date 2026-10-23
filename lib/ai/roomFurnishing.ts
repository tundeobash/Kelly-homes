import { generateText } from "@/lib/ai/gemini"

export interface FurnishingPlanItem {
  item: string
  placement: string
  scale: string
  material: string
  color: string
  notes?: string
}

export interface FurnishingPlan {
  roomType: string
  style: string
  addItems: FurnishingPlanItem[]
  avoid: string[]
  lighting: string
  colorPalette: string[]
}

export interface FurnishingPlanResult {
  planJson: FurnishingPlan
  planText: string
}

export type KnownRoomType =
  | "bedroom"
  | "living room"
  | "dining room"
  | "kitchen"
  | "office"
  | "other"

export interface RoomGuide {
  roomType: KnownRoomType
  label: string
  layout: string
  requiredGroups: string[][]
  fallbackItems: Array<{ item: string; placement: string; scale: string }>
  extraItems: Array<{ item: string; placement: string; scale: string }>
}

const GUIDES: Record<KnownRoomType, RoomGuide> = {
  bedroom: {
    roomType: "bedroom",
    label: "bedroom",
    layout:
      "Place a bed as the focal point against a wall, with nightstands beside it, bedside lighting, and storage such as a dresser or wardrobe. Keep a clear path around the bed.",
    requiredGroups: [
      ["bed", "mattress"],
      ["nightstand", "bedside"],
      ["lamp", "lighting", "sconce"],
      ["dresser", "wardrobe", "chest", "storage"],
    ],
    fallbackItems: [
      { item: "bed", placement: "against the main wall, centered", scale: "large" },
      { item: "nightstand", placement: "on the floor beside the bed", scale: "small" },
      { item: "bedside lamp", placement: "on the nightstand", scale: "small" },
      { item: "dresser", placement: "against a side wall, not blocking the door", scale: "medium" },
    ],
    extraItems: [
      { item: "second nightstand", placement: "on the other side of the bed", scale: "small" },
      { item: "bedroom bench", placement: "at the foot of the bed", scale: "medium" },
    ],
  },
  "living room": {
    roomType: "living room",
    label: "living room",
    layout:
      "Arrange seating for conversation, with a coffee table in front of the sofa, a rug defining the seating area, and lighting. A media console may sit against a wall.",
    requiredGroups: [
      ["sofa", "sectional", "couch"],
      ["coffee table", "cocktail table"],
      ["rug"],
      ["lamp", "lighting"],
    ],
    fallbackItems: [
      { item: "sofa", placement: "on the floor, facing the conversation area", scale: "large" },
      { item: "coffee table", placement: "in front of the sofa", scale: "medium" },
      { item: "area rug", placement: "under the sofa and coffee table", scale: "large" },
      { item: "floor lamp", placement: "beside the sofa", scale: "medium" },
    ],
    extraItems: [
      { item: "side table", placement: "next to the sofa", scale: "small" },
      { item: "media console", placement: "against the wall opposite the sofa", scale: "medium" },
    ],
  },
  "dining room": {
    roomType: "dining room",
    label: "dining room",
    layout:
      "Center a dining table with chairs around it, leave circulation space, add a sideboard against a wall, and use overhead lighting above the table.",
    requiredGroups: [
      ["dining table", "dining"],
      ["chair"],
      ["sideboard", "buffet", "storage"],
      ["pendant", "chandelier", "lighting", "lamp"],
    ],
    fallbackItems: [
      { item: "dining table", placement: "centered in the room", scale: "large" },
      { item: "dining chairs", placement: "around the dining table", scale: "medium" },
      { item: "sideboard", placement: "against a wall, clear of the door", scale: "medium" },
      { item: "pendant light", placement: "centered above the dining table", scale: "medium" },
    ],
    extraItems: [
      { item: "extra dining chairs", placement: "along the open side of the table", scale: "medium" },
    ],
  },
  kitchen: {
    roomType: "kitchen",
    label: "kitchen",
    layout:
      "Keep the existing cabinets, counters, and appliances. Style the room with a table or island seating, task lighting, and visible storage. Do not demolish the kitchen.",
    requiredGroups: [
      ["kitchen table", "island"],
      ["stool", "chair"],
      ["pendant", "lighting", "lamp"],
      ["shelf", "storage", "cabinet"],
    ],
    fallbackItems: [
      { item: "kitchen table", placement: "in the open floor area, clear of the work triangle", scale: "large" },
      { item: "counter stools", placement: "at the table or island", scale: "medium" },
      { item: "pendant light", placement: "above the table or island", scale: "medium" },
      { item: "open shelf", placement: "on a wall that is not a window", scale: "medium" },
    ],
    extraItems: [
      { item: "kitchen cart", placement: "against an open wall", scale: "medium" },
    ],
  },
  office: {
    roomType: "office",
    label: "office",
    layout:
      "Place a desk where it can face the room or a window, with a chair, a lamp, and storage such as a bookshelf. Keep the doorway clear.",
    requiredGroups: [
      ["desk"],
      ["chair"],
      ["lamp", "lighting"],
      ["bookshelf", "shelf", "storage", "cabinet"],
    ],
    fallbackItems: [
      { item: "desk", placement: "against a wall or in front of a window", scale: "large" },
      { item: "office chair", placement: "at the desk", scale: "medium" },
      { item: "desk lamp", placement: "on the desk", scale: "small" },
      { item: "bookshelf", placement: "against a side wall", scale: "medium" },
    ],
    extraItems: [
      { item: "guest chair", placement: "across from the desk", scale: "medium" },
    ],
  },
  other: {
    roomType: "other",
    label: "room",
    layout:
      "Furnish the room for the way it is actually used. Do not assume it is a living room. Include a main piece, a supporting piece, and lighting.",
    requiredGroups: [["furniture", "table", "chair", "bed", "desk", "sofa", "storage"]],
    fallbackItems: [
      { item: "main furniture piece suited to this room", placement: "on the main floor area", scale: "large" },
      { item: "supporting table", placement: "beside the main piece", scale: "medium" },
      { item: "lamp", placement: "near the main furniture", scale: "small" },
      { item: "storage piece", placement: "against a wall, clear of the door", scale: "medium" },
    ],
    extraItems: [
      { item: "rug", placement: "under the main furniture", scale: "large" },
    ],
  },
}

const EMPTY_PHRASES = [
  "empty room",
  "empty space",
  "no furniture",
  "without furniture",
  "unfurnished",
  "bare room",
  "vacant room",
  "only walls",
  "no major furniture",
]

export function normalizeRoomType(value: string | null | undefined): KnownRoomType | "" {
  const text = (value || "").trim().toLowerCase()
  if (!text) return ""
  if (text.includes("bed")) return "bedroom"
  if (text.includes("dining")) return "dining room"
  if (text.includes("kitchen")) return "kitchen"
  if (text.includes("office") || text.includes("study")) return "office"
  if (text.includes("living") || text.includes("lounge")) return "living room"
  return "other"
}

/** Saved project room type wins. A missing value is left unspecified, not treated as a living room. */
export function resolveRoomType(input: {
  requested?: string | null
  saved?: string | null
}): KnownRoomType | "" {
  return normalizeRoomType(input.saved) || normalizeRoomType(input.requested)
}

export function getRoomGuide(roomType: string | null | undefined): RoomGuide {
  const normalized = normalizeRoomType(roomType)
  return GUIDES[normalized || "other"]
}

export function buildPlanningPrompt(params: {
  roomType?: string | null
  style: string
  prompt?: string
  moreFurniture?: boolean
}): string {
  const guide = getRoomGuide(params.roomType)
  const roomLabel = normalizeRoomType(params.roomType) || "the room shown in the photo"
  const example = guide.fallbackItems[0]
  const required = guide.fallbackItems.map((item) => item.item).join(", ")

  return `Analyze this room photo and create a detailed staging plan in JSON format.

The room type is: ${roomLabel}.
You must plan this exact room type. Do not convert it into a different room.
${normalizeRoomType(params.roomType) === "bedroom" ? "This is a bedroom. Do not plan a sofa, coffee table, or living-room layout." : ""}
${normalizeRoomType(params.roomType) === "" ? "The room type was not provided. Infer it from the photo. Do not assume it is a living room." : ""}
Style: ${params.style}
Layout: ${guide.layout}
${params.prompt ? `Additional requirements: ${params.prompt}` : ""}
${params.moreFurniture ? "Include additional furniture and decor appropriate to this room type." : ""}

Return ONLY valid JSON with this structure (no markdown, no code blocks):
{
  "roomType": "${guide.roomType}",
  "style": "${params.style}",
  "addItems": [
    {
      "item": "${example.item}",
      "placement": "${example.placement}",
      "scale": "${example.scale}",
      "material": "appropriate to the style",
      "color": "appropriate to the style",
      "notes": "clearly visible"
    }
  ],
  "avoid": [
    "do not block doors or windows",
    "preserve existing architecture",
    "do not return an empty room",
    "do not remove furniture unless explicitly requested"
  ],
  "lighting": "lighting appropriate to a ${guide.label}",
  "colorPalette": ["colors that match the style"]
}

Requirements:
- The plan must furnish a ${guide.label}.
- Must include these kinds of pieces: ${required}.
- Each item must have a specific placement.
- Do not leave the room empty.
- Return ONLY the JSON object.`
}

function includesTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(text)
}

export function planMatchesRoom(
  items: Array<{ item?: string }>,
  roomType: string | null | undefined
): boolean {
  const text = items.map((item) => item.item || "").join(" ").toLowerCase()
  if (!text.trim()) return false
  const guide = getRoomGuide(roomType)
  if (!normalizeRoomType(roomType)) {
    return items.filter((item) => (item.item || "").trim()).length >= 2
  }
  return guide.requiredGroups.every((group) => group.some((word) => includesTerm(text, word)))
}

export function buildFallbackPlan(params: {
  roomType?: string | null
  style: string
  moreFurniture?: boolean
  colors?: string[]
}): FurnishingPlanResult {
  const guide = getRoomGuide(params.roomType)
  const colors = params.colors?.length ? params.colors : ["neutral", "beige", "wood", "white"]
  const pieces = params.moreFurniture
    ? [...guide.fallbackItems, ...guide.extraItems]
    : guide.fallbackItems

  const planJson: FurnishingPlan = {
    roomType: normalizeRoomType(params.roomType) || guide.roomType,
    style: params.style,
    addItems: pieces.map((piece, index) => ({
      item: piece.item,
      placement: piece.placement,
      scale: piece.scale,
      material: "appropriate to the style",
      color: colors[index % colors.length],
      notes: "must be clearly visible in the finished room",
    })),
    avoid: [
      "do not block doors or windows",
      "preserve existing architecture",
      "do not return an empty room",
      "do not remove furniture unless explicitly requested",
    ],
    lighting: `lighting appropriate to a ${guide.label}`,
    colorPalette: colors,
  }

  return {
    planJson,
    planText: JSON.stringify(planJson, null, 2),
  }
}

export function ensureRoomPlan(
  plan: FurnishingPlanResult,
  params: { roomType?: string | null; style: string; moreFurniture?: boolean; colors?: string[] }
): { plan: FurnishingPlanResult; fallbackUsed: boolean; reason: string } {
  const requested = normalizeRoomType(params.roomType)
  const items = plan.planJson?.addItems || []
  if (planMatchesRoom(items, params.roomType)) {
    if (requested && plan.planJson.roomType !== requested) {
      plan.planJson.roomType = requested
    }
    return { plan, fallbackUsed: false, reason: "plan matched the room type" }
  }

  return {
    plan: buildFallbackPlan(params),
    fallbackUsed: true,
    reason: "planner result did not include the furniture required for this room type",
  }
}

export function buildGenerationPrompts(params: {
  roomType?: string | null
  style: string
  planText?: string
  stylePositive?: string
  userPrompt?: string
  negative?: string
  continuity: string
}): { pass1: string; pass2: string; summary: string } {
  const guide = getRoomGuide(params.roomType)
  const roomLabel = normalizeRoomType(params.roomType) ? guide.label : "room shown in the photo"
  const furnishedList = guide.fallbackItems.map((item) => item.item).join(", ")
  const userLine = params.userPrompt?.trim() ? params.userPrompt.trim() : ""

  const pass1 = `This is a ${roomLabel} photographed for a ${params.style} redesign.
Preserve the architectural layout, camera angle, walls, windows, doors, and ceiling.
Do not empty the room and do not remove furniture.
Do not turn this into a different kind of room.
Improve only lighting consistency and surface continuity.
${params.continuity}`

  const pass2 = `Redesign this ${roomLabel} in a ${params.style} style as a fully furnished, realistic, lived-in room.
The finished image must visibly include: ${furnishedList}.
Layout: ${guide.layout}
Do not return an empty room, a bare shell, or a room with only walls and flooring.
Preserve the architecture, camera angle, walls, windows, doors, and ceiling.
If furniture is replaced, the new furniture must be present. Do not remove furniture unless the request explicitly says to remove it.
${params.stylePositive?.trim() ? params.stylePositive.trim() : ""}
${userLine}
${params.planText?.trim() ? `Furnishing plan:\n${params.planText.trim()}` : ""}
${params.continuity}
${params.negative?.trim() ? `Negative prompts:\n${params.negative.trim()}\nempty room, unfurnished room, bare shell, missing major furniture` : "Negative prompts:\nempty room, unfurnished room, bare shell, missing major furniture"}`

  const summary = `Room type: ${roomLabel}. Style: ${params.style}. Required furniture: ${furnishedList}.`

  return { pass1: pass1.trim(), pass2: pass2.trim(), summary }
}

export interface RoomInspection {
  empty: boolean
  furniture: string[]
  looksLike: string
  notes: string
}

export function buildInspectionPrompt(roomType: string | null | undefined): string {
  const guide = getRoomGuide(roomType)
  return `Look at this interior photo and answer with JSON only.
{
  "empty": true or false,
  "furniture": ["visible major furniture pieces"],
  "looksLike": "bedroom" | "living room" | "dining room" | "kitchen" | "office" | "other",
  "notes": "one short sentence"
}
empty is true only when the room has no major furniture.
The project room type is ${guide.label}. List what is actually visible. Do not invent furniture.`
}

export function parseRoomInspection(text: string): RoomInspection {
  let jsonText = text.trim()
  if (jsonText.startsWith("```json")) {
    jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "")
  } else if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "")
  }

  const parsed = JSON.parse(jsonText) as Partial<RoomInspection>
  const furniture = Array.isArray(parsed.furniture)
    ? parsed.furniture.map((item) => String(item)).filter(Boolean)
    : []

  return {
    empty: parsed.empty === true,
    furniture,
    looksLike: typeof parsed.looksLike === "string" ? parsed.looksLike : "",
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
  }
}

export function assessRoomOutput(
  inspection: RoomInspection,
  roomType: string | null | undefined
): { passed: boolean; reason: string } {
  const guide = getRoomGuide(roomType)
  const requested = normalizeRoomType(roomType)
  const furnitureText = inspection.furniture.join(" ").toLowerCase()
  const described = [furnitureText, inspection.notes].join(" ").toLowerCase()

  const saysEmpty =
    inspection.empty ||
    inspection.furniture.length === 0 ||
    EMPTY_PHRASES.some((phrase) => described.includes(phrase))

  if (saysEmpty) {
    return {
      passed: false,
      reason: "The result looks like an empty room with no major furniture, so it was not saved.",
    }
  }

  if (requested && requested !== "other") {
    const seen = guide.requiredGroups[0].some((word) => includesTerm(furnitureText, word))
    if (!seen) {
      return {
        passed: false,
        reason: `This ${guide.label} result does not show the main ${guide.label} furniture (${guide.requiredGroups[0].join(" or ")}), so it was not saved.`,
      }
    }
  }

  const looksLike = normalizeRoomType(inspection.looksLike)
  if (requested && looksLike && looksLike !== "other" && looksLike !== requested) {
    return {
      passed: false,
      reason: `The result looks like a ${looksLike}, not a ${guide.label}, so it was not saved.`,
    }
  }

  return { passed: true, reason: `The result is a furnished ${guide.label}.` }
}

export async function inspectGeneratedRoom(params: {
  imageBase64: string
  mimeType?: string
  roomType?: string | null
  requestId?: string
  describe?: (prompt: string, image: { data: string; mimeType: string }) => Promise<string>
}): Promise<RoomInspection> {
  const prompt = buildInspectionPrompt(params.roomType)
  const image = {
    data: params.imageBase64,
    mimeType: params.mimeType || "image/png",
  }
  const describe =
    params.describe ||
    (async (inspectionPrompt: string, inspectionImage: { data: string; mimeType: string }) =>
      generateText(inspectionPrompt, [inspectionImage], params.requestId))

  const text = await describe(prompt, image)
  if (!text || !text.trim()) {
    throw new Error("The furnishing check did not return a description.")
  }
  return parseRoomInspection(text)
}
