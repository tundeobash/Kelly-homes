// TODO: Placeholder restored after recovery
export interface ProjectSummary {
  id: string
  name: string
  imageUrl: string | null
  roomType: string
  selectedAiDesignId: string | null
  aiDesigns: Array<{
    id: string
    imageUrl: string
    style?: string
    budgetRange?: string
    createdAt?: string
  }>
  lastAiSettings: {
    style: string
    budgetRange: string
    userPrompt?: string
    updatedAt: string
  } | null
  coverImageUrl: string | null
  createdAt: string
  updatedAt: string
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  try {
    const res = await fetch("/api/projects", {
      cache: "no-store",
      credentials: "include",
    })

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Unauthorized. Please sign in.")
      }
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch projects: ${res.statusText}`)
    }

    const data = await res.json()

    if (data.projects && Array.isArray(data.projects)) {
      return data.projects
    }

    if (Array.isArray(data)) {
      return data
    }

    throw new Error("Invalid response format from API")
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error("Failed to fetch projects")
  }
}
