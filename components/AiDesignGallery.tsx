// TODO: Replace placeholder restored after recovery
"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface AiDesignImage {
  id: string
  imageUrl: string
  style?: string
  budgetRange?: string
  createdAt?: string
}

interface AiDesignGalleryProps {
  projectId: string
  aiDesigns: AiDesignImage[]
  selectedAiDesignId?: string
  onSelectDesign?: (designId: string) => void
}

export default function AiDesignGallery({
  projectId,
  aiDesigns,
  selectedAiDesignId,
  onSelectDesign,
}: AiDesignGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set())

  // Filter out stale /uploads/generated_*.png URLs and failed images
  const validDesigns = aiDesigns.filter((design) => {
    if (!design.imageUrl) return false
    // Check clean URL (without query params)
    const cleanUrl = design.imageUrl.split("?")[0]
    if (cleanUrl.includes("/uploads/generated_")) return false
    // Only allow /uploads/design-*.png files (or remote URLs)
    if (cleanUrl.startsWith("/uploads/") && !cleanUrl.includes("/uploads/design-")) {
      return false
    }
    if (failedImageUrls.has(cleanUrl)) return false
    return true
  })

  if (!validDesigns || validDesigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">No AI designs found</p>
      </div>
    )
  }

  const handleImageClick = (index: number) => {
    setSelectedIndex(index)
    setIsOpen(true)
  }

  const handlePrev = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + validDesigns.length) % validDesigns.length)
    }
  }

  const handleNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % validDesigns.length)
    }
  }

  const handleImageError = (imageUrl: string) => {
    // Store clean URL (without query params) to track failures
    const cleanUrl = imageUrl.split("?")[0]
    console.error("Failed to load design image:", cleanUrl)
    setFailedImageUrls((prev) => new Set(prev).add(cleanUrl))
  }

  const getImageUrlWithCacheBuster = (imageUrl: string) => {
    // Always add fresh cache buster (remove existing query params first)
    const cleanUrl = imageUrl.split("?")[0]
    return `${cleanUrl}?v=${Date.now()}`
  }

  const handleSelectDesign = async (designId: string) => {
    if (onSelectDesign) {
      onSelectDesign(designId)
    } else {
      // Default: update via API
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedAiDesignId: designId }),
        })
        // Optionally refresh the page or update state
        window.location.reload()
      } catch (error) {
        console.error("Failed to select design:", error)
      }
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {validDesigns.map((design, index) => {
          const cleanUrl = design.imageUrl.split("?")[0]
          const displayUrl = getImageUrlWithCacheBuster(design.imageUrl)
          
          return (
            <div
              key={design.id}
              className="relative aspect-square cursor-pointer group"
              onClick={() => handleImageClick(index)}
            >
              {failedImageUrls.has(cleanUrl) ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed">
                  <p className="text-xs text-muted-foreground text-center px-2">Image missing</p>
                </div>
              ) : (
                <Image
                  src={displayUrl}
                  alt={design.style || `AI Design ${index + 1}`}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  onError={() => handleImageError(cleanUrl)}
                />
              )}
              {selectedAiDesignId === design.id && (
                <div className="absolute inset-0 border-2 border-primary rounded-lg" />
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>AI Design</DialogTitle>
            <DialogDescription>
              {selectedIndex !== null && validDesigns[selectedIndex]?.style
                ? `Style: ${validDesigns[selectedIndex].style}`
                : "View AI-generated design"}
            </DialogDescription>
          </DialogHeader>
          <div className="relative p-6 pt-4">
            {selectedIndex !== null && validDesigns[selectedIndex] && (
              <>
                <div className="relative w-full h-[70vh] bg-gray-50 rounded-lg overflow-hidden">
                  {(() => {
                    const design = validDesigns[selectedIndex]
                    const cleanUrl = design.imageUrl.split("?")[0]
                    
                    if (failedImageUrls.has(cleanUrl) || cleanUrl.includes("/uploads/generated_")) {
                      return (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-muted-foreground">Image missing</p>
                        </div>
                      )
                    }
                    
                    // Ensure we're using the design's imageUrl (generated), not project imageUrl
                    if (!cleanUrl.includes("/uploads/design-") && !cleanUrl.startsWith("http")) {
                      console.warn("[AiDesignGallery] Warning: Design URL is not a design file:", cleanUrl)
                    }
                    
                    return (
                      <Image
                        key={getImageUrlWithCacheBuster(design.imageUrl)} // Force re-render with fresh cache buster
                        src={getImageUrlWithCacheBuster(design.imageUrl)}
                        alt="AI Design"
                        fill
                        className="object-contain"
                        sizes="(max-width: 1920px) 100vw, 1920px"
                        onError={() => handleImageError(cleanUrl)}
                      />
                    )
                  })()}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrev}
                    disabled={validDesigns.length <= 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedIndex + 1} of {validDesigns.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={validDesigns.length <= 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                {selectedAiDesignId !== validDesigns[selectedIndex].id && (
                  <Button
                    className="w-full mt-4"
                    onClick={() => handleSelectDesign(validDesigns[selectedIndex].id)}
                  >
                    Set as Selected
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
