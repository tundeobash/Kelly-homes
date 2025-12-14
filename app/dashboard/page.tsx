import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import RoomPhotoViewer from "@/components/RoomPhotoViewer"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const projects = await prisma.roomProject.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      recommendations: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              furnitureItem: true,
            },
          },
        },
      },
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold">Kelly Homes</h1>
          </Link>
          <div className="flex gap-4">
            <Link href="/styles">
              <Button variant="ghost">Styles</Button>
            </Link>
            <Link href="/catalog">
              <Button variant="ghost">Catalog</Button>
            </Link>
            <Link href="/designers">
              <Button variant="ghost">Designers</Button>
            </Link>
            <Link href="/api/auth/signout">
              <Button variant="ghost">Sign Out</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">My Projects</h2>
          <Link href="/project/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                You don't have any projects yet.
              </p>
              <Link href="/project/new">
                <Button>Create Your First Project</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link key={project.id} href={`/project/${project.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="aspect-video bg-gray-200 rounded-t-lg overflow-hidden">
                    <RoomPhotoViewer
                      imageUrl={project.imageUrl}
                      alt={project.name}
                      className="w-full h-full"
                    />
                  </div>
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>
                      {project.roomType} • {project.length}ft × {project.width}ft
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {project.recommendations.length > 0 && project.recommendations[0]?.items && (
                      <p className="text-sm text-muted-foreground">
                        {project.recommendations[0].items.length} items recommended
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

