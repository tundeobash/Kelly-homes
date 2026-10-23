export interface StudioProjectRef {
  id: string
  name?: string
  roomType?: string
  imageUrl?: string | null
  aiDesigns?: unknown[]
}

/** Projects stay in AI Studio before any design has been generated. */
export function listProjectsForStudio<T extends StudioProjectRef>(projects: T[]): T[] {
  return projects.filter((project) => typeof project.id === "string" && project.id.trim().length > 0)
}

export function aiStudioPath(projectId: string): string {
  return `/ai-studio?projectId=${encodeURIComponent(projectId)}`
}

/**
 * A project id in the address bar selects that project.
 * Choosing another project in the studio is left alone until the address changes.
 */
export function resolveStudioSelection(input: {
  urlProjectId?: string | null
  currentSelection?: string | null
  urlChanged: boolean
}): string | null {
  const urlProjectId = input.urlProjectId?.trim() || ""
  if (input.urlChanged && urlProjectId) return urlProjectId
  const current = input.currentSelection?.trim() || ""
  if (current) return current
  return urlProjectId || null
}
