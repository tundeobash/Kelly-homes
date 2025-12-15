import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateRecommendation } from "@/lib/recommendation-engine"
import ProjectView from "@/components/ProjectView"

export default async function ProjectPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const project = await prisma.roomProject.findUnique({
    where: { id: params.id },
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

  // Get user preferences
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  // Get designers for the designer selector
  const designers = await prisma.designer.findMany({
    orderBy: { name: "asc" },
  })

  return (
    <ProjectView
      project={project}
      userPreferences={user?.preferredStyles || []}
      userBudget={user?.budgetMax}
      designers={designers}
    />
  )
}

