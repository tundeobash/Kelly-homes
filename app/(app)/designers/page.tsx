import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import DesignerCard from "@/components/DesignerCard"

const PLACEHOLDER_DESIGNERS = [
  {
    id: "1",
    name: "Emma Modern",
    bio: "Specializing in modern minimalist interiors with clean lines and neutral palettes.",
    style: "Modern",
    imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
  },
  {
    id: "2",
    name: "Lars Scandinavian",
    bio: "Bringing Nordic design principles to create cozy, functional spaces.",
    style: "Scandinavian",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
  },
  {
    id: "3",
    name: "Sophie Minimal",
    bio: "Less is more. Creating serene spaces with essential pieces only.",
    style: "Minimal",
    imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
  },
  {
    id: "4",
    name: "James Industrial",
    bio: "Transforming spaces with raw materials and urban aesthetics.",
    style: "Industrial",
    imageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
  },
  {
    id: "5",
    name: "Maria Coastal",
    bio: "Bringing beachside serenity to your home with light, airy designs.",
    style: "Coastal",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop",
  },
  {
    id: "6",
    name: "David Rustic",
    bio: "Warm, earthy spaces with natural textures and vintage charm.",
    style: "Rustic",
    imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
  },
  {
    id: "7",
    name: "Sarah Bohemian",
    bio: "Eclectic designs that celebrate color, pattern, and free-spirited living.",
    style: "Bohemian",
    imageUrl: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=400&fit=crop",
  },
  {
    id: "8",
    name: "Michael Mid-Century",
    bio: "Retro-inspired elegance with clean lines and organic curves.",
    style: "Mid-Century Modern",
    imageUrl: "https://images.unsplash.com/photo-1502378735452-bc7d86632805?w=400&h=400&fit=crop",
  },
  {
    id: "9",
    name: "Lisa Japandi",
    bio: "Japanese minimalism meets Scandinavian coziness for balanced serenity.",
    style: "Japandi",
    imageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
  },
  {
    id: "10",
    name: "Robert Transitional",
    bio: "Blending traditional and contemporary styles for timeless elegance.",
    style: "Transitional",
    imageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
  },
]

export default async function DesignersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  return (
    <>
      <h2 className="text-3xl font-bold mb-8">Interior Designers</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {PLACEHOLDER_DESIGNERS.map((designer) => (
          <DesignerCard key={designer.id} designer={designer} />
        ))}
      </div>
    </>
  )
}

