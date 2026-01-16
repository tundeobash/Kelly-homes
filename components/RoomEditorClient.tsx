"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { catalog, CatalogItem } from "@/lib/catalog"
import { Download, Trash2, ArrowUp, ArrowDown, RotateCw } from "lucide-react"

const Stage = dynamic(() => import("react-konva").then((mod) => mod.Stage), {
  ssr: false,
})
const Layer = dynamic(() => import("react-konva").then((mod) => mod.Layer), {
  ssr: false,
})
const Image = dynamic(() => import("react-konva").then((mod) => mod.Image), {
  ssr: false,
})
const Group = dynamic(() => import("react-konva").then((mod) => mod.Group), {
  ssr: false,
})
const Transformer = dynamic(() => import("react-konva").then((mod) => mod.Transformer), {
  ssr: false,
})
const Rect = dynamic(() => import("react-konva").then((mod) => mod.Rect), {
  ssr: false,
})

type PlacedItem = {
  id: string
  skuId: string
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  zIndex: number
  shadowEnabled: boolean
  shadowBlur: number
  shadowOpacity: number
  floorPerspective: number
  opacity: number
}

type SceneData = {
  backgroundImage: string | null
  items: PlacedItem[]
}

export default function RoomEditorClient() {
  const [mounted, setMounted] = useState(false)
  const [roomImage, setRoomImage] = useState<HTMLImageElement | null>(null)
  const [roomImageUrl, setRoomImageUrl] = useState<string | null>(null)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const transformerRef = useRef<any>(null)

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
    return () => window.removeEventListener("resize", updateSize)

    // Load saved scene from localStorage
    const saved = localStorage.getItem("room-editor-scene")
    if (saved) {
      try {
        const scene: SceneData = JSON.parse(saved || "{}")
        if (scene.backgroundImage) {
          const img = new window.Image()
          img.crossOrigin = "anonymous"
          img.src = scene.backgroundImage || ""
          img.onload = () => {
            setRoomImage(img)
            setRoomImageUrl(scene.backgroundImage)
          }
        }
        if (scene.items) {
          setPlacedItems(scene.items)
        }
      } catch (e) {
        console.error("Failed to load saved scene:", e)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`)
      if (node) {
        transformerRef.current.nodes([node])
        transformerRef.current.getLayer().batchDraw()
      }
    } else {
      transformerRef.current?.nodes([])
    }
  }, [selectedId, placedItems])

  const handleRoomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.match(/^image\/(png|jpg|jpeg)$/)) {
      alert("Please upload a PNG, JPG, or JPEG image")
      return
    }

    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.src = url
    img.onload = () => {
      setRoomImage(img)
      setRoomImageUrl(url)
      saveScene()
    }
  }

  const handleAddSKU = (sku: CatalogItem) => {
    const newItem: PlacedItem = {
      id: `item-${Date.now()}`,
      skuId: sku.id,
      x: containerSize.width / 2,
      y: containerSize.height / 2,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      zIndex: placedItems.length,
      shadowEnabled: true,
      shadowBlur: 10,
      shadowOpacity: 0.3,
      floorPerspective: 0,
      opacity: 1,
    }
    setPlacedItems([...placedItems, newItem])
    setSelectedId(newItem.id)
    saveScene()
  }

  const handleItemDragEnd = (e: any) => {
    const id = e.target.id()
    const x = e.target.x()
    const y = e.target.y()
    setPlacedItems((items) =>
      items.map((item) => (item.id === id ? { ...item, x, y } : item))
    )
    saveScene()
  }

  const handleItemTransformEnd = (e: any) => {
    const id = e.target.id()
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const rotation = node.rotation()
    const x = node.x()
    const y = node.y()

    node.scaleX(1)
    node.scaleY(1)

    setPlacedItems((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              x,
              y,
              scaleX: scaleX,
              scaleY: scaleY,
              rotation,
            }
          : item
      )
    )
    saveScene()
  }

  const handleDelete = () => {
    if (selectedId) {
      setPlacedItems((items) => items.filter((item) => item.id !== selectedId))
      setSelectedId(null)
      saveScene()
    }
  }

  const handleBringForward = () => {
    if (selectedId) {
      setPlacedItems((items) => {
        const item = items.find((i) => i.id === selectedId)
        if (!item) return items
        const maxZ = Math.max(...items.map((i) => i.zIndex))
        return items.map((i) =>
          i.id === selectedId ? { ...i, zIndex: maxZ + 1 } : i
        )
      })
      saveScene()
    }
  }

  const handleSendBackward = () => {
    if (selectedId) {
      setPlacedItems((items) => {
        const item = items.find((i) => i.id === selectedId)
        if (!item) return items
        const minZ = Math.min(...items.map((i) => i.zIndex))
        return items.map((i) =>
          i.id === selectedId ? { ...i, zIndex: minZ - 1 } : i
        )
      })
      saveScene()
    }
  }

  const updateItemProperty = (id: string, property: keyof PlacedItem, value: any) => {
    setPlacedItems((items) =>
      items.map((item) => (item.id === id ? { ...item, [property]: value } : item))
    )
    saveScene()
  }

  const saveScene = () => {
    const scene: SceneData = {
      backgroundImage: roomImageUrl,
      items: placedItems,
    }
    localStorage.setItem("room-editor-scene", JSON.stringify(scene))
  }

  const handleExport = () => {
    if (!stageRef.current) return

    const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 })
    const link = document.createElement("a")
    link.download = `room-editor-${Date.now()}.png`
    link.href = dataURL
    link.click()
  }

  const selectedItem = placedItems.find((item) => item.id === selectedId)

  if (!mounted) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <div className="border-b p-4">
          <h1 className="text-2xl font-bold mb-2">Room Editor</h1>
          <div className="flex gap-2">
            <Label htmlFor="room-upload" className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>Upload Room Photo</span>
              </Button>
              <Input
                id="room-upload"
                type="file"
                accept="image/png,image/jpg,image/jpeg"
                onChange={handleRoomImageUpload}
                className="hidden"
              />
            </Label>
            <Button onClick={handleExport} disabled={!roomImage}>
              <Download className="mr-2 h-4 w-4" />
              Export PNG
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Accepts PNG, JPG, or JPEG images
          </p>
        </div>

        <div ref={containerRef} className="flex-1 bg-gray-100 overflow-hidden relative">
          <Stage
            ref={stageRef}
            width={containerSize.width}
            height={containerSize.height}
            style={{ width: "100%", height: "100%" }}
            onClick={(e) => {
              const clickedOnEmpty = e.target === e.target.getStage()
              if (clickedOnEmpty) {
                setSelectedId(null)
              }
            }}
          >
            <Layer>
              {roomImage && (
                <Image
                  image={roomImage}
                  width={containerSize.width}
                  height={containerSize.height}
                />
              )}
              {placedItems
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((item) => {
                  const sku = catalog.find((s) => s.id === item.skuId)
                  if (!sku) return null

                  return (
                    <FurnitureItem
                      key={item.id}
                      item={item}
                      sku={sku}
                      isSelected={item.id === selectedId}
                      onSelect={() => setSelectedId(item.id)}
                      onDragEnd={handleItemDragEnd}
                      onTransformEnd={handleItemTransformEnd}
                    />
                  )
                })}
              {selectedId && (
                <Transformer
                  ref={transformerRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                      return oldBox
                    }
                    return newBox
                  }}
                />
              )}
            </Layer>
          </Stage>
        </div>
      </div>

      <div className="w-80 border-l overflow-y-auto">
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SKU Palette</CardTitle>
              <CardDescription>Click to add to canvas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {catalog.map((sku) => (
                  <button
                    key={sku.id}
                    onClick={() => handleAddSKU(sku)}
                    className="p-2 border rounded hover:bg-muted transition-colors"
                  >
                    <div className="aspect-square bg-gray-100 rounded mb-2 relative overflow-hidden">
                      <img
                        src={sku.imagePath}
                        alt={sku.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-xs font-medium truncate">{sku.name}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedItem && (
            <Card>
              <CardHeader>
                <CardTitle>Item Controls</CardTitle>
                <CardDescription>{catalog.find((s) => s.id === selectedItem.skuId)?.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBringForward}
                    className="flex-1"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendBackward}
                    className="flex-1"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="shadow-enabled"
                      checked={selectedItem.shadowEnabled}
                      onCheckedChange={(checked) =>
                        updateItemProperty(selectedId!, "shadowEnabled", checked)
                      }
                    />
                    <Label htmlFor="shadow-enabled">Shadow</Label>
                  </div>
                  {selectedItem.shadowEnabled && (
                    <>
                      <div>
                        <Label className="text-xs">Shadow Blur</Label>
                        <Slider
                          value={[selectedItem.shadowBlur]}
                          onValueChange={([value]) =>
                            updateItemProperty(selectedId!, "shadowBlur", value)
                          }
                          min={0}
                          max={50}
                          step={1}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Shadow Opacity</Label>
                        <Slider
                          value={[selectedItem.shadowOpacity]}
                          onValueChange={([value]) =>
                            updateItemProperty(selectedId!, "shadowOpacity", value)
                          }
                          min={0}
                          max={1}
                          step={0.1}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <Label className="text-xs">Floor Perspective</Label>
                  <Slider
                    value={[selectedItem.floorPerspective]}
                    onValueChange={([value]) =>
                      updateItemProperty(selectedId!, "floorPerspective", value)
                    }
                    min={0}
                    max={1}
                    step={0.1}
                  />
                </div>

                <div>
                  <Label className="text-xs">Opacity</Label>
                  <Slider
                    value={[selectedItem.opacity]}
                    onValueChange={([value]) =>
                      updateItemProperty(selectedId!, "opacity", value)
                    }
                    min={0}
                    max={1}
                    step={0.1}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function FurnitureItem({
  item,
  sku,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: {
  item: PlacedItem
  sku: CatalogItem
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (e: any) => void
  onTransformEnd: (e: any) => void
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const shapeRef = useRef<any>(null)

  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.src = sku.imagePath
    img.onload = () => setImage(img)
  }, [sku.imagePath])

  useEffect(() => {
    if (isSelected && shapeRef.current) {
      shapeRef.current.getLayer().batchDraw()
    }
  }, [isSelected])

  if (!image) return null

  const scaleY = item.scaleY * (1 - item.floorPerspective * 0.3)
  const skewY = item.floorPerspective * 10

  return (
    <Group
      ref={shapeRef}
      id={item.id}
      x={item.x}
      y={item.y}
      scaleX={item.scaleX}
      scaleY={scaleY}
      rotation={item.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      {isSelected && (
        <Rect
          x={-image.width / 2 - 5}
          y={-image.height / 2 - 5}
          width={image.width + 10}
          height={image.height + 10}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[5, 5]}
        />
      )}
      <Image
        image={image}
        x={-image.width / 2}
        y={-image.height / 2}
        opacity={item.opacity}
        shadowEnabled={item.shadowEnabled}
        shadowBlur={item.shadowBlur}
        shadowOpacity={item.shadowOpacity}
        shadowOffsetX={5}
        shadowOffsetY={5}
        skewY={skewY}
      />
    </Group>
  )
}
