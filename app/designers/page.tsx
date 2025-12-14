import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DesignersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const designers = await prisma.designer.findMany({
    orderBy: { createdAt: "desc" },
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
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">Interior Designers</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {designers.map((designer) => (
            <Card key={designer.id}>
              {designer.imageUrl && (
                <div className="aspect-square bg-gray-200 rounded-t-lg overflow-hidden">
                  <img
                    src={designer.imageUrl}
                    alt={designer.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle>{designer.name}</CardTitle>
                <CardDescription>{designer.style} Style</CardDescription>
              </CardHeader>
              <CardContent>
                {designer.bio && <p className="text-sm mb-4">{designer.bio}</p>}
                <Link href={`/project/new?designer=${designer.id}`}>
                  <Button className="w-full">Apply This Style</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

