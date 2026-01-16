"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Image as ImageIcon, Trash2 } from "lucide-react"
import AiDesignGallery from "@/components/AiDesignGallery"
import { fetchProjects, ProjectSummary } from "@/lib/api/projects"

export default function GalleriesPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clearingProjectId, setClearingProjectId] = useState<string | null>(null)

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchProjects()
      setProjects(data)
      
      // Debug logging
      if (process.env.NODE_ENV === "development") {
        console.log("[Galleries] Loaded projects:", {
          projectsCount: data.length,
          projectsWithDesigns: data.filter((p) => (p.aiDesigns ?? []).length > 0).length,
          firstProject: data[0] ? {
            id: data[0].id,
            imageUrl: data[0].imageUrl?.substring(0, 50),
            designsCount: (data[0].aiDesigns ?? []).length,
            firstDesignUrl: (data[0].aiDesigns ?? [])[0]?.imageUrl?.substring(0, 50),
          } : null,
        })
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to load projects"
      setError(errorMessage)
      // Set empty array to prevent UI crashes
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const handleClearGallery = async (projectId: string) => {
    if (!confirm("Are you sure you want to clear all AI designs for this project?")) {
      return
    }

    setClearingProjectId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAiDesigns: true }),
      })

      if (!res.ok) {
        throw new Error("Failed to clear gallery")
      }

      // Reload projects to reflect changes
      await loadProjects()
    } catch (err) {
      console.error("Failed to clear gallery:", err)
      alert("Failed to clear gallery. Please try again.")
    } finally {
      setClearingProjectId(null)
    }
  }

  // Filter projects to only show those with valid AI designs (excluding stale generated_*.png)
  const projectsWithDesigns = projects.filter((project) => {
    const validDesigns = (project.aiDesigns || []).filter((d) => {
      if (!d.imageUrl) return false
      const cleanUrl = d.imageUrl.split("?")[0]
      // Filter out stale generated_*.png URLs
      if (cleanUrl.includes("/uploads/generated_")) return false
      // Only allow /uploads/design-*.png files (or remote URLs)
      if (cleanUrl.startsWith("/uploads/") && !cleanUrl.includes("/uploads/design-")) {
        return false
      }
      return true
    })
    return validDesigns.length > 0
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading galleries...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">AI Design Galleries</h2>
          <p className="text-muted-foreground">
            View all your AI-generated room designs organized by project
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/ai-studio")}>
          <ImageIcon className="h-4 w-4 mr-2" />
          Generate New Design
        </Button>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-amber-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-amber-800">
                Projects unavailable (DB offline)
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadProjects}
                disabled={loading}
                className="mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  "Retry"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!error && projectsWithDesigns.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No AI designs yet</h3>
            <p className="text-muted-foreground mb-4">
              Generate your first AI design in the AI Studio to see it here.
            </p>
            <Button onClick={() => router.push("/ai-studio")}>
              Go to AI Studio
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {projectsWithDesigns.map((project) => {
          // Filter out stale /uploads/generated_*.png URLs and add cache busters
          const designs = (project.aiDesigns || [])
            .filter((d) => {
              // Must have imageUrl
              if (!d.imageUrl) return false
              // Filter out stale generated_*.png URLs
              const cleanUrl = d.imageUrl.split("?")[0]
              if (cleanUrl.includes("/uploads/generated_")) return false
              // Only show /uploads/design-*.png files (or remote URLs)
              if (cleanUrl.startsWith("/uploads/") && !cleanUrl.includes("/uploads/design-")) {
                return false
              }
              return true
            })
            .map((d) => {
              // Add cache buster using design.id, createdAt, or timestamp
              const cleanUrl = d.imageUrl.split("?")[0]
              const cacheBuster = d.id || d.createdAt || Date.now().toString()
              const imageUrlWithCache = `${cleanUrl}?v=${cacheBuster}`
              
              return {
                id: d.id,
                imageUrl: imageUrlWithCache,
                style: d.style,
                budgetRange: d.budgetRange,
                createdAt: d.createdAt,
              }
            })

          return (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  {(project.coverImageUrl || project.imageUrl) && (
                    <img
                      src={project.coverImageUrl || project.imageUrl || ""}
                      alt={project.name}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>
                      {designs.length} AI design{designs.length !== 1 ? "s" : ""} generated
                      {project.roomType && ` • ${project.roomType}`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {designs.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleClearGallery(project.id)}
                        disabled={clearingProjectId === project.id}
                      >
                        {clearingProjectId === project.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Clearing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3 w-3 mr-1" />
                            Clear Gallery
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/project/${project.id}`)}
                    >
                      View Project
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/ai-studio?projectId=${project.id}`)}
                    >
                      Generate Design
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {designs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg p-6">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">No designs for this project yet.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/ai-studio?projectId=${project.id}`)}
                    >
                      Generate Design
                    </Button>
                  </div>
                ) : (
                  <AiDesignGallery
                    projectId={project.id}
                    aiDesigns={designs}
                    selectedAiDesignId={project.selectedAiDesignId || undefined}
                  />
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
