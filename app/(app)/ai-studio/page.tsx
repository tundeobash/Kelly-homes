import { redirect } from "next/navigation"
import { getUserContext } from "@/lib/auth/getUserContext"
import { prisma } from "@/lib/prisma"

type PageProps = {
  searchParams: Promise<{ projectId?: string }>
}

/**
 * Designing now happens on each room's own page. Old links to AI Studio
 * open that room, or the most recent one, or the new-room form.
 */
export default async function AIStudioPage({ searchParams }: PageProps) {
  const { projectId } = await searchParams
  if (projectId && projectId.trim()) {
    redirect(`/project/${encodeURIComponent(projectId.trim())}`)
  }

  const user = await getUserContext()
  if (!user) {
    redirect("/auth")
  }

  const latest = await prisma.roomProject.findFirst({
    where: { userId: user.userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  })

  redirect(latest ? `/project/${latest.id}` : "/project/new")
}
