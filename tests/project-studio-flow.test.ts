import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { chooseUserId } from "../lib/auth/getUserContext"
import {
  aiStudioPath,
  listProjectsForStudio,
  resolveStudioSelection,
} from "../lib/ai/studioProjects"

describe("project ownership", () => {
  it("lists projects for the signed-in user even when a development fallback user exists", () => {
    const owner = chooseUserId({
      sessionUserId: "user-who-just-created-a-project",
      devMode: true,
      devFallbackUserId: "user-with-the-most-old-projects",
    })

    assert.equal(owner, "user-who-just-created-a-project")
  })

  it("uses the development fallback only when nobody is signed in", () => {
    assert.equal(
      chooseUserId({
        sessionUserId: "",
        devMode: true,
        devFallbackUserId: "user-with-the-most-old-projects",
      }),
      "user-with-the-most-old-projects"
    )
    assert.equal(
      chooseUserId({
        sessionUserId: null,
        devMode: false,
        devFallbackUserId: "user-with-the-most-old-projects",
      }),
      null
    )
  })
})

describe("AI Studio project list", () => {
  it("keeps a new project that has a photo and room type but no generated designs", () => {
    const visible = listProjectsForStudio([
      {
        id: "project-1",
        name: "Main Bedroom",
        roomType: "bedroom",
        imageUrl: "https://example.com/room.png",
        aiDesigns: [],
      },
    ])

    assert.equal(visible.length, 1)
    assert.equal(visible[0].roomType, "bedroom")
    assert.equal(visible[0].aiDesigns?.length, 0)
  })

  it("opens AI Studio with the new project selected and still allows a later switch", () => {
    assert.equal(aiStudioPath("project 1"), "/ai-studio?projectId=project%201")

    const fromProjectPage = resolveStudioSelection({
      urlProjectId: "project-1",
      currentSelection: null,
      urlChanged: true,
    })
    assert.equal(fromProjectPage, "project-1")

    const switched = resolveStudioSelection({
      urlProjectId: "project-1",
      currentSelection: "project-2",
      urlChanged: false,
    })
    assert.equal(switched, "project-2")
  })
})
