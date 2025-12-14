"use client"

import { useEffect, useRef, useState } from "react"

interface RoomPreviewProps {
  roomImage: string
  items: Array<{
    id: string
    furnitureItem: {
      id: string
      name: string
      imageUrl: string
      dimensions: { length: number; width: number; height: number }
    }
    positionX: number | null
    positionY: number | null
    rotation: number | null
  }>
}

// TODO: Replace with AR SDK (e.g., AR.js, 8th Wall, or WebXR)
// This is a simple 2D canvas-based preview - can be upgraded to Konva or full AR
export default function RoomPreviewSimple({ roomImage, items }: RoomPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [roomImg, setRoomImg] = useState<HTMLImageElement | null>(null)
  const [furnitureImages, setFurnitureImages] = useState<Map<string, HTMLImageElement>>(new Map())

  useEffect(() => {
    setMounted(true)
    
    // Load room image
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.src = roomImage
    img.onload = () => setRoomImg(img)
    
    // Load furniture images
    items.forEach((item) => {
      const img = new window.Image()
      img.crossOrigin = "anonymous"
      img.src = item.furnitureItem.imageUrl
      img.onload = () => {
        setFurnitureImages((prev) => new Map(prev).set(item.id, img))
      }
    })
  }, [roomImage, items])

  useEffect(() => {
    if (!mounted || !canvasRef.current || !roomImg) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    if (containerRef.current) {
      canvas.width = containerRef.current.offsetWidth
      canvas.height = containerRef.current.offsetHeight
    }

    // Draw room image
    ctx.drawImage(roomImg, 0, 0, canvas.width, canvas.height)

    // Scale dimensions to fit canvas
    const scaleFactor = Math.min(
      canvas.width / 10, // Assuming room is 10ft wide
      canvas.height / 8 // Assuming room is 8ft long
    )

    // Draw furniture items
    items.forEach((item) => {
      const furnitureImg = furnitureImages.get(item.id)
      if (!furnitureImg) return

      const dims = item.furnitureItem.dimensions as {
        length: number
        width: number
        height: number
      }

      const x = (item.positionX || 0.5) * canvas.width - (dims.length * scaleFactor) / 2
      const y = (item.positionY || 0.5) * canvas.height - (dims.width * scaleFactor) / 2
      const width = dims.length * scaleFactor
      const height = dims.width * scaleFactor

      // Draw with semi-transparency
      ctx.save()
      ctx.globalAlpha = 0.8
      ctx.shadowBlur = 10
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
      ctx.drawImage(furnitureImg, x, y, width, height)
      ctx.restore()
    })
  }, [mounted, roomImg, furnitureImages, items])

  if (!mounted) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded flex items-center justify-center">
        <p className="text-muted-foreground">Loading preview...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded flex items-center justify-center">
        <p className="text-muted-foreground">No furniture items to display</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full aspect-video bg-gray-100 rounded">
      <canvas ref={canvasRef} className="w-full h-full rounded" />
    </div>
  )
}

