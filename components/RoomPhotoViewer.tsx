"use client"

import { useState } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

interface RoomPhotoViewerProps {
  thumbnailUrl?: string
  imageUrl: string
  alt?: string
  className?: string
}

export default function RoomPhotoViewer({
  thumbnailUrl,
  imageUrl,
  alt = "Room photo",
  className = "",
}: RoomPhotoViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Handle missing or invalid imageUrl
  if (!imageUrl || imageUrl.trim() === "") {
    return (
      <div className={`bg-muted flex items-center justify-center rounded ${className}`}>
        <div className="text-center p-4">
          <p className="text-sm text-muted-foreground">No image</p>
          {process.env.NODE_ENV === "development" && (
            <p className="text-xs text-muted-foreground mt-1">Missing imageUrl</p>
          )}
        </div>
      </div>
    )
  }

  // Handle blob URLs - use regular img tag since next/image doesn't support blob URLs
  const isBlobUrl = imageUrl.startsWith("blob:")

  const displayUrl = thumbnailUrl || imageUrl

  if (process.env.NODE_ENV === "development") {
    console.log("[RoomPhotoViewer] Image URL:", imageUrl)
    console.log("[RoomPhotoViewer] Display URL:", displayUrl)
  }

  const handleImageClick = () => {
    setIsOpen(true)
    setImageError(false)
    setIsLoading(true)
  }

  const handleRetry = () => {
    setImageError(false)
    setIsLoading(true)
  }

  // Ensure we have a default responsive height if className doesn't provide one
  const containerClassName = className && className.trim() !== "" 
    ? className 
    : "w-full h-[360px] md:h-[420px]"

  return (
    <>
      {/* Thumbnail */}
      <div
        className={`relative cursor-pointer hover:opacity-90 transition-opacity ${containerClassName}`}
        onClick={handleImageClick}
      >
        <div className="relative w-full h-full overflow-hidden rounded-lg bg-muted">
          {isBlobUrl ? (
            <img
              src={imageUrl}
              alt={alt}
              className="w-full h-full object-contain object-center rounded-lg"
              onError={() => setImageError(true)}
            />
          ) : (
            <Image
              src={displayUrl}
              alt={alt}
              fill
              className="object-contain object-center rounded-lg"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onError={() => setImageError(true)}
            />
          )}
        </div>
      </div>

      {/* Modal/Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Room Photo</DialogTitle>
            <DialogDescription>{alt}</DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-4 flex items-center justify-center bg-gray-50 min-h-[400px] max-h-[80vh] overflow-auto">
            {imageError ? (
              <div className="flex flex-col items-center gap-4">
                <AlertCircle className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Image failed to load</p>
                {process.env.NODE_ENV === "development" && (
                  <p className="text-xs text-muted-foreground">URL: {imageUrl}</p>
                )}
                <Button onClick={handleRetry} variant="outline">
                  Retry
                </Button>
              </div>
            ) : (
              <div className="relative w-full h-full min-h-[400px] flex items-center justify-center">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                )}
                {isBlobUrl ? (
                  <img
                    src={imageUrl}
                    alt={alt}
                    className="max-w-full max-h-full object-contain rounded"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                      setImageError(true)
                      setIsLoading(false)
                    }}
                  />
                ) : (
                  <Image
                    src={imageUrl}
                    alt={alt}
                    fill
                    className="object-contain rounded"
                    sizes="(max-width: 1920px) 100vw, 1920px"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                      setImageError(true)
                      setIsLoading(false)
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

