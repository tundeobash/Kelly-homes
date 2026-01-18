import { getUserContext } from "@/lib/auth/getUserContext"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"
import ProfileHeaderClient from "@/components/ProfileHeaderClient"
import ProjectCard from "@/components/ProjectCard"

async function getProfileData(username: string, currentUserId?: string) {
  // For now, if username is "me", use current user
  if (username === "me" && currentUserId) {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: {
        projects: {
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
        },
      },
    })
    return user
  }

  // TODO: Implement actual username lookup
  return null
}

type PageProps = {
  params: Promise<{ username: string }>
}

export default async function ProfilePage({
  params,
}: PageProps) {
  const { username } = await params
  const userContext = await getUserContext()
  const profile = await getProfileData(username, userContext?.userId)

  if (!profile) {
    redirect("/")
  }

  const initials = profile.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  return (
    <>
        {/* Profile Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <ProfileHeaderClient
                profile={profile}
                initials={initials}
                isOwnProfile={username === "me"}
              />
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-bold mb-2">{profile.name || "User"}</h2>
                <p className="text-muted-foreground mb-4">
                  Interior design enthusiast • Creating beautiful spaces
                </p>
                <div className="flex gap-6 justify-center md:justify-start">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{profile.projects.length}</div>
                    <div className="text-sm text-muted-foreground">Designs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">0</div>
                    <div className="text-sm text-muted-foreground">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">0</div>
                    <div className="text-sm text-muted-foreground">Following</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Designs Grid */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold">My Designs</h3>
            <Link href="/project/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </Link>
          </div>
          {profile.projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  You don&apos;t have any projects yet.
                </p>
                <Link href="/project/new">
                  <Button>Create Your First Project</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profile.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isOwnProfile={username === "me"}
                />
              ))}
            </div>
          )}
        </div>
    </>
  )
}

