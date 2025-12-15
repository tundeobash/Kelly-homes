"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// Using simple HTML5 canvas version to avoid Konva SSR issues
// TODO: Replace with Konva or AR SDK when ready
import RoomPreview from "./RoomPreviewSimple"
import RoomPhotoViewer from "./RoomPhotoViewer"
import Link from "next/link"
import { Sparkles, ShoppingCart } from "lucide-react"

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
  const [loading, setLoading] = useState(false)
  const [selectedDesigner, setSelectedDesigner] = useState<string>("")
  const [recommendations, setRecommendations] = useState(project.recommendations)

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
                <CardTitle>Room Photo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                  <RoomPhotoViewer
                    imageUrl={project.imageUrl}
                    alt={project.name}
                    className="w-full h-full"
                  />
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
                    roomImage={project.imageUrl}
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

