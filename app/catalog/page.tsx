import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import CatalogClient from "@/components/CatalogClient"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { style?: string; seller?: string; budget?: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const where: any = {}

  if (searchParams.style) {
    where.styleTags = { has: searchParams.style }
  }

  if (searchParams.seller) {
    where.seller = searchParams.seller
  }

  if (searchParams.budget) {
    const budget = parseFloat(searchParams.budget)
    where.price = { lte: budget }
  }

  const items = await prisma.furnitureItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  const sellers = await prisma.furnitureItem.findMany({
    select: { seller: true },
    distinct: ["seller"],
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
            <Link href="/checkout">
              <Button variant="ghost">Cart</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <CatalogClient items={items} sellers={sellers.map((s) => s.seller)} />
      </main>
    </div>
  )
}

