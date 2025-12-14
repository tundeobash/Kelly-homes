import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { items, totalAmount, commission } = body

    if (!items || !totalAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // TODO: Integrate with real payment processing (Stripe)
    // TODO: Notify seller APIs about the order
    // TODO: Track commissions in seller dashboard

    const order = await prisma.order.create({
      data: {
        userId: session.user.id,
        totalAmount: parseFloat(totalAmount),
        commission: commission ? parseFloat(commission) : null,
        status: "completed", // Mock: always completed
        items: {
          create: items.map((item: any) => ({
            furnitureItemId: item.furnitureItemId,
            quantity: item.quantity,
            price: item.price,
            commission: item.commission || null,
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

    // Clear cart
    const cart = await prisma.cart.findUnique({
      where: { userId: session.user.id },
    })

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      })
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error("Error creating order:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

