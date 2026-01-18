import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { designStyles } from "@/lib/mock/styles"
import StylesClient from "@/components/StylesClient"

type PageProps = {
  searchParams: Promise<{ projectId?: string }>
}

export default async function StylesPage({
  searchParams,
}: PageProps) {
  const { projectId } = await searchParams
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  // Get user's current preferred style
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferredStyles: true },
  })

  return (
    <>
      <h2 className="text-3xl font-bold mb-8">Design Styles</h2>
      <StylesClient
        styles={designStyles}
        userPreferredStyles={user?.preferredStyles || []}
        projectId={projectId}
      />
    </>
  )
}

