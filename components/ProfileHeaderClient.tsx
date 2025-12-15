"use client"

import { useState, useEffect, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Camera, Upload, X } from "lucide-react"

interface ProfileHeaderClientProps {
  profile: {
    id: string
    name?: string | null
    image?: string | null
  }
  initials: string
  isOwnProfile: boolean
}

export default function ProfileHeaderClient({
  profile,
  initials,
  isOwnProfile,
}: ProfileHeaderClientProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string>("")
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPhoto = localStorage.getItem("kellyhomes_profile_photo")
      if (savedPhoto) {
        setPhotoUrl(savedPhoto)
      } else if (profile.image) {
        setPhotoUrl(profile.image)
      }
    }
  }, [profile.image])

  const validateFile = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!validTypes.includes(file.type)) {
      setError("Unsupported file type. Please upload JPG/PNG/WEBP.")
      return false
    }
    setError("")
    return true
  }

  const handleFileSelect = (file: File) => {
    if (!validateFile(file)) {
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      setPhotoUrl(dataUrl)
      if (typeof window !== "undefined") {
        localStorage.setItem("kellyhomes_profile_photo", dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleUploadClick = () => {
    uploadInputRef.current?.click()
  }

  const handleCameraClick = () => {
    cameraInputRef.current?.click()
  }

  const handleRemovePhoto = () => {
    setPhotoUrl(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem("kellyhomes_profile_photo")
    }
  }

  const displayImage = photoUrl || profile.image || undefined

  return (
    <div className="flex flex-col items-center md:items-start gap-4">
      <Avatar className="h-24 w-24">
        <AvatarImage src={displayImage} />
        <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
      </Avatar>

      {isOwnProfile && (
        <div className="flex flex-col gap-2 items-center md:items-start">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3"
              onClick={handleUploadClick}
            >
              <Upload className="h-3 w-3 mr-1" />
              Upload Photo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3"
              onClick={handleCameraClick}
            >
              <Camera className="h-3 w-3 mr-1" />
              Take Photo
            </Button>
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                handleFileSelect(file)
              }
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                handleFileSelect(file)
              }
            }}
          />
          {photoUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={handleRemovePhoto}
            >
              <X className="h-3 w-3 mr-1" />
              Remove photo
            </Button>
          )}
          {error && (
            <p className="text-xs text-destructive text-center md:text-left">{error}</p>
          )}
          <p className="text-xs text-muted-foreground text-center md:text-left">Accepted: JPG, PNG, WEBP</p>
        </div>
      )}
    </div>
  )
}

