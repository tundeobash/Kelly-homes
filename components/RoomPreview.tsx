"use client"

import { useEffect, useRef, useState } from "react"
import { Stage, Layer, Image, Group } from "@/components/KonvaCanvasClient"

// TODO: Replace with AR SDK (e.g., AR.js, 8th Wall, or WebXR)
// This is a 2.5D canvas-based preview - can be upgraded to full AR
function FurniturePlaceholder({
  x,
  y,
  width,
  height,
  imageUrl,
  name,
}: {
  x: number
  y: number
  width: number
  height: number
  imageUrl: string
  name: string
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.src = imageUrl
    img.onload = () => setImage(img)
  }, [imageUrl])

  if (!image) {
    return null
  }

  return (
    <Group x={x} y={y}>
      <Image
        image={image}
        width={width}
        height={height}
        opacity={0.8}
        shadowBlur={10}
        shadowOpacity={0.3}
      />
    </Group>
  )
}

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

export default function RoomPreview({ roomImage, items }: RoomPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 600, height: 400 })
  const [mounted, setMounted] = useState(false)
  const [roomImg, setRoomImg] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    setMounted(true)
    
    // Load room image
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.src = roomImage
    img.onload = () => setRoomImg(img)
    
    if (containerRef.current) {
      setContainerSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      })
    }
  }, [roomImage])

  if (!mounted) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded flex items-center justify-center">
        <p className="text-muted-foreground">Loading preview...</p>
      </div>
    )
  }

  // Scale dimensions to fit canvas
  const scaleFactor = Math.min(
    containerSize.width / 10, // Assuming room is 10ft wide
    containerSize.height / 8 // Assuming room is 8ft long
  )

  if (items.length === 0) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded flex items-center justify-center">
        <p className="text-muted-foreground">No furniture items to display</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full aspect-video bg-gray-100 rounded">
      <Stage width={containerSize.width} height={containerSize.height}>
        <Layer>
          {roomImg && (
            <Image
              image={roomImg}
              width={containerSize.width}
              height={containerSize.height}
            />
          )}
          {items.map((item) => {
            const dims = item.furnitureItem.dimensions as {
              length: number
              width: number
              height: number
            }
            const x =
              (item.positionX || 0.5) * containerSize.width -
              (dims.length * scaleFactor) / 2
            const y =
              (item.positionY || 0.5) * containerSize.height -
              (dims.width * scaleFactor) / 2

            return (
              <FurniturePlaceholder
                key={item.id}
                x={x}
                y={y}
                width={dims.length * scaleFactor}
                height={dims.width * scaleFactor}
                imageUrl={item.furnitureItem.imageUrl}
                name={item.furnitureItem.name}
              />
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}

