// lib/catalog.ts

export type CatalogItem = {
  id: string;
  name: string;
  category: "Tables" | "Sofas" | "Chairs" | "Drawers";
  price: number;
  imagePath: string;
  dimensions: {
    w: number;
    d: number;
    h: number;
  };
  seller: string;
  views?: {
    front?: string;
    side?: string;
    back?: string;
    angle?: string;
  };
};

export const catalog: CatalogItem[] = [
  // Tables
  {
    id: "table-01",
    name: "Oak Dining Table",
    category: "Tables",
    price: 899,
    imagePath: "/images/skus/tables/table_01.png",
    dimensions: { w: 180, d: 90, h: 75 },
    seller: "Kelly Homes",
  },
  {
    id: "table-02",
    name: "Round Coffee Table",
    category: "Tables",
    price: 399,
    imagePath: "/images/skus/tables/table_02.png",
    dimensions: { w: 90, d: 90, h: 40 },
    seller: "Kelly Homes",
  },
  // Drawers
  {
    id: "drawer-01",
    name: "Compact 3-Drawer Unit",
    category: "Drawers",
    price: 549,
    imagePath: "/images/skus/drawers/drawer_01.png",
    dimensions: { w: 80, d: 45, h: 90 },
    seller: "Kelly Homes",
  },
  {
    id: "drawer-02",
    name: "Wide Chest of Drawers",
    category: "Drawers",
    price: 749,
    imagePath: "/images/skus/drawers/drawer_02.png",
    dimensions: { w: 120, d: 50, h: 85 },
    seller: "Kelly Homes",
  },
  // Chairs
  {
    id: "chair-01",
    name: "Accent Lounge Chair",
    category: "Chairs",
    price: 299,
    imagePath: "/images/skus/chairs/chair_01.png",
    dimensions: { w: 70, d: 75, h: 85 },
    seller: "Kelly Homes",
  },
  {
    id: "chair-02",
    name: "Minimal Dining Chair",
    category: "Chairs",
    price: 199,
    imagePath: "/images/skus/chairs/chair_02.png",
    dimensions: { w: 45, d: 50, h: 90 },
    seller: "Kelly Homes",
  },
  {
    id: "chair-03",
    name: "Leather Armchair",
    category: "Chairs",
    price: 649,
    imagePath: "/images/skus/chairs/chair_03.png",
    dimensions: { w: 85, d: 85, h: 95 },
    seller: "Kelly Homes",
  },
  // Sofas
  {
    id: "sofa-01",
    name: "2-Seater Fabric Sofa",
    category: "Sofas",
    price: 1099,
    imagePath: "/images/skus/sofas/sofa_01.png",
    dimensions: { w: 170, d: 90, h: 85 },
    seller: "Kelly Homes",
  },
  {
    id: "sofa-02",
    name: "3-Seater Modular Sofa",
    category: "Sofas",
    price: 1799,
    imagePath: "/images/skus/sofas/sofa_02.png",
    dimensions: { w: 240, d: 95, h: 80 },
    seller: "Kelly Homes",
  },
  {
    id: "sofa-03",
    name: "Corner Sectional Sofa",
    category: "Sofas",
    price: 2299,
    imagePath: "/images/skus/sofas/sofa_03.png",
    dimensions: { w: 280, d: 200, h: 85 },
    seller: "Kelly Homes",
  },
];

export function getCatalogItemById(id: string): CatalogItem | undefined {
  return catalog.find((item) => item.id === id);
}
