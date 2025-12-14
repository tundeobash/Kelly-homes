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
    const { preferredStyles } = body

    if (!Array.isArray(preferredStyles)) {
      return NextResponse.json(
        { error: "preferredStyles must be an array" },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferredStyles,
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error("Error updating preferences:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

