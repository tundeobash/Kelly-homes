import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizeProject } from "@/lib/api/normalize-project"
import DesignStudio from "@/components/design/DesignStudio"
import { cleanMustInclude } from "@/lib/design/mustInclude"
import { piecesForRoom } from "@/lib/design/pieces"

type PageProps = {
  params: Promise<{ id: string }>
}

/** A room's page is its design screen. */
export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const project = await prisma.roomProject.findUnique({ where: { id } })

  if (!project || project.userId !== session.user.id) {
    redirect("/profile/me")
  }

  const normalized = normalizeProject(project)

  return (
    <DesignStudio
      project={{
        id: normalized.id,
        name: normalized.name,
        roomType: normalized.roomType || "",
        imageUrl: normalized.imageUrl || null,
        mustInclude: cleanMustInclude(normalized.lastAiSettings?.mustInclude),
        pieces: piecesForRoom(normalized.lastAiSettings, (project.aiDesignsJson as unknown[]) || []),
        designs: normalized.aiDesigns.map((design) => ({
          id: design.id,
          imageUrl: design.imageUrl,
          style: design.style || "",
          createdAt: design.createdAt ?? null,
          sourceImageUrl: design.sourceImageUrl ?? null,
          mustInclude: design.mustInclude ?? [],
          piece: design.piece ?? null,
          pieceMode: design.pieceMode ?? null,
          pieceIncluded: design.pieceIncluded ?? null,
          baseDesignId: design.baseDesignId ?? null,
        })),
      }}
    />
  )
}
