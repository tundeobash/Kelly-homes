import { redirect } from "next/navigation"
import dynamic from "next/dynamic"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateRecommendation } from "@/lib/recommendation-engine"
import { normalizeProject } from "@/lib/api/normalize-project"

const ProjectView = dynamic(() => import("@/components/ProjectView"), { ssr: false })

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({
  params,
}: PageProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const project = await prisma.roomProject.findUnique({
    where: { id },
    include: {
      user: true,
      recommendations: {
        include: {
          items: {
            include: {
              furnitureItem: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!project || project.userId !== session.user.id) {
    redirect("/profile/me")
  }

  // Normalize project to get designs array (same as API does)
  const normalizedProject = normalizeProject(project)
  
  // Use safe accessor for designs (normalizeProject returns aiDesigns)
  const designs = normalizedProject.aiDesigns ?? []
  
  if (process.env.NODE_ENV === "development") {
    console.log("[PROJECT DETAIL] Project ID:", normalizedProject.id)
    console.log("[PROJECT DETAIL] Image URL:", normalizedProject.imageUrl?.substring(0, 50))
    console.log("[PROJECT DETAIL] Designs count:", designs.length)
    console.log("[PROJECT DETAIL] First design URL:", designs[0]?.imageUrl?.substring(0, 50))
  }

  // Get user preferences
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  // Get designers for the designer selector
  const designers = await prisma.designer.findMany({
    orderBy: { name: "asc" },
  })
  
  // Merge normalized data with recommendations and user
  const projectWithDesigns = {
    ...normalizedProject,
    recommendations: project.recommendations,
    user: project.user,
  }

  return (
    <ProjectView
      project={projectWithDesigns}
      userPreferences={user?.preferredStyles || []}
      userBudget={user?.budgetMax}
      designers={designers}
    />
  )
}

