import { prisma } from "./prisma"
import type { RoomProject, FurnitureItem, User } from "@prisma/client"

interface RecommendationParams {
  project: RoomProject & { user: User }
  stylePreference?: string[]
  budgetMax?: number
  designerId?: string
}

// TODO: Replace with ML model or advanced algorithm
// This is a rule-based MVP - can be upgraded to use ML/AI for better recommendations
export async function generateRecommendation(params: RecommendationParams) {
  const { project, stylePreference, budgetMax, designerId } = params

  let furnitureQuery: any = {
    where: {
      category: getCategoryForRoomType(project.roomType),
    },
  }

  // Filter by style if provided
  if (stylePreference && stylePreference.length > 0) {
    furnitureQuery.where.styleTags = {
      hasSome: stylePreference,
    }
  }

  // Filter by budget if provided
  if (budgetMax) {
    furnitureQuery.where.price = {
      lte: budgetMax,
    }
  }

  // If designer is specified, use their curated sets
  if (designerId) {
    const designer = await prisma.designer.findUnique({
      where: { id: designerId },
    })

    if (designer && designer.curatedSets) {
      const sets = designer.curatedSets as string[][]
      const allItemIds = sets.flat()
      
      // Get furniture items by ID
      const curatedItems = await prisma.furnitureItem.findMany({
        where: {
          id: { in: allItemIds },
        },
      })

      if (curatedItems.length > 0) {
        return createRecommendation(project.id, curatedItems, project, designerId)
      }
    }
  }

  // Otherwise, generate based on room dimensions and constraints
  const allFurniture = await prisma.furnitureItem.findMany(furnitureQuery)

  // Filter by room dimensions
  const fittingFurniture = allFurniture.filter((item) => {
    const dims = item.dimensions as { length: number; width: number; height: number }
    return (
      dims.length <= project.length &&
      dims.width <= project.width &&
      dims.height <= project.height
    )
  })

  // Select items for a complete look
  const selectedItems = selectFurnitureForRoom(
    fittingFurniture,
    project.roomType,
    budgetMax || project.user.budgetMax || 5000
  )

  return createRecommendation(project.id, selectedItems, project, designerId)
}

function getCategoryForRoomType(roomType: string): string {
  const mapping: Record<string, string> = {
    "living room": "sofa",
    "bedroom": "bed",
    "office": "desk",
  }
  return mapping[roomType.toLowerCase()] || "sofa"
}

function selectFurnitureForRoom(
  furniture: FurnitureItem[],
  roomType: string,
  budgetMax: number
): FurnitureItem[] {
  const selected: FurnitureItem[] = []
  let totalPrice = 0

  // Priority order based on room type
  const priorities: Record<string, string[]> = {
    "living room": ["sofa", "table", "chair", "lamp", "rug"],
    "bedroom": ["bed", "table", "lamp", "rug"],
    "office": ["desk", "chair", "shelf", "lamp"],
  }

  const priority = priorities[roomType.toLowerCase()] || ["sofa", "table"]

  for (const category of priority) {
    const item = furniture.find(
      (f) => f.category === category && totalPrice + f.price <= budgetMax
    )
    if (item) {
      selected.push(item)
      totalPrice += item.price
    }
  }

  return selected
}

async function createRecommendation(
  projectId: string,
  items: FurnitureItem[],
  project: RoomProject,
  designerId?: string
) {
  const totalPrice = items.reduce((sum, item) => sum + item.price, 0)

  const recommendation = await prisma.recommendation.create({
    data: {
      projectId,
      type: "complete_look",
      designerId: designerId || null,
      totalPrice,
      items: {
        create: items.map((item, index) => ({
          furnitureItemId: item.id,
          // Simple positioning: distribute items across room
          // TODO: Replace with AR SDK positioning logic
          positionX: 0.2 + (index % 3) * 0.3,
          positionY: 0.2 + Math.floor(index / 3) * 0.3,
          rotation: 0,
        })),
      },
    },
    include: {
      items: {
        include: {
          furnitureItem: true,
        },
      },
    },
  })

  return recommendation
}

// TODO: Integrate with real seller APIs here
// This function would call external APIs to get real-time inventory and pricing
export async function getRealTimeInventory(itemId: string) {
  // Placeholder for future seller API integration
  // Example: await fetch(`https://api.ikea.com/products/${itemId}`)
  return null
}

// TODO: Calculate commission based on seller agreements
// This would integrate with payment processing and seller commission tracking
export function calculateCommission(itemPrice: number, seller: string): number {
  // Mock commission rates
  const rates: Record<string, number> = {
    IKEA: 0.05, // 5%
    Etsy: 0.10, // 10%
    "Home Center": 0.08, // 8%
  }
  return itemPrice * (rates[seller] || 0.05)
}

