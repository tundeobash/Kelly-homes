export interface DesignStyle {
  id: string
  name: string
  description: string
  tags: string[]
  budgetLevel: "Low" | "Mid" | "High"
}

export const designStyles: DesignStyle[] = [
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Clean lines, neutral colors, and uncluttered spaces focused on simplicity.",
    tags: ["Simple", "Clean", "Neutral"],
    budgetLevel: "Mid",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Sleek, contemporary design with bold accents and geometric shapes.",
    tags: ["Contemporary", "Bold", "Geometric"],
    budgetLevel: "High",
  },
  {
    id: "contemporary",
    name: "Contemporary",
    description: "Current trends with a mix of styles, emphasizing comfort and functionality.",
    tags: ["Trendy", "Comfortable", "Functional"],
    budgetLevel: "Mid",
  },
  {
    id: "scandinavian",
    name: "Scandinavian",
    description: "Light colors, natural materials, and cozy hygge-inspired spaces.",
    tags: ["Light", "Natural", "Cozy"],
    budgetLevel: "Mid",
  },
  {
    id: "rustic",
    name: "Rustic",
    description: "Rough-hewn wood, stone, and natural textures create a warm, earthy feel.",
    tags: ["Wood", "Natural", "Warm"],
    budgetLevel: "Low",
  },
  {
    id: "industrial",
    name: "Industrial",
    description: "Exposed brick, metal fixtures, and raw materials with an urban edge.",
    tags: ["Urban", "Metal", "Raw"],
    budgetLevel: "Mid",
  },
  {
    id: "mid-century-modern",
    name: "Mid-Century Modern",
    description: "Retro-inspired furniture with clean lines and organic curves from the 1950s-60s.",
    tags: ["Retro", "Organic", "Vintage"],
    budgetLevel: "High",
  },
  {
    id: "bohemian",
    name: "Bohemian",
    description: "Eclectic mix of patterns, colors, and textures with a free-spirited vibe.",
    tags: ["Eclectic", "Colorful", "Free-spirited"],
    budgetLevel: "Low",
  },
  {
    id: "japandi",
    name: "Japandi",
    description: "Japanese minimalism meets Scandinavian coziness for balanced serenity.",
    tags: ["Minimal", "Serene", "Balanced"],
    budgetLevel: "High",
  },
  {
    id: "mediterranean",
    name: "Mediterranean",
    description: "Warm earth tones, terracotta, and ornate details inspired by coastal Europe.",
    tags: ["Warm", "Ornate", "Coastal"],
    budgetLevel: "Mid",
  },
  {
    id: "coastal",
    name: "Coastal",
    description: "Light blues, whites, and natural textures evoke beachside living.",
    tags: ["Beach", "Light", "Airy"],
    budgetLevel: "Mid",
  },
  {
    id: "farmhouse",
    name: "Farmhouse",
    description: "Rustic charm with shiplap, barn doors, and vintage farmhouse elements.",
    tags: ["Rustic", "Charming", "Vintage"],
    budgetLevel: "Low",
  },
  {
    id: "transitional",
    name: "Transitional",
    description: "Blend of traditional and contemporary styles for timeless elegance.",
    tags: ["Timeless", "Elegant", "Blended"],
    budgetLevel: "High",
  },
  {
    id: "art-deco",
    name: "Art Deco",
    description: "Bold geometric patterns, rich colors, and luxurious materials from the 1920s.",
    tags: ["Luxurious", "Geometric", "Bold"],
    budgetLevel: "High",
  },
  {
    id: "wabi-sabi",
    name: "Wabi-Sabi",
    description: "Japanese philosophy embracing imperfection, simplicity, and natural beauty.",
    tags: ["Imperfect", "Natural", "Philosophical"],
    budgetLevel: "Mid",
  },
  {
    id: "tropical-modern",
    name: "Tropical Modern",
    description: "Modern design with tropical elements, lush plants, and vibrant colors.",
    tags: ["Tropical", "Lush", "Vibrant"],
    budgetLevel: "Mid",
  },
]

