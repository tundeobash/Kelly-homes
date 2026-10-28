"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ImagePlus, Loader2 } from "lucide-react"
import { ROOM_TYPE_OPTIONS, defaultRoomName } from "@/lib/rooms"

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]

/** Add a room: photo first, then a name and the kind of room, then on to styles. */
export default function AddRoomPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [roomType, setRoomType] = useState("living room")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const choosePhoto = (chosen: File | undefined) => {
    if (!chosen) return
    if (!PHOTO_TYPES.includes(chosen.type)) {
      setError("Please choose a JPG, PNG or WebP photo.")
      return
    }
    if (chosen.size > MAX_PHOTO_BYTES) {
      setError("This photo is over 10 MB. Please choose a smaller one.")
      return
    }
    setError(null)
    setFile(chosen)
    setPreview(URL.createObjectURL(chosen))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Add a photo of the room first.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form })
      const uploadData = await uploadRes.json().catch(() => ({}))
      const imageUrl: string | undefined = uploadData.url || uploadData.imageUrl
      if (!uploadRes.ok || !imageUrl || imageUrl.startsWith("blob:")) {
        throw new Error(uploadData.error || "The photo could not be uploaded. Please try again.")
      }

      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || defaultRoomName(roomType), roomType, imageUrl }),
      })
      const project = await createRes.json().catch(() => ({}))
      if (!createRes.ok || !project.id) {
        throw new Error(project.error || "The room could not be saved. Please try again.")
      }
      router.push(`/project/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-xl flex-col font-sans text-ks-ink">
      <Link
        href="/profile/me"
        className="-ml-1 mb-1 flex h-9 items-center gap-1 self-start text-[14px] font-medium text-[#4B5563] hover:text-ks-charcoal"
      >
        <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
        Your rooms
      </Link>
      <h1 className="font-serif text-[30px] font-semibold leading-tight text-ks-ink sm:text-[36px]">Add a room</h1>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          choosePhoto(e.target.files?.[0])
          e.target.value = ""
        }}
      />

      {preview ? (
        <div className="mt-5 flex items-start gap-3.5">
          <img src={preview} alt="Your room photo" className="h-44 w-[132px] flex-shrink-0 rounded-[14px] object-cover" />
          <div className="flex flex-col gap-2.5 pt-0.5">
            <p className="text-[15px] font-semibold text-ks-ink">Your photo</p>
            <ul className="list-disc pl-[18px] text-[14px] leading-relaxed text-ks-stone">
              <li className="text-[14px] text-ks-stone">Stand in a corner</li>
              <li className="text-[14px] text-ks-stone">Hold your phone upright</li>
              <li className="text-[14px] text-ks-stone">Turn the lights on</li>
            </ul>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              className="h-10 self-start rounded-[10px] border border-ks-charcoal bg-white px-3.5 text-[14px] font-semibold text-ks-charcoal disabled:opacity-50"
            >
              Change photo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-[#9CA3AF] bg-white px-6 py-9 text-center outline-none focus-visible:ring-2 focus-visible:ring-ks-charcoal"
        >
          <ImagePlus className="h-8 w-8 text-ks-charcoal" aria-hidden="true" />
          <span className="mt-3 text-[16px] font-semibold text-ks-ink">Take or choose a photo</span>
          <span className="mt-1 text-[14px] leading-normal text-ks-stone">
            Stand in a corner, hold your phone upright, and turn the lights on.
          </span>
        </button>
      )}

      <label htmlFor="room-name" className="mt-6 text-[14px] font-semibold text-ks-ink">
        Name this room
      </label>
      <input
        id="room-name"
        type="text"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        placeholder={defaultRoomName(roomType)}
        className="mt-2 h-[50px] rounded-xl border border-[#D1D5DB] bg-white px-3.5 text-[16px] text-ks-ink outline-none focus:border-ks-charcoal"
      />
      <span className="mt-1.5 text-[13px] text-ks-stone">Anything you like, for example "Majlis" or "Guest bedroom".</span>

      <fieldset className="mt-6">
        <legend className="text-[14px] font-semibold text-ks-ink">What kind of room is it?</legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {ROOM_TYPE_OPTIONS.map((option) => {
            const on = option.id === roomType
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setRoomType(option.id)}
                aria-pressed={on}
                className={`h-11 rounded-full border px-4 text-[15px] font-medium transition-colors duration-150 ${
                  on ? "border-ks-charcoal bg-ks-charcoal text-white" : "border-[#D1D5DB] bg-white text-ks-charcoal hover:border-ks-charcoal"
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        {roomType === "living and dining room" && (
          <p className="mt-2.5 text-[13px] leading-normal text-ks-stone">Every design keeps a sitting area and a dining area.</p>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="mt-5 text-[14px] text-[#B42318]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !file}
        className="mt-7 flex h-[54px] items-center justify-center gap-2 rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saving ? "Saving your room" : "Choose a style"}
      </button>
      <p className="mt-2.5 text-center text-[13px] leading-normal text-ks-stone">
        Next you pick a style and we design the room.
      </p>
    </form>
  )
}
