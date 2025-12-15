"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import RoomPhotoViewer from "@/components/RoomPhotoViewer"

interface DesignerProfileClientProps {
  designer: {
    id: string
    name: string
    bio?: string | null
    style: string
    imageUrl?: string | null
    projects: Array<{
      id: string
      name: string
      imageUrl: string
      roomType: string
    }>
  }
  initials: string
}

export default function DesignerProfileClient({
  designer,
  initials,
}: DesignerProfileClientProps) {
  const [isFollowing, setIsFollowing] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const followed = JSON.parse(
        localStorage.getItem("kellyhomes_followed_designers") || "[]"
      )
      setIsFollowing(followed.includes(designer.id))
    }
  }, [designer.id])

  const handleFollow = () => {
    if (typeof window !== "undefined") {
      const followed = JSON.parse(
        localStorage.getItem("kellyhomes_followed_designers") || "[]"
      )
      const newFollowed = isFollowing
        ? followed.filter((id: string) => id !== designer.id)
        : [...followed, designer.id]
      localStorage.setItem("kellyhomes_followed_designers", JSON.stringify(newFollowed))
      setIsFollowing(!isFollowing)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold">Kelly Homes</h1>
          </Link>
          <div className="flex gap-4">
            <Link href="/styles">
              <Button variant="ghost">Styles</Button>
            </Link>
            <Link href="/catalog">
              <Button variant="ghost">Catalog</Button>
            </Link>
            <Link href="/designers">
              <Button variant="ghost">Designers</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {designer.imageUrl ? (
                <Avatar className="h-24 w-24">
                  <AvatarImage src={designer.imageUrl} />
                  <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="h-24 w-24">
                  <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-bold mb-2">{designer.name}</h2>
                <p className="text-muted-foreground mb-4">
                  {designer.bio || `${designer.style} style interior designer`}
                </p>
                <div className="flex gap-6 justify-center md:justify-start mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{designer.projects.length}</div>
                    <div className="text-sm text-muted-foreground">Projects</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">0</div>
                    <div className="text-sm text-muted-foreground">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">0</div>
                    <div className="text-sm text-muted-foreground">Following</div>
                  </div>
                </div>
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  onClick={handleFollow}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        <div>
          <h3 className="text-2xl font-bold mb-4">Projects</h3>
          {designer.projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No projects yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {designer.projects.map((project) => (
                <Card key={project.id} className="hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-gray-200 rounded-t-lg overflow-hidden">
                    <RoomPhotoViewer
                      imageUrl={project.imageUrl}
                      alt={project.name}
                      className="w-full h-full"
                    />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription>{project.roomType}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

