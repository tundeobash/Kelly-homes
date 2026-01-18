"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { designStyles } from "@/lib/mock/styles"
import { Sparkles, Loader2 } from "lucide-react"
import RoomPhotoUploader from "@/components/RoomPhotoUploader"
import AiDesignGallery from "@/components/AiDesignGallery"
import { fetchProjects, ProjectSummary } from "@/lib/api/projects"

export default function AiStudioClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get("projectId")

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectIdParam)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string>("")
  const [refinePrompt, setRefinePrompt] = useState<string>("")
  const [generatedDesigns, setGeneratedDesigns] = useState<
    Array<{ id: string; imageUrl: string; style: string }>
  >([])
  const [loading, setLoading] = useState(false)
  const [currentImageUrl, setCurrentImageUrl] = useState<string>("")
  const [lowConfidence, setLowConfidence] = useState(false)
  const [lowConfidenceReason, setLowConfidenceReason] = useState<string>("")
  const [moreFurniture, setMoreFurniture] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)

  const loadProjects = async () => {
    try {
      setProjectsLoading(true)
      setProjectsError(null)
      const data = await fetchProjects()
      setProjects(data)
      setProjectsError(null)
      
      if (projectIdParam && data.length > 0) {
        const projectFromList = data.find((p) => p.id === projectIdParam)
        if (projectFromList && projectFromList.imageUrl) {
          if (process.env.NODE_ENV === "development") {
            console.log("[AI Studio] Auto-loaded photo from projects list:", {
              selectedProjectId: projectIdParam,
              photoField: "imageUrl",
              photoUrl: projectFromList.imageUrl,
              source: "projects list",
            })
          }
          setCurrentImageUrl(projectFromList.imageUrl)
        }
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to load projects"
      setProjectsError(errorMessage)
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProjectId) {
      const projectFromList = projects.find((p) => p.id === selectedProjectId)
      if (projectFromList && projectFromList.imageUrl) {
        if (process.env.NODE_ENV === "development") {
          console.log("[AI Studio] Loaded photo from projects list:", {
            selectedProjectId,
            photoField: "imageUrl",
            photoUrl: projectFromList.imageUrl,
            source: "projects list",
          })
        }
        setCurrentImageUrl(projectFromList.imageUrl)
      } else if (projectFromList && !projectFromList.imageUrl) {
        setCurrentImageUrl("")
      }

      const fetchProjectData = async () => {
        try {
          const res = await fetch(`/api/projects/${selectedProjectId}`)
          if (res.ok) {
            const project = await res.json()
            setCurrentImageUrl((prevUrl) => {
              if (project.imageUrl && (!prevUrl || prevUrl !== project.imageUrl)) {
                if (process.env.NODE_ENV === "development") {
                  console.log("[AI Studio] Updated photo from project detail:", {
                    selectedProjectId,
                    photoField: "imageUrl",
                    photoUrl: project.imageUrl,
                    source: "project detail API",
                  })
                }
                return project.imageUrl
              }
              return prevUrl
            })
            if (project.aiDesigns && Array.isArray(project.aiDesigns) && project.aiDesigns.length > 0) {
              const savedDesigns = project.aiDesigns.map((d: any) => ({
                id: d.id,
                imageUrl: `${d.imageUrl}?v=${Date.now()}`,
                style: d.style,
              }))
              setGeneratedDesigns(savedDesigns)
            } else {
              setGeneratedDesigns([])
            }
          }
        } catch (error) {
          console.error("Failed to fetch project data:", error)
        }
      }
      fetchProjectData()
    } else {
      setCurrentImageUrl("")
      setGeneratedDesigns([])
    }
  }, [selectedProjectId, projects])

  const handleGenerate = async () => {
    setGenerateError(null)
    setRequestId(null)

    if (!selectedProjectId) {
      setGenerateError("Please select a project")
      return
    }

    if (!selectedStyle || selectedStyle.trim() === "") {
      setGenerateError("Please select a design style")
      return
    }

    let imageUrlToUse: string | null = null
    
    if (currentImageUrl && currentImageUrl.trim() !== "" && !currentImageUrl.startsWith("blob:")) {
      imageUrlToUse = currentImageUrl
      if (process.env.NODE_ENV === "development") {
        console.log("[AI Studio] Using currentImageUrl directly for generation:", {
          imageUrl: imageUrlToUse.substring(0, 50) + "...",
          source: "currentImageUrl state",
        })
      }
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log("[AI Studio] currentImageUrl missing, fetching project to get imageUrl")
      }
      
      try {
        const projectRes = await fetch(`/api/projects/${selectedProjectId}`)
        if (projectRes.ok) {
          const project = await projectRes.json()
          if (project.imageUrl && project.imageUrl.trim() !== "" && !project.imageUrl.startsWith("blob:")) {
            imageUrlToUse = project.imageUrl
            setCurrentImageUrl(project.imageUrl)
            if (process.env.NODE_ENV === "development") {
              console.log("[AI Studio] Fetched imageUrl from project:", {
                imageUrl: project.imageUrl.substring(0, 50) + "...",
                source: "project API",
              })
            }
          }
        }
      } catch (error) {
        console.error("[AI Studio] Failed to fetch project:", error)
      }
    }

    if (!imageUrlToUse || imageUrlToUse.trim() === "" || imageUrlToUse.startsWith("blob:")) {
      setGenerateError("Project photo not available. Please upload a photo.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/ai/stage-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          imageUrl: imageUrlToUse,
          style: selectedStyle,
          prompt: refinePrompt || undefined,
          moreFurniture,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      
      if (data.requestId) {
        setRequestId(data.requestId)
      }
      
      if (data.success === true) {
        setLowConfidence(data.lowConfidence || false)
        setLowConfidenceReason(data.reason || "")
        
        const returnedImageUrl = data.imageUrl || (data.images && data.images[0]) || null
        const returnedDesignId = data.designId || null
        
        if (returnedImageUrl) {
          const bust = (url: string) => url ? `${url.split("?")[0]}?v=${Date.now()}` : url
          const imageUrlWithCacheBuster = bust(returnedImageUrl)
          
          console.log("[AI Studio] Using returned imageUrl from API:", {
            returnedUrl: returnedImageUrl,
            displayUrl: imageUrlWithCacheBuster,
            designId: returnedDesignId,
            isGenerated: returnedImageUrl.includes("/uploads/design-"),
            isNotInput: returnedImageUrl !== imageUrlToUse,
          })
          
          const newDesign = {
            id: returnedDesignId || `local_${Date.now()}`,
            imageUrl: imageUrlWithCacheBuster,
            style: selectedStyle,
          }
          
          setGeneratedDesigns((prev) => {
            const filtered = prev.filter((d) => d.imageUrl.split("?")[0] !== returnedImageUrl.split("?")[0])
            return [newDesign, ...filtered]
          })
          
          if (selectedProjectId) {
            try {
              const projectRes = await fetch(`/api/projects/${selectedProjectId}`)
              if (projectRes.ok) {
                const projectData = await projectRes.json()
                const project = projectData.project || projectData
                const designs = (project.designs ?? project.aiDesigns ?? []) as any[]
                
                console.log("[AI Studio] Reloaded project designs:", {
                  projectId: selectedProjectId,
                  projectImageUrl: project.imageUrl?.substring(0, 50),
                  designsCount: designs.length,
                  firstDesignUrl: designs[0]?.imageUrl?.substring(0, 50),
                })
                
                const savedDesigns = designs
                  .filter((d: any) => d.imageUrl && !d.imageUrl.includes("/uploads/generated_"))
                  .map((d: any) => ({
                    id: d.id,
                    imageUrl: bust(d.imageUrl),
                    style: d.style,
                  }))
                
                setGeneratedDesigns(savedDesigns)
              }
            } catch (error) {
              console.error("Failed to reload project designs:", error)
            }
          }
        } else {
          console.error("No image URL returned from API")
          setGenerateError("No image URL returned from generation")
        }
      } else {
        const errorMessage = data.errorMessage || "Failed to generate designs"
        const errorCode = data.errorCode || "UNKNOWN_ERROR"
        setLowConfidence(false)
        setLowConfidenceReason("")
        
        console.error("[AI Studio] Generation failed:", {
          errorMessage,
          errorCode,
          requestId: data.requestId,
          retryable: data.retryable,
        })
        
        setGenerateError(
          `${errorMessage}${data.requestId ? ` (Request ID: ${data.requestId})` : ""}`
        )
      }
    } catch (error) {
      console.error("[AI Studio] Network or parsing error:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to generate designs"
      setGenerateError(`Network error: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {projectsError && (
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
                You can still generate designs. Please create a project first or wait for the database to reconnect.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">AI Design Studio</h2>
          <p className="text-muted-foreground">
            Generate AI-powered room designs and save them to your projects
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/galleries")}
          >
            View Galleries
          </Button>
          {projectIdParam && (
            <Button
              variant="outline"
              onClick={() => router.push(`/project/${projectIdParam}`)}
            >
              View Project
            </Button>
          )}
        </div>
      </div>

      {selectedProjectId && (
        <RoomPhotoUploader
          projectId={selectedProjectId}
          value={currentImageUrl}
          onChange={setCurrentImageUrl}
          showTitle={true}
        />
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Design Settings</CardTitle>
            <CardDescription>Configure your AI design generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select
                value={selectedProjectId || ""}
                onValueChange={(value) => {
                  const newProjectId = value || null
                  setSelectedProjectId(newProjectId)
                  if (newProjectId) {
                    const selectedProject = projects.find((p) => p.id === newProjectId)
                    if (selectedProject?.imageUrl) {
                      if (process.env.NODE_ENV === "development") {
                        console.log("[AI Studio] Project selected from dropdown:", {
                          selectedProjectId: newProjectId,
                          photoField: "imageUrl",
                          photoUrl: selectedProject.imageUrl,
                          source: "dropdown selection",
                        })
                      }
                      setCurrentImageUrl(selectedProject.imageUrl)
                    } else {
                      setCurrentImageUrl("")
                    }
                  } else {
                    setCurrentImageUrl("")
                  }
                }}
                disabled={projectsLoading}
              >
                <SelectTrigger id="project">
                  <SelectValue placeholder={
                    projectsLoading 
                      ? "Loading projects..." 
                      : projectsError 
                        ? "Error loading projects" 
                        : projects.length === 0 
                          ? "No projects yet" 
                          : "Select a project"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {projectsError ? (
                    <SelectItem value="__error__" disabled>
                      {projectsError}
                    </SelectItem>
                  ) : projects.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      No projects yet. Create one first.
                    </SelectItem>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {projectsError && (
                <div className="space-y-2">
                  <p className="text-xs text-destructive">{projectsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadProjects}
                    disabled={projectsLoading}
                    className="w-full"
                  >
                    {projectsLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      "Retry"
                    )}
                  </Button>
                </div>
              )}
              {projectIdParam && (
                <p className="text-xs text-muted-foreground">
                  Using current project from URL
                </p>
              )}
              {selectedProjectId && (!currentImageUrl || currentImageUrl.startsWith("blob:")) && (
                <p className="text-xs text-amber-600 font-medium">
                  ⚠️ Upload a room photo first to generate designs
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="style">Style</Label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger id="style">
                  <SelectValue placeholder="Select a style" />
                </SelectTrigger>
                <SelectContent>
                  {designStyles.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Refine Request (Optional)</Label>
              <Input
                id="prompt"
                placeholder="e.g., 'Add more plants' or 'Warmer colors'"
                value={refinePrompt}
                onChange={(e) => setRefinePrompt(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="moreFurniture"
                checked={moreFurniture}
                onCheckedChange={(checked) => setMoreFurniture(checked === true)}
              />
              <Label
                htmlFor="moreFurniture"
                className="text-sm font-normal cursor-pointer"
              >
                More furniture (enforces 6+ items, expanded mask, higher intensity)
              </Label>
            </div>

            {generateError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-red-800">Generation Failed</h3>
                    <p className="mt-1 text-sm text-red-700">{generateError}</p>
                    {requestId && (
                      <p className="mt-1 text-xs text-red-600">Request ID: {requestId}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={loading || !selectedProjectId || !selectedStyle || !currentImageUrl || currentImageUrl.startsWith("blob:")}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate AI Designs
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated Designs</CardTitle>
            <CardDescription>
              {generatedDesigns.length > 0
                ? "Your generated AI design"
                : "Generate designs to see them here"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lowConfidence && generatedDesigns.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
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
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Low Confidence Results
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        {lowConfidenceReason || "These results are low confidence—try a different style or prompt for stronger staging."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {generatedDesigns.length > 0 ? (
              <div className="space-y-4">
                <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-200">
                  {(() => {
                    const design = generatedDesigns[0]
                    const cleanUrl = design.imageUrl.split("?")[0]
                    
                    if (cleanUrl.includes("/uploads/generated_")) {
                      return (
                        <div className="flex items-center justify-center h-[70vh] bg-gray-50">
                          <p className="text-muted-foreground">Missing file (stale URL)</p>
                        </div>
                      )
                    }
                    
                    if (!cleanUrl.includes("/uploads/design-") && !cleanUrl.startsWith("http")) {
                      console.warn("[AI Studio] Warning: Generated design URL is not a design file:", cleanUrl)
                    }
                    
                    const displayUrl = `${cleanUrl}?v=${Date.now()}`
                    
                    return (
                      <img
                        key={displayUrl}
                        src={displayUrl}
                        alt="Generated AI design"
                        className="w-full max-h-[70vh] object-contain"
                        onError={(e) => {
                          console.error("Failed to load generated design image:", displayUrl)
                          const target = e.target as HTMLImageElement
                          target.style.display = "none"
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = '<div class="flex items-center justify-center h-[70vh] bg-gray-50"><p class="text-muted-foreground">Image missing</p></div>'
                          }
                          setGeneratedDesigns(generatedDesigns.filter((d) => d.id !== design.id))
                        }}
                      />
                    )
                  })()}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerate}
                    disabled={loading || !selectedProjectId || !selectedStyle || !currentImageUrl || currentImageUrl.startsWith("blob:")}
                    variant="outline"
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Regenerate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">Generate designs to see them here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
