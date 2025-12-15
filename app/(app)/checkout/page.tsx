import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import CheckoutClient from "@/components/CheckoutClient"

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

  return <CheckoutClient cart={cart} />
}

