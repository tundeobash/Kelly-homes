"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import RoomPhotoViewer from "@/components/RoomPhotoViewer"
import { X } from "lucide-react"

interface ProjectCardProps {
  project: {
    id: string
    name: string
    roomType: string
    length: number
    width: number
    imageUrl: string | null
    recommendations: Array<{
      items: Array<any>
    }>
  }
  isOwnProfile: boolean
}

export default function ProjectCard({ project, isOwnProfile }: ProjectCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!isOwnProfile) {
      return
    }

    const confirmed = window.confirm("Delete this project?")
    if (!confirmed) {
      return
    }

    setIsDeleting(true)

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to delete project")
      }

      setIsDeleted(true)
      router.refresh()
    } catch (error) {
      console.error("Error deleting project:", error)
      alert("Failed to delete project. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  if (isDeleted) {
    return null
  }

  return (
    <div className="relative group">
      <Link href={`/project/${project.id}`}>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <div className="aspect-video bg-gray-200 rounded-t-lg overflow-hidden relative">
            <RoomPhotoViewer
              imageUrl={project.imageUrl || ""}
              alt={project.name}
              className="w-full h-full"
            />
            {isOwnProfile && (
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label="Delete project"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <CardHeader>
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <CardDescription>
              {project.roomType} • {project.length}ft × {project.width}ft
            </CardDescription>
          </CardHeader>
          <CardContent>
            {project.recommendations.length > 0 && project.recommendations[0]?.items && (
              <p className="text-sm text-muted-foreground">
                {project.recommendations[0].items.length} items recommended
              </p>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}

