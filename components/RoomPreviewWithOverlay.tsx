"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { catalog, CatalogItem } from "@/lib/catalog"
import { X, ArrowUp, ArrowDown, Trash2 } from "lucide-react"

const Stage = dynamic(() => import("react-konva").then((mod) => mod.Stage), { ssr: false })
const Layer = dynamic(() => import("react-konva").then((mod) => mod.Layer), { ssr: false })
const KonvaImage = dynamic(() => import("react-konva").then((mod) => mod.Image), { ssr: false })
const Group = dynamic(() => import("react-konva").then((mod) => mod.Group), { ssr: false })
const Rect = dynamic(() => import("react-konva").then((mod) => mod.Rect), { ssr: false })

export type PlacedItem = {
  id: string
  skuId: string
  x: number
  y: number
  scale: number
  opacity: number
  roll: number
  yaw: number
  pitch: number
  perspective: number
  zIndex: number
  anchorX?: number // Normalized anchor point (0-1)
  anchorY?: number // Normalized anchor point (0-1)
  floorY?: number // Y coordinate where item is anchored to floor
  depth?: number // Depth value at anchor point (0-1)
}

interface RoomPreviewWithOverlayProps {
  roomImage: string
  projectId?: string
  placedItems: PlacedItem[]
  selectedItemId: string | null
  onPlacedItemsChange: (items: PlacedItem[]) => void
  onSelectedItemChange: (id: string | null) => void
  onAddItem: (skuId: string) => void
  onDeleteItem: (id: string) => void
  onClearAll: () => void
}

