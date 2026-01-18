import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import CatalogClient from "@/components/CatalogClient"

type PageProps = {
  searchParams: Promise<{ style?: string; seller?: string; budget?: string; category?: string }>
}

export default async function CatalogPage({
  searchParams,
}: PageProps) {
  const { style, seller, budget, category } = await searchParams
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const where: any = {}

  if (style) {
    where.styleTags = { has: style }
  }

  if (seller) {
    where.seller = seller
  }

  if (budget && budget !== "all") {
    const budgetValue = parseFloat(budget)
    if (budgetValue === 10001) {
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
      const range = budgetRanges[budget]
      if (range) {
        where.price = { gte: range.min, lte: range.max }
      }
    }
  }
  
  if (category && category !== "all") {
    // TODO: Add category field to FurnitureItem model or filter by name/description
    where.name = { contains: category, mode: "insensitive" }
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

