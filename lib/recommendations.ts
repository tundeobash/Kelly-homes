// TODO: Replace placeholder restored after recovery
import { catalog, CatalogItem } from "./catalog"

export interface SkuRecommendation {
  skuId: string
  name: string
  imageUrl: string
  category: string
  price: number
  seller?: string
}

/**
 * Generate SKU recommendations for a project
 * Returns a simple set of catalog items (4-6 items)
 */
export async function generateSkuRecommendations(params: {
  projectId?: string
  style?: string
  roomType?: string
}): Promise<SkuRecommendation[]> {
  // Simple implementation: return a mix of catalog items
  const allItems = Object.values(catalog).flat()
  
  // Filter by category if roomType is provided
  let filteredItems = allItems
  if (params.roomType) {
    const roomTypeLower = params.roomType.toLowerCase()
    if (roomTypeLower.includes("living") || roomTypeLower.includes("lounge")) {
      filteredItems = allItems.filter(
        (item) =>
          item.category === "Sofas" ||
          item.category === "Tables" ||
          item.category === "Chairs"
      )
    } else if (roomTypeLower.includes("bedroom")) {
      filteredItems = allItems.filter(
        (item) =>
          item.category === "Drawers" ||
          item.category === "Tables"
      )
    }
  }

  // Return 4-6 items, prioritizing different categories
  const categories = new Set<string>()
  const selected: CatalogItem[] = []

  for (const item of filteredItems) {
    if (selected.length >= 6) break
    if (!categories.has(item.category) || selected.length < 4) {
      selected.push(item)
      categories.add(item.category)
    }
  }

  // Fill remaining slots if needed
  if (selected.length < 4) {
    for (const item of filteredItems) {
      if (selected.length >= 6) break
      if (!selected.some((s) => s.id === item.id)) {
        selected.push(item)
      }
    }
  }

  return selected.map((item) => ({
    skuId: item.id,
    name: item.name,
    imageUrl: item.imagePath,
    category: item.category,
    price: item.price || 0,
    seller: item.seller,
  }))
}
