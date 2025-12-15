"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface DesignerCardProps {
  designer: {
    id: string
    name: string
    bio?: string | null
    style: string
    imageUrl?: string | null
  }
}

export default function DesignerCard({ designer }: DesignerCardProps) {
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

  const slug = designer.name.toLowerCase().replace(/\s+/g, "-")
  const initials = designer.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <Link href={`/designers/${slug}`}>
        {designer.imageUrl ? (
          <div className="aspect-square bg-gray-200 rounded-t-lg overflow-hidden">
            <img
              src={designer.imageUrl}
              alt={designer.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-square bg-gray-200 rounded-t-lg overflow-hidden flex items-center justify-center">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
          </div>
        )}
      </Link>
      <CardHeader>
        <Link href={`/designers/${slug}`}>
          <CardTitle className="hover:underline">{designer.name}</CardTitle>
        </Link>
        <CardDescription>{designer.style} Style</CardDescription>
      </CardHeader>
      <CardContent>
        {designer.bio && <p className="text-sm mb-4 line-clamp-2">{designer.bio}</p>}
        <Button
          className="w-full"
          variant={isFollowing ? "outline" : "default"}
          onClick={(e) => {
            e.preventDefault()
            handleFollow()
          }}
        >
          {isFollowing ? "Following" : "Follow"}
        </Button>
      </CardContent>
    </Card>
  )
}

