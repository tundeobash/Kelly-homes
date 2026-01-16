    "use client"

    import { useState, useRef } from "react"
    import { Button } from "@/components/ui/button"
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
    import { Upload, Loader2 } from "lucide-react"
    import RoomPhotoViewer from "./RoomPhotoViewer"

    interface RoomPhotoUploaderProps {
    projectId: string
    currentImageUrl?: string // Made optional for backward compatibility
    onImageUrlChange?: (url: string) => void // Made optional for backward compatibility
    value?: string // New controlled prop (takes precedence over currentImageUrl)
    onChange?: (url: string) => void // New controlled prop (takes precedence over onImageUrlChange)
    showTitle?: boolean
    }

    export default function RoomPhotoUploader({
    projectId,
    currentImageUrl,
    onImageUrlChange,
    value,
    onChange,
    showTitle = false,
    }: RoomPhotoUploaderProps) {
    // Use value/onChange if provided, otherwise fall back to currentImageUrl/onImageUrlChange for backward compatibility
    const imageUrl = value !== undefined ? value : (currentImageUrl || "")
    const handleChange = onChange || onImageUrlChange || (() => {})
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith("image/")) {
        setError("Please select an image file")
        return
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
        setError("Image must be less than 10MB")
        return
        }

        setUploading(true)
        setError(null)

        try {
        // Create FormData for file upload
        const formData = new FormData()
        formData.append("file", file)
        formData.append("projectId", projectId)

        // Upload image
        const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        })

        if (!uploadRes.ok) {
            const errorData = await uploadRes.json().catch(() => ({}))
            throw new Error(errorData.error || "Failed to upload image")
        }

        const uploadData = await uploadRes.json()
        const newImageUrl = uploadData.url || uploadData.imageUrl

        if (!newImageUrl) {
            throw new Error("No image URL returned from server")
        }

        // Update project with new image URL
        const updateRes = await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: newImageUrl }),
        })

        if (!updateRes.ok) {
            const errorData = await updateRes.json().catch(() => ({}))
            throw new Error(errorData.error || "Failed to update project")
        }

        // Update via controlled prop
        handleChange(newImageUrl)
        } catch (err) {
        console.error("Error uploading image:", err)
        setError(err instanceof Error ? err.message : "Failed to upload image")
        } finally {
        setUploading(false)
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
        }
    }

    const handleClick = () => {
        fileInputRef.current?.click()
    }

    return (
        <Card>
        {showTitle && (
            <CardHeader>
            <CardTitle>Room Photo</CardTitle>
            <CardDescription>Upload a photo of your room</CardDescription>
            </CardHeader>
        )}
        <CardContent className="space-y-4">
            <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            />

            {imageUrl && imageUrl.trim() !== "" ? (
            <div className="space-y-4">
                <RoomPhotoViewer imageUrl={imageUrl} alt="Room photo" className="w-full h-[360px] md:h-[420px]" />
                <Button
                onClick={handleClick}
                disabled={uploading}
                variant="outline"
                className="w-full"
                >
                {uploading ? (
                    <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                    </>
                ) : (
                    <>
                    <Upload className="h-4 w-4 mr-2" />
                    Replace Photo
                    </>
                )}
                </Button>
            </div>
            ) : (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                Upload a photo of your room
                </p>
                <Button
                onClick={handleClick}
                disabled={uploading}
                variant="outline"
                >
                {uploading ? (
                    <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                    </>
                ) : (
                    <>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                    </>
                )}
                </Button>
            </div>
            )}

            {error && (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded">
                {error}
            </div>
            )}
        </CardContent>
        </Card>
    )
    }
