import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed Furniture Items
  const furnitureItems = [
    {
      name: 'Modern Sofa - Gray',
      description: 'Comfortable 3-seater sofa in modern gray fabric',
      price: 899.99,
      dimensions: { length: 7.5, width: 3.0, height: 2.5 },
      styleTags: ['Modern', 'Minimal'],
      seller: 'IKEA',
      imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
      category: 'sofa',
    },
    {
      name: 'Scandinavian Coffee Table',
      description: 'Light wood coffee table with clean lines',
      price: 299.99,
      dimensions: { length: 4.0, width: 2.0, height: 1.5 },
      styleTags: ['Scandinavian', 'Minimal'],
      seller: 'IKEA',
      imageUrl: 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=800',
      category: 'table',
    },
    {
      name: 'Minimalist Armchair',
      description: 'Elegant armchair with wooden legs',
      price: 449.99,
      dimensions: { length: 2.5, width: 2.5, height: 3.0 },
      styleTags: ['Minimal', 'Modern'],
      seller: 'Home Center',
      imageUrl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800',
      category: 'chair',
    },
    {
      name: 'Vintage Bookshelf',
      description: 'Tall wooden bookshelf with multiple shelves',
      price: 599.99,
      dimensions: { length: 3.0, width: 1.0, height: 6.0 },
      styleTags: ['Vintage', 'Traditional'],
      seller: 'Etsy',
      imageUrl: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=800',
      category: 'shelf',
    },
    {
      name: 'Modern Bed Frame - Queen',
      description: 'Platform bed frame with headboard',
      price: 1299.99,
      dimensions: { length: 6.5, width: 5.0, height: 2.0 },
      styleTags: ['Modern', 'Minimal'],
      seller: 'IKEA',
      imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
      category: 'bed',
    },
    {
      name: 'Scandinavian Dining Table',
      description: 'Large dining table seating 6',
      price: 799.99,
      dimensions: { length: 7.0, width: 3.5, height: 2.8 },
      styleTags: ['Scandinavian', 'Minimal'],
      seller: 'IKEA',
      imageUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=800',
      category: 'table',
    },
    {
      name: 'Office Desk - White',
      description: 'Minimalist desk with drawer',
      price: 399.99,
      dimensions: { length: 5.0, width: 2.5, height: 2.5 },
      styleTags: ['Modern', 'Minimal'],
      seller: 'Home Center',
      imageUrl: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800',
      category: 'desk',
    },
    {
      name: 'Ergonomic Office Chair',
      description: 'Comfortable office chair with lumbar support',
      price: 349.99,
      dimensions: { length: 2.0, width: 2.0, height: 4.0 },
      styleTags: ['Modern'],
      seller: 'Home Center',
      imageUrl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800',
      category: 'chair',
    },
    {
      name: 'Modern TV Stand',
      description: 'Low profile TV stand with storage',
      price: 499.99,
      dimensions: { length: 6.0, width: 1.5, height: 1.8 },
      styleTags: ['Modern', 'Minimal'],
      seller: 'IKEA',
      imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800',
      category: 'stand',
    },
    {
      name: 'Scandinavian Floor Lamp',
      description: 'Tall floor lamp with fabric shade',
      price: 149.99,
      dimensions: { length: 1.0, width: 1.0, height: 5.5 },
      styleTags: ['Scandinavian', 'Minimal'],
      seller: 'Etsy',
      imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800',
      category: 'lamp',
    },
    {
      name: 'Minimalist Side Table',
      description: 'Small side table with metal legs',
      price: 199.99,
      dimensions: { length: 2.0, width: 2.0, height: 1.8 },
      styleTags: ['Minimal', 'Modern'],
      seller: 'Home Center',
      imageUrl: 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=800',
      category: 'table',
    },
    {
      name: 'Vintage Area Rug',
      description: 'Large area rug with geometric pattern',
      price: 399.99,
      dimensions: { length: 8.0, width: 6.0, height: 0.1 },
      styleTags: ['Vintage', 'Traditional'],
      seller: 'Etsy',
      imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800',
      category: 'rug',
    },
  ]

  // Create furniture items and store their IDs
  const createdItems = []
  for (const item of furnitureItems) {
    const created = await prisma.furnitureItem.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    })
    createdItems.push(created)
  }

  // Seed Designers
  const designers = [
    {
      name: 'Emma Modern',
      bio: 'Specializing in modern minimalist interiors with clean lines and neutral palettes.',
      style: 'Modern',
      imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      curatedSets: [
        [createdItems[0].id, createdItems[1].id, createdItems[2].id], // Modern living room
        [createdItems[4].id, createdItems[10].id], // Modern bedroom
      ],
    },
    {
      name: 'Lars Scandinavian',
      bio: 'Bringing Nordic design principles to create cozy, functional spaces.',
      style: 'Scandinavian',
      imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      curatedSets: [
        [createdItems[1].id, createdItems[5].id, createdItems[9].id], // Scandinavian dining
        [createdItems[0].id, createdItems[1].id, createdItems[9].id], // Scandinavian living
      ],
    },
    {
      name: 'Sophie Minimal',
      bio: 'Less is more. Creating serene spaces with essential pieces only.',
      style: 'Minimal',
      imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
      curatedSets: [
        [createdItems[2].id, createdItems[10].id], // Minimal living
        [createdItems[6].id, createdItems[7].id], // Minimal office
      ],
    },
  ]

  for (const designer of designers) {
    await prisma.designer.upsert({
      where: { name: designer.name },
      update: {},
      create: designer,
    })
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

