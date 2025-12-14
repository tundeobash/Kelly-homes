import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import CheckoutClient from "@/components/CheckoutClient"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  let cart = await prisma.cart.findUnique({
    where: { userId: session.user.id },
    include: {
      items: {
        include: {
          furnitureItem: true,
        },
      },
    },
  })

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        userId: session.user.id,
      },
      include: {
        items: {
          include: {
            furnitureItem: true,
          },
        },
      },
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold">Kelly Homes</h1>
          </Link>
          <div className="flex gap-4">
            <Link href="/catalog">
              <Button variant="ghost">Continue Shopping</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <CheckoutClient cart={cart} />
      </main>
    </div>
  )
}

