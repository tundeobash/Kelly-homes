import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    return NextResponse.json(cart)
  } catch (error) {
    console.error("Error fetching cart:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { furnitureItemId, quantity = 1 } = body

    if (!furnitureItemId) {
      return NextResponse.json(
        { error: "Furniture item ID is required" },
        { status: 400 }
      )
    }

    let cart = await prisma.cart.findUnique({
      where: { userId: session.user.id },
    })

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId: session.user.id,
        },
      })
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_furnitureItemId: {
          cartId: cart.id,
          furnitureItemId,
        },
      },
    })

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      })
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          furnitureItemId,
          quantity,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error adding to cart:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cartItemId = searchParams.get("cartItemId")

    if (!cartItemId) {
      return NextResponse.json(
        { error: "Cart item ID is required" },
        { status: 400 }
      )
    }

    await prisma.cartItem.delete({
      where: { id: cartItemId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing from cart:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

