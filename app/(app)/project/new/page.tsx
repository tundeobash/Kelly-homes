"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    roomType: "",
    length: "",
    width: "",
    height: "",
    image: null as File | null,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Upload image first - get persistent URL
      let imageUrl = ""
      if (formData.image) {
        const formDataUpload = new FormData()
        formDataUpload.append("file", formData.image)
        
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formDataUpload,
        })

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to upload image")
        }

        const uploadData = await uploadRes.json()
        imageUrl = uploadData.url

        // Validate we got a persistent URL, not a blob
        if (!imageUrl || imageUrl.startsWith("blob:")) {
          throw new Error("Invalid image URL received. Please try again.")
        }

        if (process.env.NODE_ENV === "development") {
          console.log("[PROJECT CREATE] Uploaded image URL:", imageUrl)
        }
      } else {
        throw new Error("Please select an image to upload")
      }

      // Clean up preview blob URL
      if (previewSrc) {
        URL.revokeObjectURL(previewSrc)
        setPreviewSrc(null)
      }

      // Create project with persistent URL
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          roomType: formData.roomType,
          length: parseFloat(formData.length),
          width: parseFloat(formData.width),
          height: parseFloat(formData.height),
          imageUrl, // Persistent URL from /api/upload
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to create project")
      }

      const project = await res.json()
      
      if (process.env.NODE_ENV === "development") {
        console.log("[PROJECT CREATE] Created project:", project.id)
        console.log("[PROJECT CREATE] Stored imageUrl:", project.imageUrl)
        // Verify no blob URL was stored
        if (project.imageUrl?.startsWith("blob:")) {
          console.error("[PROJECT CREATE] ERROR: Blob URL was stored in DB!")
        }
      }

      router.push(`/project/${project.id}`)
    } catch (error) {
      console.error("Error creating project:", error)
      alert(error instanceof Error ? error.message : "Failed to create project. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Project</CardTitle>
          <CardDescription>
            Upload a photo of your room and provide some details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                placeholder="e.g., Living Room Redesign"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Room Photo</Label>
              <Input
                id="image"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    // Check file type
                    const validTypes = ["image/jpeg", "image/png", "application/pdf"]
                    if (!validTypes.includes(file.type)) {
                      alert("Unsupported file type. Please upload JPG/PNG/PDF.")
                      e.target.value = ""
                      return
                    }
                    setFormData({ ...formData, image: file })
                    // Create preview blob URL (temporary, not persisted)
                    const preview = URL.createObjectURL(file)
                    setPreviewSrc(preview)
                  }
                }}
                required
              />
              <p className="text-xs text-muted-foreground">
                Accepted: JPG, JPEG, PNG, PDF
              </p>
              {formData.image && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Selected: {formData.image.name}
                  </p>
                  {previewSrc && (
                    <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                      <img
                        src={previewSrc}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomType">Room Type</Label>
              <Select
                value={formData.roomType}
                onValueChange={(value) =>
                  setFormData({ ...formData, roomType: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="living room">Living Room</SelectItem>
                  <SelectItem value="bedroom">Bedroom</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="dining room">Dining Room</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="length">Length (ft)</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  value={formData.length}
                  onChange={(e) =>
                    setFormData({ ...formData, length: e.target.value })
                  }
                  required
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width">Width (ft)</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  value={formData.width}
                  onChange={(e) =>
                    setFormData({ ...formData, width: e.target.value })
                  }
                  required
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (ft)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  value={formData.height}
                  onChange={(e) =>
                    setFormData({ ...formData, height: e.target.value })
                  }
                  required
                  min="1"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

