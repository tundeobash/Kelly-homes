"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import RoomPhotoViewer from "./RoomPhotoViewer"
import RoomPhotoUploader from "./RoomPhotoUploader"
import { PlacedItem } from "./RoomPreviewWithOverlay"
import { catalog, CatalogItem } from "@/lib/catalog"
import Link from "next/link"
import { Sparkles, ShoppingCart, X } from "lucide-react"
import { useRouter } from "next/navigation"
import AiDesignGallery from "./AiDesignGallery"

const RoomPreviewWithOverlay = dynamic(() => import("./RoomPreviewWithOverlay"), { ssr: false })

interface ProjectViewProps {
  project: any
  userPreferences: string[]
  userBudget?: number | null
  designers: Array<{ id: string; name: string; style: string }>
}

export default function ProjectView({
  project,
  userPreferences,
  userBudget,
  designers,
}: ProjectViewProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedDesigner, setSelectedDesigner] = useState<string>("")
  const [recommendedSkus, setRecommendedSkus] = useState<CatalogItem[]>([])
  const [currentImageUrl, setCurrentImageUrl] = useState(project.imageUrl || "")
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  // Use safe accessor for designs: project.designs ?? project.aiDesigns ?? []
  // normalizeProject returns aiDesigns, but API might return designs
  const initialDesigns = (project.designs ?? project.aiDesigns ?? []) as any[]
  const [aiDesigns, setAiDesigns] = useState(initialDesigns)
  const [selectedAiDesignId, setSelectedAiDesignId] = useState(project.selectedAiDesignId || null)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)

  // Update AI designs when project changes
  useEffect(() => {
    // Use safe accessor for designs (normalizeProject returns aiDesigns, but API might return designs)
    const designs = (project.designs ?? project.aiDesigns ?? []) as any[]
    setAiDesigns(designs)
    
    if (project.selectedAiDesignId !== undefined) {
      setSelectedAiDesignId(project.selectedAiDesignId)
    }
    
    // Compute cover image: selected design > first design > room image
    let cover: string | null = null
    if (project.selectedAiDesignId && designs.length > 0) {
      const selected = designs.find((d: any) => d.id === project.selectedAiDesignId)
      if (selected) cover = selected.imageUrl
    }
    if (!cover && designs.length > 0) {
      cover = designs[0].imageUrl
    }
    if (!cover) cover = project.imageUrl || null
    setCoverImageUrl(cover)
    
    // Debug logging
    if (process.env.NODE_ENV === "development") {
      console.log("[ProjectView] Project data:", {
        projectId: project.id,
        projectImageUrl: project.imageUrl?.substring(0, 50),
        designsCount: designs.length,
        firstDesignUrl: designs[0]?.imageUrl?.substring(0, 50),
        selectedAiDesignId: project.selectedAiDesignId,
      })
    }
  }, [project])

  useEffect(() => {
    if (project.id) {
      const storageKey = `project:${project.id}:scene`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const data = JSON.parse(saved || "{}")
          if (data.placedItems && Array.isArray(data.placedItems)) {
            setPlacedItems(data.placedItems)
            if (data.selectedItemId) {
              setSelectedItemId(data.selectedItemId)
            }
          }
        } catch (e) {
          console.error("Failed to load scene:", e)
        }
      }
    }
  }, [project.id])

  useEffect(() => {
    if (project.id && placedItems.length >= 0) {
      const storageKey = `project:${project.id}:scene`
      const data = {
        placedItems,
        selectedItemId,
      }
      localStorage.setItem(storageKey, JSON.stringify(data))
    }
  }, [placedItems, selectedItemId, project.id])

  const handleAddItem = (skuId: string) => {
    const maxZ = placedItems.length > 0 ? Math.max(...placedItems.map((i) => i.zIndex)) : 0
    const defaultX = 300
    // Default to floor level (lower 35% of image, assuming 400px height)
    const defaultFloorY = 400 * 0.65
    const defaultY = defaultFloorY

    const newItem: PlacedItem = {
      id: crypto.randomUUID(),
      skuId,
      x: defaultX,
      y: defaultY,
      scale: 40,
      opacity: 0.9,
      roll: 0,
      yaw: 0,
      pitch: 0,
      perspective: 1000,
      zIndex: maxZ + 1,
      anchorX: defaultX / 600, // Normalized (assuming 600px width)
      anchorY: defaultY / 400, // Normalized (assuming 400px height)
      floorY: defaultFloorY,
      depth: 0.65, // Default depth for floor level
    }

    setPlacedItems([...placedItems, newItem])
    setSelectedItemId(newItem.id)
  }

  const handleDeleteItem = (id: string) => {
    setPlacedItems(placedItems.filter((item) => item.id !== id))
    if (selectedItemId === id) {
      setSelectedItemId(null)
    }
  }

  const handleClearAll = () => {
    setPlacedItems([])
    setSelectedItemId(null)
  }

  const handleGenerateRecommendation = async () => {
    setLoading(true)
    try {
      const { generateSkuRecommendations } = await import("@/lib/recommendations")
      const recommendedSkus = await generateSkuRecommendations({
        projectId: project.id,
        style: project.style,
        roomType: project.roomType,
      })
      
      // Create placed items from recommended SKUs
      const newPlacedItems = recommendedSkus.map((sku, index) => {
        // Distribute items across lower half of room (floor area)
        const containerWidth = 600 // Approximate container width
        const containerHeight = 400 // Approximate container height
        const floorStartY = containerHeight * 0.5 // Start from middle (floor area)
        
        // Calculate positions to avoid stacking
        const itemsPerRow = 3
        const row = Math.floor(index / itemsPerRow)
        const col = index % itemsPerRow
        const spacingX = containerWidth / (itemsPerRow + 1)
        const spacingY = (containerHeight - floorStartY) / 3
        
        const x = spacingX * (col + 1) - 50 // Center offset
        const y = floorStartY + spacingY * row + 20
        
        const maxZ = placedItems.length > 0 ? Math.max(...placedItems.map((i) => i.zIndex)) : 0
        
        return {
          id: crypto.randomUUID(),
          skuId: sku.skuId,
          x,
          y,
          scale: 40,
          opacity: 0.9,
          roll: 0,
          yaw: 0,
          pitch: 0,
          perspective: 1000,
          zIndex: maxZ + index + 1,
        }
      })
      
      setPlacedItems([...placedItems, ...newPlacedItems])
      setSelectedItemId(newPlacedItems[0]?.id || null)
      
      // Store recommended SKUs for display - convert to CatalogItem format
      const catalogItems: CatalogItem[] = recommendedSkus.map((sku) => {
        const catalogItem = Object.values(catalog).flat().find((item) => item.id === sku.skuId)
        if (catalogItem) return catalogItem
        // Fallback if not found in catalog
        return {
          id: sku.skuId,
          name: sku.name,
          category: sku.category,
          imagePath: sku.imageUrl,
          price: sku.price,
          seller: sku.seller || "Kelly Homes",
          dimensions: { w: 0, d: 0, h: 0 },
        } as CatalogItem
      })
      setRecommendedSkus(catalogItems)
    } catch (error) {
      console.error("Error generating recommendation:", error)
    } finally {
      setLoading(false)
    }
  }


  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">{project.name}</h2>
        <p className="text-muted-foreground">
          {project.roomType} • {project.length}ft × {project.width}ft ×{" "}
          {project.height}ft
        </p>
      </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <RoomPhotoUploader
              projectId={project.id}
              currentImageUrl={currentImageUrl}
              onImageUrlChange={setCurrentImageUrl}
              showTitle={true}
            />

            <Card>
              <CardHeader>
                <CardTitle>Room Layout Preview</CardTitle>
                <CardDescription>
                  Click a SKU below to see it in your room
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RoomPreviewWithOverlay
                  roomImage={currentImageUrl || ""}
                  projectId={project.id}
                  placedItems={placedItems}
                  selectedItemId={selectedItemId}
                  onPlacedItemsChange={setPlacedItems}
                  onSelectedItemChange={setSelectedItemId}
                  onAddItem={handleAddItem}
                  onDeleteItem={handleDeleteItem}
                  onClearAll={handleClearAll}
                />
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>SKU Catalog</CardTitle>
                <CardDescription>
                  Click a SKU to add it to your room
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {catalog.map((sku) => (
                    <button
                      key={sku.id}
                      onClick={() => handleAddItem(sku.id)}
                      className="p-3 border rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="aspect-square bg-gray-100 rounded mb-2 relative overflow-hidden">
                        <img
                          src={sku.imagePath}
                          alt={sku.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-sm font-medium truncate">{sku.name}</p>
                      <p className="text-xs text-muted-foreground">{sku.category}</p>
                      <p className="text-sm font-bold mt-1">${sku.price.toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {placedItems.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Placed Items ({placedItems.length})</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleClearAll}>
                      Clear All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {placedItems.map((item) => {
                      const sku = catalog.find((s) => s.id === item.skuId)
                      if (!sku) return null
                      const instanceNumber = placedItems.filter((i) => i.skuId === item.skuId).indexOf(item) + 1
                      const totalInstances = placedItems.filter((i) => i.skuId === item.skuId).length
                      const displayName = totalInstances > 1 ? `${sku.name} (${instanceNumber})` : sku.name

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer transition-colors ${
                            selectedItemId === item.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                          }`}
                          onClick={() => setSelectedItemId(item.id)}
                        >
                          <span className="text-sm font-medium">{displayName}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteItem(item.id)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Generate Recommendations</CardTitle>
                <CardDescription>
                  Get AI-powered furniture suggestions for your room
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Apply Designer Style (Optional)
                  </label>
                  <Select
                    value={selectedDesigner}
                    onValueChange={setSelectedDesigner}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a designer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {designers.map((designer) => (
                        <SelectItem key={designer.id} value={designer.id}>
                          {designer.name} - {designer.style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleGenerateRecommendation}
                  disabled={loading}
                  className="w-full"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {loading ? "Generating..." : "Generate Recommendations"}
                </Button>
              </CardContent>
            </Card>

            {recommendedSkus.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recommended Items</CardTitle>
                  <CardDescription>
                    Total: ${recommendedSkus.reduce((sum, sku) => sum + sku.price, 0).toFixed(2)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recommendedSkus.map((sku) => (
                      <div
                        key={sku.id}
                        className="flex gap-4 p-4 border rounded-lg"
                      >
                        <img
                          src={sku.imagePath}
                          alt={sku.name}
                          className="w-24 h-24 object-cover rounded"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold">{sku.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {sku.seller || "Kelly Homes"}
                          </p>
                          <p className="text-lg font-bold mt-2">
                            ${sku.price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <Button
                      className="w-full mt-4"
                      onClick={async () => {
                        setLoading(true)
                        try {
                          const results = await Promise.all(
                            recommendedSkus.map(async (sku) => {
                              const res = await fetch("/api/cart", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  skuId: sku.id,
                                  name: sku.name,
                                  price: sku.price,
                                  imageUrl: sku.imagePath,
                                  category: sku.category.toLowerCase(),
                                  seller: sku.seller || "Kelly Homes",
                                }),
                              })
                              return res.ok
                            })
                          )
                          
                          if (results.every((r) => r)) {
                            alert("All items added to cart!")
                            router.push("/checkout")
                          } else {
                            alert("Some items could not be added. Please try again.")
                          }
                        } catch (error) {
                          console.error("Error adding to cart:", error)
                          alert("Failed to add items to cart")
                        } finally {
                          setLoading(false)
                        }
                      }}
                      disabled={loading}
                    >
                      {loading ? "Adding..." : "Add All to Cart"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected AI Design Preview */}
            {selectedAiDesignId && aiDesigns.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Selected AI Design</CardTitle>
                  <CardDescription>
                    Your chosen design for this project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {coverImageUrl && (
                    <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary">
                      <img
                        src={coverImageUrl}
                        alt="Selected AI design"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {selectedAiDesignId && (
                    <Button
                      onClick={() => router.push(`/project/${project.id}/shop-ai`)}
                      className="w-full mt-4"
                    >
                      Shop this AI look
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* AI Design Gallery */}
            {aiDesigns && Array.isArray(aiDesigns) && aiDesigns.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>AI Design Options</CardTitle>
                      <CardDescription>
                        Select an AI-generated design or shop this look
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/galleries")}
                    >
                      View Gallery
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <AiDesignGallery
                    projectId={project.id}
                    aiDesigns={aiDesigns
                      .filter((d: any) => d.imageUrl && !d.imageUrl.includes("/uploads/generated_"))
                      .map((d: any) => {
                        // Add cache buster
                        const bust = (url: string) => url ? `${url.split("?")[0]}?v=${Date.now()}` : url
                        return {
                          id: d.id,
                          imageUrl: bust(d.imageUrl),
                          style: d.style,
                          budgetRange: d.budgetRange,
                          createdAt: d.createdAt,
                        }
                      })}
                    selectedAiDesignId={selectedAiDesignId || undefined}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
    </>
  )
}

