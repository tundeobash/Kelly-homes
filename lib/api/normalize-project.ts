import { existsSync } from "fs"
import { join } from "path"

// TODO: Placeholder restored after recovery
export interface AiDesignImage {
  id: string
  imageUrl: string
  style?: string
  budgetRange?: string
  createdAt?: string
}

export interface NormalizedProject {
  id: string
  name: string
  imageUrl: string | null
  roomType: string
  selectedAiDesignId: string | null
  aiDesigns: AiDesignImage[]
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

/**
 * Check if an image file exists on disk
 */
function imageFileExists(imageUrl: string): boolean {
  // Only check local /uploads/ and /images/ paths
  if (!imageUrl || typeof imageUrl !== "string") {
    return false
  }
  
  // Remove query params for file check
  const cleanUrl = imageUrl.split("?")[0]
  
  if (cleanUrl.startsWith("/uploads/") || cleanUrl.startsWith("/images/")) {
    const filePath = join(process.cwd(), "public", cleanUrl)
    return existsSync(filePath)
  }
  
  // For remote URLs, assume they exist (can't check server-side)
  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
    return true
  }
  
  return false
}

export function normalizeProject(project: any): NormalizedProject {
  const aiDesignsJson = (project.aiDesignsJson || []) as any[]

  // Filter out designs with missing id or imageUrl
  // Also filter out /uploads/generated_*.png (stale files) and verify file existence
  const validAiDesigns: AiDesignImage[] = aiDesignsJson
    .map((d: any) => ({
      id: d.id,
      imageUrl: d.imageUrl,
      style: d.style,
      budgetRange: d.budgetRange,
      createdAt: d.createdAt,
    }))
    .filter((d: AiDesignImage) => {
      // Must have id and imageUrl
      if (!d.id || !d.imageUrl) {
        return false
      }
      
      // Filter out stale /uploads/generated_*.png files
      if (d.imageUrl.includes("/uploads/generated_")) {
        return false
      }
      
      // Prefer /uploads/design-*.png files
      // Verify file exists on disk for local paths
      if (d.imageUrl.startsWith("/uploads/") || d.imageUrl.startsWith("/images/")) {
        return imageFileExists(d.imageUrl)
      }
      
      // Allow remote URLs (can't verify server-side)
      return true
    })

  let selectedAiDesignId = project.selectedAiDesignId || null
  // Ensure selectedAiDesignId actually points to an existing design
  if (selectedAiDesignId && !validAiDesigns.some(d => d.id === selectedAiDesignId)) {
    selectedAiDesignId = validAiDesigns.length > 0 ? validAiDesigns[0].id : null
  } else if (!selectedAiDesignId && validAiDesigns.length > 0) {
    // If no selected ID, but designs exist, select the first one
    selectedAiDesignId = validAiDesigns[0].id
  }

  let coverImageUrl: string | null = project.imageUrl || null
  if (selectedAiDesignId) {
    const selectedDesign = validAiDesigns.find(d => d.id === selectedAiDesignId)
    if (selectedDesign) {
      coverImageUrl = selectedDesign.imageUrl
    }
  } else if (validAiDesigns.length > 0) {
    coverImageUrl = validAiDesigns[0].imageUrl
  }

  return {
    id: project.id,
    name: project.name,
    imageUrl: project.imageUrl,
    roomType: project.roomType,
    selectedAiDesignId: selectedAiDesignId,
    aiDesigns: validAiDesigns,
    lastAiSettings: project.lastAiSettings || null,
    coverImageUrl: coverImageUrl,
    createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
    updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : project.updatedAt,
  }
}
