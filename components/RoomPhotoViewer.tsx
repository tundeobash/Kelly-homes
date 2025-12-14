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

  const isBlobUrl = imageUrl.startsWith("blob:")
  const displayUrl = thumbnailUrl || imageUrl

  const handleImageClick = () => {
    setIsOpen(true)
    setImageError(false)
    setIsLoading(true)
  }

  const handleRetry = () => {
    setImageError(false)
    setIsLoading(true)
  }

  return (
    <>
      {/* Thumbnail */}
      <div
        className={`relative cursor-pointer hover:opacity-90 transition-opacity ${className}`}
        onClick={handleImageClick}
      >
        {isBlobUrl ? (
          <img
            src={displayUrl}
            alt={alt}
            className="w-full h-full object-cover rounded"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="relative w-full h-full">
            <Image
              src={displayUrl}
              alt={alt}
              fill
              className="object-cover rounded"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onError={() => setImageError(true)}
            />
          </div>
        )}
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
                <Button onClick={handleRetry} variant="outline">
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {isBlobUrl ? (
                  <img
                    src={imageUrl}
                    alt={alt}
                    className="max-w-full max-h-[80vh] object-contain rounded"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                      setImageError(true)
                      setIsLoading(false)
                    }}
                  />
                ) : (
                  <div className="relative w-full h-full min-h-[400px] flex items-center justify-center">
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-muted-foreground">Loading...</p>
                      </div>
                    )}
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
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

