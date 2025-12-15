import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import CatalogClient from "@/components/CatalogClient"

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { style?: string; seller?: string; budget?: string; category?: string }
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

  if (searchParams.budget && searchParams.budget !== "all") {
    const budget = parseFloat(searchParams.budget)
    if (budget === 10001) {
      where.price = { gte: 10001 }
    } else {
      // For ranges, calculate min from previous range
      const budgetRanges: { [key: string]: { min: number; max: number } } = {
        "500": { min: 1, max: 500 },
        "1000": { min: 501, max: 1000 },
        "2000": { min: 1001, max: 2000 },
        "5000": { min: 2001, max: 5000 },
        "10000": { min: 5001, max: 10000 },
      }
      const range = budgetRanges[searchParams.budget]
      if (range) {
        where.price = { gte: range.min, lte: range.max }
      }
    }
  }
  
  if (searchParams.category && searchParams.category !== "all") {
    // TODO: Add category field to FurnitureItem model or filter by name/description
    where.name = { contains: searchParams.category, mode: "insensitive" }
  }

  const items = await prisma.furnitureItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  const sellers = await prisma.furnitureItem.findMany({
    select: { seller: true },
    distinct: ["seller"],
  })

  return <CatalogClient items={items} sellers={sellers.map((s) => s.seller)} />
}

