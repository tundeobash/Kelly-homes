import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { designStyles } from "@/lib/mock/styles"
import StylesClient from "@/components/StylesClient"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function StylesPage({
  searchParams,
}: {
  searchParams: { projectId?: string }
}) {
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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold">Kelly Homes</h1>
          </Link>
          <div className="flex gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
            <Link href="/catalog">
              <Button variant="ghost">Catalog</Button>
            </Link>
            <Link href="/designers">
              <Button variant="ghost">Designers</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">Design Styles</h2>
        <StylesClient
          styles={designStyles}
          userPreferredStyles={user?.preferredStyles || []}
          projectId={searchParams.projectId}
        />
      </main>
    </div>
  )
}

