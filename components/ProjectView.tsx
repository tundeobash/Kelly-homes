"use client"

import { useState, useRef } from "react"
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
// Using simple HTML5 canvas version to avoid Konva SSR issues
// TODO: Replace with Konva or AR SDK when ready
import RoomPreview from "./RoomPreviewSimple"
import RoomPhotoViewer from "./RoomPhotoViewer"
import Link from "next/link"
import { Sparkles, ShoppingCart, Upload } from "lucide-react"
import { useRouter } from "next/navigation"

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
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedDesigner, setSelectedDesigner] = useState<string>("")
  const [recommendations, setRecommendations] = useState(project.recommendations)
  const [currentImageUrl, setCurrentImageUrl] = useState(project.imageUrl || "")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isBlobUrl = currentImageUrl.startsWith("blob:")

  const handleGenerateRecommendation = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stylePreference: userPreferences,
          budgetMax: userBudget,
          designerId: selectedDesigner && selectedDesigner !== "none" ? selectedDesigner : undefined,
        }),
      })

      if (res.ok) {
        const newRecommendation = await res.json()
        setRecommendations([newRecommendation, ...recommendations])
      }
    } catch (error) {
      console.error("Error generating recommendation:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if (!validTypes.includes(file.type)) {
      alert("Unsupported file type. Please upload JPG/PNG/WEBP/PDF.")
      return
    }

    setUploadingImage(true)

    try {
      // Upload image
      const formDataUpload = new FormData()
      formDataUpload.append("file", file)

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      })

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image")
      }

      const uploadData = await uploadRes.json()
      const newImageUrl = uploadData.url

      // Validate we got a persistent URL, not a blob
      if (!newImageUrl || newImageUrl.startsWith("blob:")) {
        throw new Error("Invalid image URL received. Please try again.")
      }

      // Update project with new image URL
      const updateRes = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: newImageUrl }),
      })

      if (!updateRes.ok) {
        const errorData = await updateRes.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to update project")
      }

      const updatedProject = await updateRes.json()
      
      if (process.env.NODE_ENV === "development") {
        console.log("[PROJECT UPDATE] Updated imageUrl:", updatedProject.imageUrl)
        // Verify no blob URL was stored
        if (updatedProject.imageUrl?.startsWith("blob:")) {
          console.error("[PROJECT UPDATE] ERROR: Blob URL was stored in DB!")
        }
      }

      setCurrentImageUrl(newImageUrl)
      router.refresh()
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("Failed to upload image. Please try again.")
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const latestRecommendation = recommendations[0]

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
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Room Photo</CardTitle>
                  {isBlobUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingImage ? "Uploading..." : "Re-upload Image"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                    <RoomPhotoViewer
                      imageUrl={currentImageUrl}
                      alt={project.name}
                      className="w-full h-full"
                    />
                  </div>
                  {isBlobUrl && (
                    <div className="space-y-2">
                      <Label htmlFor="image-upload">Upload New Image</Label>
                      <Input
                        ref={fileInputRef}
                        id="image-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground">
                        Accepted: JPG, PNG, WEBP, PDF
                      </p>
                    </div>
                  )}
                  {process.env.NODE_ENV === "development" && (
                    <p className="text-xs text-muted-foreground">
                      Image URL: {currentImageUrl || "missing"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {latestRecommendation && (
              <Card>
                <CardHeader>
                  <CardTitle>Layout Preview</CardTitle>
                  <CardDescription>
                    See how furniture fits in your room
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RoomPreview
                    roomImage={currentImageUrl || ""}
                    items={latestRecommendation.items}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <div>
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

            {latestRecommendation && (
              <Card>
                <CardHeader>
                  <CardTitle>Recommended Items</CardTitle>
                  <CardDescription>
                    Total: ${latestRecommendation.totalPrice.toFixed(2)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {latestRecommendation.items.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex gap-4 p-4 border rounded-lg"
                      >
                        <img
                          src={item.furnitureItem.imageUrl}
                          alt={item.furnitureItem.name}
                          className="w-24 h-24 object-cover rounded"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold">
                            {item.furnitureItem.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {item.furnitureItem.seller}
                          </p>
                          <p className="text-lg font-bold mt-2">
                            ${item.furnitureItem.price.toFixed(2)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={async () => {
                            await fetch("/api/cart", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                furnitureItemId: item.furnitureItem.id,
                              }),
                            })
                          }}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      className="w-full mt-4"
                      onClick={async () => {
                        for (const item of latestRecommendation.items) {
                          await fetch("/api/cart", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              furnitureItemId: item.furnitureItem.id,
                            }),
                          })
                        }
                        window.location.href = "/checkout"
                      }}
                    >
                      Add All to Cart
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
    </>
  )
}

