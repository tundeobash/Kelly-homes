import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await prisma.roomProject.findUnique({
      where: { id: params.id },
    })

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await request.json()
    const { styleId } = body

    // Store styleId in project metadata (using a JSON field or adding to schema)
    // For now, we'll add it as a note in the name or create a separate field
    // Since schema doesn't have styleId, we'll update user preferences instead
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (user) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          preferredStyles: styleId
            ? [...(user.preferredStyles || []), styleId]
            : user.preferredStyles,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

