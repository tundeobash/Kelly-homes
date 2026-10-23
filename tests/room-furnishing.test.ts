import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createFallbackPlan } from "../lib/ai/geminiPlanner"
import {
  assessRoomOutput,
  buildGenerationPrompts,
  buildPlanningPrompt,
  ensureRoomPlan,
  inspectGeneratedRoom,
  planMatchesRoom,
  resolveRoomType,
} from "../lib/ai/roomFurnishing"

describe("room type propagation", () => {
  it("prefers the room type saved on the project", () => {
    assert.equal(
      resolveRoomType({ requested: "living room", saved: "bedroom" }),
      "bedroom"
    )
    assert.equal(resolveRoomType({ requested: "dining room", saved: "" }), "dining room")
    assert.equal(resolveRoomType({ requested: "", saved: "" }), "")
  })
})

describe("room-specific planning", () => {
  it("asks a bedroom plan for a bed and not a living-room set", () => {
    const prompt = buildPlanningPrompt({ roomType: "bedroom", style: "modern" })
    assert.match(prompt, /bedroom/i)
    assert.match(prompt, /bed/)
    assert.match(prompt, /nightstand/i)
    assert.doesNotMatch(prompt, /Must include at least: sofa, coffee table, rug/)
    assert.match(prompt, /Do not plan a sofa/i)
  })

  it("asks a living room plan for seating and a dining plan for a table", () => {
    const living = buildPlanningPrompt({ roomType: "living room", style: "modern" })
    const dining = buildPlanningPrompt({ roomType: "dining room", style: "modern" })
    assert.match(living, /sofa/i)
    assert.match(living, /conversation/i)
    assert.match(dining, /dining table/i)
    assert.match(dining, /chairs/i)
  })

  it("builds a bedroom fallback instead of a sofa layout", () => {
    const plan = createFallbackPlan({ style: "modern", roomType: "bedroom" })
    const items = plan.planJson.addItems.map((item) => item.item.toLowerCase()).join(" ")
    assert.equal(plan.planJson.roomType, "bedroom")
    assert.match(items, /bed/)
    assert.match(items, /nightstand/)
    assert.match(items, /lamp/)
    assert.match(items, /dresser/)
    assert.equal(planMatchesRoom(plan.planJson.addItems, "bedroom"), true)
    assert.doesNotMatch(items, /sofa/)
  })

  it("replaces a living-room plan when the project is a bedroom", () => {
    const wrong = createFallbackPlan({ style: "modern", roomType: "living room" })
    const ensured = ensureRoomPlan(wrong, { roomType: "bedroom", style: "modern" })
    assert.equal(ensured.fallbackUsed, true)
    assert.equal(ensured.plan.planJson.roomType, "bedroom")
    assert.equal(planMatchesRoom(ensured.plan.planJson.addItems, "bedroom"), true)
  })
})

describe("furnished generation prompts", () => {
  it("asks for a fully furnished bedroom and does not ask for an empty shell", () => {
    const prompts = buildGenerationPrompts({
      roomType: "bedroom",
      style: "japandi",
      continuity: "Preserve the walls.",
    })
    assert.match(prompts.pass2, /fully furnished/i)
    assert.match(prompts.pass2, /bed/)
    assert.match(prompts.pass2, /Do not return an empty room/i)
    assert.match(prompts.pass2, /Do not remove furniture unless/i)
    assert.match(prompts.pass1, /Do not empty the room/i)
    assert.match(prompts.summary, /bedroom/i)
  })
})

describe("output validation", () => {
  it("rejects an empty room and a bedroom that has no bed", () => {
    const empty = assessRoomOutput(
      { empty: true, furniture: [], looksLike: "bedroom", notes: "bare walls" },
      "bedroom"
    )
    assert.equal(empty.passed, false)
    assert.match(empty.reason, /empty room/i)

    const sofaOnly = assessRoomOutput(
      { empty: false, furniture: ["sofa", "coffee table"], looksLike: "living room", notes: "" },
      "bedroom"
    )
    assert.equal(sofaOnly.passed, false)
  })

  it("accepts a furnished bedroom, living room, and dining room", () => {
    const bedroom = assessRoomOutput(
      {
        empty: false,
        furniture: ["bed", "nightstands", "lamps", "dresser"],
        looksLike: "bedroom",
        notes: "furnished",
      },
      "bedroom"
    )
    const living = assessRoomOutput(
      {
        empty: false,
        furniture: ["sofa", "coffee table", "rug", "floor lamp"],
        looksLike: "living room",
        notes: "",
      },
      "living room"
    )
    const dining = assessRoomOutput(
      {
        empty: false,
        furniture: ["dining table", "dining chairs", "sideboard", "pendant light"],
        looksLike: "dining room",
        notes: "",
      },
      "dining room"
    )
    assert.equal(bedroom.passed, true)
    assert.equal(living.passed, true)
    assert.equal(dining.passed, true)
  })

  it("rejects a dining project that comes back as a living room", () => {
    const result = assessRoomOutput(
      {
        empty: false,
        furniture: ["dining table", "chairs"],
        looksLike: "living room",
        notes: "",
      },
      "dining room"
    )
    assert.equal(result.passed, false)
    assert.match(result.reason, /living room/i)
  })

  it("reads a mocked inspection and does not call a live model", async () => {
    let called = false
    const inspection = await inspectGeneratedRoom({
      imageBase64: "abc",
      roomType: "bedroom",
      describe: async (prompt) => {
        called = true
        assert.match(prompt, /bedroom/i)
        return JSON.stringify({
          empty: false,
          furniture: ["bed", "nightstand"],
          looksLike: "bedroom",
          notes: "furnished",
        })
      },
    })
    assert.equal(called, true)
    assert.equal(assessRoomOutput(inspection, "bedroom").passed, true)
  })
})