export default function RoomPreviewWithOverlay({
  roomImage,
  projectId,
  placedItems,
  selectedItemId,
  onPlacedItemsChange,
  onSelectedItemChange,
  onAddItem,
  onDeleteItem,
  onClearAll,
}: RoomPreviewWithOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 600, height: 400 })
  const [mounted, setMounted] = useState(false)
  const [roomImg, setRoomImg] = useState<HTMLImageElement | null>(null)
  const [imageError, setImageError] = useState(false)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [imageLoadTrigger, setImageLoadTrigger] = useState(0)
  const itemImageCache = useRef<Map<string, HTMLImageElement>>(new Map())
  const [floorBoundary, setFloorBoundary] = useState<Array<{ x: number; y: number }> | null>(null)
  const [floorStartY, setFloorStartY] = useState<number | null>(null)
  const [depthMap, setDepthMap] = useState<number[][] | null>(null)
  const [snapToFloor, setSnapToFloor] = useState(true)

  const selectedItem = selectedItemId ? placedItems.find((item) => item.id === selectedItemId) : null
  const selectedSku = selectedItem ? catalog.find((s) => s.id === selectedItem.skuId) : null

  useEffect(() => {
    setMounted(true)

    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }

    updateSize()
    window.addEventListener("resize", updateSize)

    if (roomImage) {
      const img = new window.Image()
      img.crossOrigin = "anonymous"
      img.src = roomImage
      img.onload = () => {
        setRoomImg(img)
        setImageError(false)
        // Fetch depth map and floor boundary
        fetchDepthMap(roomImage)
      }
      img.onerror = () => {
        console.error("[RoomPreviewWithOverlay] Failed to load room image:", roomImage)
        setImageError(true)
      }
    }

    return () => {
      window.removeEventListener("resize", updateSize)
    }
  }, [roomImage])

  useEffect(() => {
    placedItems.forEach((item) => {
      const sku = catalog.find((s) => s.id === item.skuId)
      if (!sku) return

      const cacheKey = `${item.skuId}-${item.roll}`
      if (itemImageCache.current.has(cacheKey)) return

      const getImagePathForRotation = (sku: CatalogItem, rotation: number): string => {
        if (!sku.views) return sku.imagePath
        const normalizedRotation = ((rotation % 360) + 360) % 360
        if (normalizedRotation >= 315 || normalizedRotation < 45) {
          return sku.views.front || sku.imagePath
        } else if (normalizedRotation >= 45 && normalizedRotation < 135) {
          return sku.views.side || sku.imagePath
        } else if (normalizedRotation >= 135 && normalizedRotation < 225) {
          return sku.views.back || sku.imagePath
        } else {
          return sku.views.side || sku.imagePath
        }
      }

      const imagePath = getImagePathForRotation(sku, item.roll)
      const img = new window.Image()
      img.crossOrigin = "anonymous"
      img.src = imagePath
      img.onload = () => {
        itemImageCache.current.set(cacheKey, img)
        setImageLoadTrigger((prev) => prev + 1)
      }
    })
  }, [placedItems])

  // Fetch depth map and floor boundary
  const fetchDepthMap = async (imageUrl: string) => {
    try {
      const res = await fetch("/api/vision/depth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      })
      if (res.ok) {
        const data = await res.json()
        setDepthMap(data.depthMap)
        setFloorStartY(data.floorStartY)
        setFloorBoundary(data.floorBoundary)
      } else {
        // Fallback to default floor boundary (lower 35%)
        const defaultFloorY = Math.floor(containerSize.height * 0.65)
        setFloorStartY(defaultFloorY)
        setFloorBoundary([
          { x: 0, y: defaultFloorY },
          { x: containerSize.width, y: defaultFloorY },
          { x: containerSize.width, y: containerSize.height },
          { x: 0, y: containerSize.height },
        ])
      }
    } catch (error) {
      console.error("[RoomPreviewWithOverlay] Failed to fetch depth map:", error)
      // Fallback to default
      const defaultFloorY = Math.floor(containerSize.height * 0.65)
      setFloorStartY(defaultFloorY)
      setFloorBoundary([
        { x: 0, y: defaultFloorY },
        { x: containerSize.width, y: defaultFloorY },
        { x: containerSize.width, y: containerSize.height },
        { x: 0, y: containerSize.height },
      ])
    }
  }

  // Get floor Y at a given X coordinate
  const getFloorYAtX = (x: number): number => {
    if (floorStartY !== null) {
      return floorStartY
    }
    // Default: lower 35% of image
    return Math.floor(containerSize.height * 0.65)
  }

  // Get depth at a point (normalized 0-1)
  const getDepthAtPoint = (x: number, y: number): number => {
    if (!depthMap || !roomImg) {
      // Heuristic: closer = lower Y
      return 1.0 - (y / containerSize.height)
    }
    
    // Scale coordinates to depth map dimensions
    const depthWidth = depthMap[0]?.length || containerSize.width
    const depthHeight = depthMap.length || containerSize.height
    const depthX = Math.floor((x / containerSize.width) * depthWidth)
    const depthY = Math.floor((y / containerSize.height) * depthHeight)
    
    if (depthY >= 0 && depthY < depthMap.length && depthX >= 0 && depthX < depthMap[depthY].length) {
      return depthMap[depthY][depthX]
    }
    return 0.5 // Default depth
  }

  // Calculate scale based on depth (closer = larger)
  const getScaleForDepth = (depth: number, baseScale: number = 40): number => {
    // Depth 0.0 (far) = smaller scale, depth 1.0 (near) = larger scale
    const depthMultiplier = 0.5 + (depth * 0.5) // Range: 0.5x to 1.0x
    return baseScale * depthMultiplier
  }

  const handleItemPointerDown = (e: React.PointerEvent, itemId: string) => {
    e.stopPropagation()
    const item = placedItems.find((i) => i.id === itemId)
    if (!item || !containerRef.current) return

    setDraggingItemId(itemId)
    const rect = containerRef.current.getBoundingClientRect()
    setDragStart({
      x: e.clientX - rect.left - item.x,
      y: e.clientY - rect.top - item.y,
    })
    onSelectedItemChange(itemId)
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingItemId || !dragStart || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    let x = e.clientX - rect.left - dragStart.x
    let y = e.clientY - rect.top - dragStart.y

    const item = placedItems.find((i) => i.id === draggingItemId)
    if (!item) return

    const overlayWidth = (containerSize.width * item.scale) / 100
    const overlayHeight = overlayWidth

    // Snap to floor if enabled
    if (snapToFloor) {
      const floorY = getFloorYAtX(x)
      // Anchor bottom of item to floor
      y = floorY - overlayHeight / 2
    }

    // Get depth at anchor point and update scale
    const depth = getDepthAtPoint(x, y)
    const newScale = getScaleForDepth(depth, item.scale)

    const minX = overlayWidth / 2
    const maxX = containerSize.width - overlayWidth / 2
    const minY = overlayHeight / 2
    const maxY = containerSize.height - overlayHeight / 2

    const clampedX = Math.max(minX, Math.min(maxX, x))
    const clampedY = Math.max(minY, Math.min(maxY, y))

    // Calculate normalized anchor point
    const anchorX = clampedX / containerSize.width
    const anchorY = clampedY / containerSize.height

    onPlacedItemsChange(
      placedItems.map((i) => 
        i.id === draggingItemId 
          ? { 
              ...i, 
              x: clampedX, 
              y: clampedY,
              anchorX,
              anchorY,
              floorY: snapToFloor ? getFloorYAtX(clampedX) : undefined,
              depth,
              scale: newScale,
            } 
          : i
      )
    )
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    target.releasePointerCapture(e.pointerId)
    setDraggingItemId(null)
    setDragStart(null)
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelectedItemChange(null)
    }
  }

  const updateSelectedItem = (updates: Partial<PlacedItem>) => {
    if (!selectedItemId) return
    onPlacedItemsChange(
      placedItems.map((item) => (item.id === selectedItemId ? { ...item, ...updates } : item))
    )
  }

  const handleBringForward = () => {
    if (!selectedItemId) return
    const maxZ = Math.max(...placedItems.map((i) => i.zIndex))
    updateSelectedItem({ zIndex: maxZ + 1 })
  }

  const handleSendBackward = () => {
    if (!selectedItemId) return
    const minZ = Math.min(...placedItems.map((i) => i.zIndex))
    updateSelectedItem({ zIndex: minZ - 1 })
  }

  if (!mounted) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded flex items-center justify-center">
        <p className="text-muted-foreground">Loading preview...</p>
      </div>
    )
  }

  const sortedItems = [...placedItems].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="snapToFloor"
          checked={snapToFloor}
          onChange={(e) => setSnapToFloor(e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="snapToFloor" className="text-sm cursor-pointer">
          Snap to floor
        </Label>
      </div>
      <div
        ref={containerRef}
        className="w-full aspect-video bg-gray-100 rounded overflow-hidden relative"
        style={{
          perspective: selectedItem?.perspective || 1000,
          perspectiveOrigin: "center",
        }}
        onClick={handleContainerClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {imageError || !roomImage ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <p className="text-muted-foreground">
              {!roomImage ? "No room image available" : "Failed to load room image"}
            </p>
          </div>
        ) : (
          <>
            <Stage width={containerSize.width} height={containerSize.height}>
              <Layer>
                {roomImg ? (
                  <KonvaImage
                    image={roomImg}
                    width={containerSize.width}
                    height={containerSize.height}
                  />
                ) : (
                  <Group>
                    <Rect
                      width={containerSize.width}
                      height={containerSize.height}
                      fill="#f3f4f6"
                    />
                  </Group>
                )}
              </Layer>
            </Stage>
            {/* Draw floor boundary line (debug/visual aid) */}
            {floorBoundary && floorStartY !== null && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: `${floorStartY}px`,
                  width: "100%",
                  height: "2px",
                  backgroundColor: "rgba(59, 130, 246, 0.5)",
                  pointerEvents: "none",
                  zIndex: 1000,
                }}
              />
            )}
            {sortedItems.map((item) => {
              const sku = catalog.find((s) => s.id === item.skuId)
              if (!sku) return null

              const cacheKey = `${item.skuId}-${item.roll}`
              const itemImage = itemImageCache.current.get(cacheKey)
              if (!itemImage) return null

              const overlayWidth = (containerSize.width * item.scale) / 100
              const overlayHeight = overlayWidth
              const isSelected = item.id === selectedItemId

              return (
                <div
                  key={item.id}
                  onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                  style={{
                    position: "absolute",
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                    width: `${overlayWidth}px`,
                    height: `${overlayHeight}px`,
                    transform: `translate(-50%, -50%) scale(${item.scale / 100}) rotateZ(${item.roll}deg) rotateY(${item.yaw}deg) rotateX(${item.pitch}deg)`,
                    transformStyle: "preserve-3d",
                    cursor: draggingItemId === item.id ? "grabbing" : "grab",
                    opacity: item.opacity,
                    filter: `drop-shadow(${Math.sin((item.roll * Math.PI) / 180) * 8}px ${Math.cos((item.roll * Math.PI) / 180) * 8}px 10px rgba(0, 0, 0, 0.3))`,
                    outline: isSelected ? "2px solid #3b82f6" : "none",
                    outlineOffset: "2px",
                    zIndex: item.zIndex,
                  }}
                >
                  <img
                    src={itemImage.src}
                    alt={sku.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              )
            })}
          </>
        )}
      </div>

      {selectedItem && selectedSku && (
        <div className="space-y-3 p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{selectedSku.name}</p>
              <p className="text-sm text-muted-foreground">{selectedSku.category}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleBringForward}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleSendBackward}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteItem(selectedItem.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs">Size ({Math.round(selectedItem.scale)}%)</Label>
              <Slider
                value={[selectedItem.scale]}
                onValueChange={([value]) => updateSelectedItem({ scale: value })}
                min={20}
                max={60}
                step={1}
              />
            </div>
            <div>
              <Label className="text-xs">Opacity ({Math.round(selectedItem.opacity * 100)}%)</Label>
              <Slider
                value={[selectedItem.opacity]}
                onValueChange={([value]) => updateSelectedItem({ opacity: value })}
                min={0}
                max={1}
                step={0.1}
              />
            </div>
            <div>
              <Label className="text-xs">Roll ({Math.round(selectedItem.roll)}°)</Label>
              <Slider
                value={[selectedItem.roll]}
                onValueChange={([value]) => updateSelectedItem({ roll: value })}
                min={0}
                max={360}
                step={1}
              />
            </div>
            <div>
              <Label className="text-xs">Yaw ({Math.round(selectedItem.yaw)}°)</Label>
              <Slider
                value={[selectedItem.yaw]}
                onValueChange={([value]) => updateSelectedItem({ yaw: value })}
                min={-45}
                max={45}
                step={1}
              />
            </div>
            <div>
              <Label className="text-xs">Pitch ({Math.round(selectedItem.pitch)}°)</Label>
              <Slider
                value={[selectedItem.pitch]}
                onValueChange={([value]) => updateSelectedItem({ pitch: value })}
                min={-30}
                max={30}
                step={1}
              />
            </div>
            <div>
              <Label className="text-xs">Perspective ({selectedItem.perspective}px)</Label>
              <Slider
                value={[selectedItem.perspective]}
                onValueChange={([value]) => updateSelectedItem({ perspective: value })}
                min={800}
                max={1200}
                step={50}
              />
            </div>
          </div>
        </div>
      )}

      {!selectedItem && placedItems.length > 0 && (
        <div className="p-4 border rounded-lg bg-card text-center text-sm text-muted-foreground">
          Select an item to edit
        </div>
      )}
    </div>
  )
}
