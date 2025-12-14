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
      // Upload image first (mock - in production, use Cloudinary)
      let imageUrl = ""
      if (formData.image) {
        const formDataUpload = new FormData()
        formDataUpload.append("file", formData.image)
        
        // For MVP, we'll use a mock URL
        // TODO: Replace with Cloudinary upload
        imageUrl = URL.createObjectURL(formData.image)
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          roomType: formData.roomType,
          length: parseFloat(formData.length),
          width: parseFloat(formData.width),
          height: parseFloat(formData.height),
          imageUrl, // In production, this would be the Cloudinary URL
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to create project")
      }

      const project = await res.json()
      router.push(`/project/${project.id}`)
    } catch (error) {
      console.error("Error creating project:", error)
      alert("Failed to create project. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
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
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setFormData({ ...formData, image: file })
                    }
                  }}
                  required
                />
                {formData.image && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {formData.image.name}
                  </p>
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
    </div>
  )
}

