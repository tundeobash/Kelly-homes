import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { getUserContext } from "@/lib/auth/getUserContext"
import { prisma } from "@/lib/prisma"
import { normalizeProject } from "@/lib/api/normalize-project"
import { roomCover, roomMeta } from "@/lib/rooms"
import { styleDisplayName } from "@/lib/design/studioStyles"
import RoomCard from "@/components/RoomCard"

type PageProps = {
  params: Promise<{ username: string }>
}

/** "Your rooms": every room the signed-in person has, newest activity first. */
export default async function YourRoomsPage({ params }: PageProps) {
  const { username } = await params
  const user = await getUserContext()

  if (!user) redirect("/auth")
  // Only your own rooms exist for now.
  if (username !== "me") redirect("/profile/me")

  const projects = await prisma.roomProject.findMany({
    where: { userId: user.userId },
    orderBy: { updatedAt: "desc" },
  })

  const now = new Date()
  const rooms = projects.map((project) => {
    const normalized = normalizeProject(project)
    const summary = {
      roomType: normalized.roomType,
      imageUrl: normalized.imageUrl,
      designs: normalized.aiDesigns.map((d) => ({ imageUrl: d.imageUrl, style: d.style })),
      updatedAt: project.updatedAt,
    }
    const cover = roomCover(summary)
    const latestStyle = normalized.aiDesigns[0]?.style
    return {
      id: normalized.id,
      name: normalized.name,
      meta: roomMeta(summary, now),
      cover: cover.src,
      coverAlt: cover.isDesign ? `Latest design: ${styleDisplayName(latestStyle)}` : "Room photo",
    }
  })

  return (
    <div className="mx-auto max-w-6xl font-sans text-ks-ink">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[30px] font-semibold leading-tight text-ks-ink sm:text-[36px]">Your rooms</h1>
          <p className="mt-1.5 text-[15px] text-ks-stone">Open a room to design it, try another style or compare.</p>
        </div>
      </div>

      {rooms.length === 0 ? (
        <section className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-[#9CA3AF] bg-white px-6 py-12 text-center">
          <p className="font-serif text-[22px] font-semibold text-ks-ink">Add your first room</p>
          <p className="mt-2 max-w-sm text-[15px] leading-normal text-ks-stone">
            Take a photo of a room, pick a style, and see it redesigned in under a minute.
          </p>
          <Link
            href="/project/new"
            className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl bg-ks-charcoal px-5 text-[15px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a room
          </Link>
        </section>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} {...room} />
          ))}
        </div>
      )}
    </div>
  )
}
