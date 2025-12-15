import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import DesignerProfileClient from "@/components/DesignerProfileClient"

async function getDesignerData(slug: string) {
  const name = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

  const designer = await prisma.designer.findUnique({
    where: { name },
  })

  if (!designer) {
    return null
  }

  const mockProjects = [
    {
      id: "1",
      name: `${designer.style} Living Room`,
      imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800",
      roomType: "living room",
    },
    {
      id: "2",
      name: `${designer.style} Bedroom`,
      imageUrl: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
      roomType: "bedroom",
    },
    {
      id: "3",
      name: `${designer.style} Office`,
      imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
      roomType: "office",
    },
  ]

  return {
    ...designer,
    projects: mockProjects,
  }
}

export default async function DesignerProfilePage({
  params,
}: {
  params: { slug: string }
}) {
  const designer = await getDesignerData(params.slug)

  if (!designer) {
    redirect("/designers")
  }

  const initials = designer.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return <DesignerProfileClient designer={designer} initials={initials} />
}
