# Kelly Homes - Interior Design Web Application

A minimal but extensible interior design web application that allows users to upload room photos, receive furniture recommendations, visualize layouts, and purchase items.

## Features

- User Authentication & Profiles
- Room Image Upload
- Room Understanding (manual input)
- Furniture Catalog with Search & Filters
- Design Recommendation Engine (rule-based MVP)
- Visual Layout Preview (2.5D canvas-based)
- Shopping Cart & Mock Checkout
- Interior Designer Profiles

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: Shadcn UI
- **State Management**: React Context / Zustand
- **Database**: PostgreSQL (via Prisma)
- **Auth**: NextAuth
- **Canvas Rendering**: Konva.js (AR-ready)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Update `.env` with your database URL and NextAuth secret.

3. Set up the database:
```bash
npx prisma db push
npx prisma db seed
```

4. Run the development server:
```bash
npm run dev
```

## Project Structure

- `/app` - Next.js App Router pages and API routes
- `/components` - React components
- `/lib` - Utilities, Prisma client, recommendation engine
- `/prisma` - Database schema and seed data

## Key Integration Points

### AR SDK Integration
- Location: `components/RoomPreview.tsx`
- TODO: Replace canvas-based preview with AR.js, 8th Wall, or WebXR

### Seller API Integration
- Location: `lib/recommendation-engine.ts` - `getRealTimeInventory()`
- TODO: Integrate with real seller APIs (IKEA, Etsy, etc.) for inventory and pricing

### Payment Processing
- Location: `app/api/orders/route.ts`
- TODO: Replace mock checkout with real Stripe integration

### Commission Tracking
- Location: `lib/recommendation-engine.ts` - `calculateCommission()`
- TODO: Integrate with seller commission tracking systems

## Database Models

- User
- RoomProject
- FurnitureItem
- Designer
- Cart / CartItem
- Order / OrderItem
- Recommendation / RecommendationItem

## Development

- Database Studio: `npm run db:studio`
- Seed Database: `npm run db:seed`

