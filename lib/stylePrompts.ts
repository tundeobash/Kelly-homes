// lib/stylePrompts.ts
// Style cards: short, specific descriptions that every image model receives word for word.
// Source of truth: the "Style cards" tab in the Kelly Spaces Baseline Review doc.
// Keep each field short. Diffusion models read only the start of a long prompt.

export interface StyleCard {
  id: string
  name: string
  colours: string
  materials: string
  furniture: string
  decor: string
  avoid: string
}

const CARDS: StyleCard[] = [
  {
    id: "minimalist",
    name: "Minimalist",
    colours: "white, warm white, light grey, soft beige",
    materials: "pale oak or ash, linen, matte stone",
    furniture: "few low, clean-lined pieces; slim legs; plain upholstery",
    decor: "one artwork, one sculptural plant, bare surfaces",
    avoid: "clutter, patterns, ornate or dark heavy wood",
  },
  {
    id: "modern",
    name: "Modern",
    colours: "white, charcoal, black, one bold accent such as cognac or deep blue",
    materials: "lacquer, glass, chrome or black metal, leather",
    furniture: "geometric shapes, low sofas, sleek tables, statement lighting",
    decor: "large abstract art, few objects",
    avoid: "carving, rustic wood, floral patterns",
  },
  {
    id: "contemporary",
    name: "Contemporary",
    colours: "greige, taupe, soft white, muted sage or navy",
    materials: "mixed woods, bouclé, brushed brass, marble",
    furniture: "curved sofas, rounded edges, mixed textures",
    decor: "layered textiles, sculptural lamps, a few books",
    avoid: "brown leather, cherry wood, heavy drapes",
  },
  {
    id: "scandinavian",
    name: "Scandinavian",
    colours: "white, pale grey, light birch, soft blue or blush",
    materials: "light birch or ash, wool, linen, sheepskin",
    furniture: "simple tapered legs, light wood frames, cosy fabric",
    decor: "knit throws, simple pendant, plants, a few prints",
    avoid: "dark wood, orange pine, glossy finishes, clutter",
  },
  {
    id: "rustic",
    name: "Rustic",
    colours: "warm browns, cream, forest green, rust",
    materials: "reclaimed wood, stone, iron, leather, wool",
    furniture: "chunky wood with visible grain, leather armchairs",
    decor: "woven baskets, lanterns, wool throws",
    avoid: "chrome, glossy lacquer, sleek modern pieces",
  },
  {
    id: "industrial",
    name: "Industrial",
    colours: "charcoal, black, concrete grey, cognac",
    materials: "blackened steel, raw concrete, reclaimed wood, worn leather",
    furniture: "metal frames, leather sofa, factory-style stools",
    decor: "exposed-bulb lights, metal shelving, vintage prints",
    avoid: "pastels, ornate details, floral fabric",
  },
  {
    id: "mid-century-modern",
    name: "Mid-century modern",
    colours: "walnut, mustard, teal, burnt orange, cream",
    materials: "walnut and teak, wool, moulded plywood, brass",
    furniture: "tapered splayed legs, long low sideboard, classic lounge chair",
    decor: "sunburst mirror, globe pendant, graphic prints",
    avoid: "heavy traditional or overstuffed furniture",
  },
  {
    id: "bohemian",
    name: "Bohemian",
    colours: "terracotta, mustard, deep teal, rust, ivory",
    materials: "rattan, jute, macramé, kilim wool, carved wood",
    furniture: "low seating, floor cushions, rattan chairs",
    decor: "layered rugs, many plants, patterned textiles",
    avoid: "sterile minimalism, chrome, matching sets",
  },
  {
    id: "japandi",
    name: "Japandi",
    colours: "oatmeal, stone, warm grey, charcoal accents",
    materials: "pale oak or ash, linen, paper, clay, bamboo",
    furniture: "low platform bed or sofa, simple joinery, low tables",
    decor: "paper lantern, ceramic vase with one branch, very few objects",
    avoid: "orange pine, glossy wood, bright colours, clutter",
  },
  {
    id: "mediterranean",
    name: "Mediterranean",
    colours: "whitewash, terracotta, olive, Aegean blue, sand",
    materials: "limewash plaster, terracotta, wrought iron, rattan, linen",
    furniture: "arched shapes, rustic wood tables, slipcovered sofas",
    decor: "ceramic pots, olive trees, woven baskets",
    avoid: "high gloss, cold grey, sleek chrome",
  },
  {
    id: "coastal",
    name: "Coastal",
    colours: "white, sand, soft blue, seafoam",
    materials: "whitewashed wood, rattan, cotton, jute",
    furniture: "slipcovered sofas, light wood, wicker chairs",
    decor: "striped textiles, driftwood, glass jars, large plants",
    avoid: "dark heavy wood, anchor and shell kitsch, velvet",
  },
  {
    id: "farmhouse",
    name: "Farmhouse",
    colours: "white, cream, soft black, sage, warm wood",
    materials: "distressed wood, shiplap, galvanised metal, linen",
    furniture: "farmhouse table, cross-back chairs, slipcovered sofa",
    decor: "vintage jugs, baskets, simple greenery",
    avoid: "chrome, high gloss, ultra-modern pieces",
  },
  {
    id: "transitional",
    name: "Transitional",
    colours: "warm white, greige, navy, soft taupe",
    materials: "painted wood, linen, velvet, brushed nickel",
    furniture: "classic shapes with simple lines, tailored upholstery",
    decor: "framed art, paired table lamps, few accessories",
    avoid: "extreme minimalism, heavy ornament, distressed rustic",
  },
  {
    id: "art-deco",
    name: "Art Deco",
    colours: "black, ivory, emerald, deep navy, gold",
    materials: "velvet, lacquer, marble, brass, mirrored glass",
    furniture: "curved sofas, fluted details, geometric forms",
    decor: "sunburst mirror, geometric rug, sculptural lamps",
    avoid: "rustic wood, country pastels, clutter",
  },
  {
    id: "wabi-sabi",
    name: "Wabi-sabi",
    colours: "earthy beige, clay, warm grey, muted brown",
    materials: "raw wood, limewash, stone, linen, handmade ceramics",
    furniture: "low, simple, slightly irregular forms",
    decor: "imperfect pottery, dried branches, very few objects",
    avoid: "shiny surfaces, perfect symmetry, bright colours",
  },
  {
    id: "tropical-modern",
    name: "Tropical modern",
    colours: "white, warm teak, deep green, natural stone",
    materials: "teak, rattan, stone, linen",
    furniture: "low lounge pieces, cane chairs, open frames",
    decor: "large palms, woven pendants",
    avoid: "heavy dark upholstery, cold grey, kitsch prints",
  },
  {
    id: "modern-arabic",
    name: "Modern Arabic",
    colours: "ivory, sand, warm gold, deep teal or burgundy accents",
    materials: "wood with carved geometric patterns, brass, marble, velvet",
    furniture: "low wide sofas, side tables with mashrabiya-style detail",
    decor: "brass lanterns, geometric screens, calligraphy art",
    avoid: "kitsch, heavy clutter, cartoonish motifs",
  },
  {
    id: "contemporary-majlis",
    name: "Contemporary majlis",
    colours: "cream, taupe, soft gold, muted olive",
    materials: "plush upholstery, wool rugs, brushed brass, walnut",
    furniture: "long low seating along the walls, floor cushions, low central tables",
    decor: "large rug, mabkhara incense burner, dallah coffee set, cushions",
    avoid: "Western sectional sofas, bar stools, clutter",
  },
  {
    id: "warm-modern-luxury",
    name: "Warm modern luxury",
    colours: "cream, champagne, warm taupe, soft caramel",
    materials: "marble, bouclé, velvet, brushed brass, walnut",
    furniture: "curved sofas, sculptural coffee tables, upholstered chairs",
    decor: "statement chandelier, large mirror, coffee-table books",
    avoid: "cheap shine, too much mirrored glass, clutter",
  },
]

export const STYLE_CARDS: Record<string, StyleCard> = Object.fromEntries(CARDS.map((card) => [card.id, card]))

export function getStyleCard(style: string | null | undefined): StyleCard | null {
  const key = (style || "").trim().toLowerCase()
  return STYLE_CARDS[key] ?? null
}

export function styleCardText(card: StyleCard): string {
  return `Colours: ${card.colours}. Materials: ${card.materials}. Furniture: ${card.furniture}. Decor: ${card.decor}.`
}

/**
 * Positive and negative prompt for diffusion models (the older Stability path).
 * Short on purpose: these models stop reading partway through long prompts.
 */
export function getStylePrompt(style: string | null | undefined): { positive: string; negative: string } | null {
  const card = getStyleCard(style)
  if (!card) return null
  return {
    positive: `Furnish this room in ${card.name} style. ${styleCardText(card)} Keep the same room layout, architecture and camera angle. Photorealistic, realistic shadows and materials.`,
    negative: `${card.avoid}, warped geometry, extra windows or doors, cartoon or stylised rendering, text, logos, watermarks`,
  }
}
