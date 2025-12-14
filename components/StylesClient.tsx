"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { designStyles, type DesignStyle } from "@/lib/mock/styles"
import { Check } from "lucide-react"

interface StylesClientProps {
  styles: DesignStyle[]
  userPreferredStyles: string[]
  projectId?: string
}

export default function StylesClient({
  styles,
  userPreferredStyles,
  projectId,
}: StylesClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState<string | null>(null)

  const filteredStyles = styles.filter((style) =>
    style.name.toLowerCase().includes(search.toLowerCase()) ||
    style.description.toLowerCase().includes(search.toLowerCase()) ||
    style.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
  )

  const handleSelectStyle = async (styleId: string) => {
    setLoading(styleId)
    try {
      // Update user preferences
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredStyles: [...userPreferredStyles, styleId],
        }),
      })

      if (res.ok) {
        // If projectId is provided, update project
        if (projectId) {
          await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ styleId }),
          })
          router.push(`/project/${projectId}`)
        } else {
          // Store in localStorage as fallback
          if (typeof window !== "undefined") {
            localStorage.setItem("selectedStyle", styleId)
          }
          router.refresh()
        }
      }
    } catch (error) {
      console.error("Error selecting style:", error)
      // Fallback to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("selectedStyle", styleId)
      }
    } finally {
      setLoading(null)
    }
  }

  const getBudgetColor = (level: string) => {
    switch (level) {
      case "Low":
        return "bg-green-100 text-green-800"
      case "Mid":
        return "bg-yellow-100 text-yellow-800"
      case "High":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Input
          placeholder="Search styles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredStyles.map((style) => {
          const isSelected = userPreferredStyles.includes(style.id)
          return (
            <Card key={style.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <CardTitle className="text-lg">{style.name}</CardTitle>
                  <Badge className={getBudgetColor(style.budgetLevel)}>
                    {style.budgetLevel}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {style.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {style.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button
                  className="w-full"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => handleSelectStyle(style.id)}
                  disabled={loading === style.id}
                >
                  {loading === style.id ? (
                    "Selecting..."
                  ) : isSelected ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Selected
                    </>
                  ) : (
                    "Select"
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

