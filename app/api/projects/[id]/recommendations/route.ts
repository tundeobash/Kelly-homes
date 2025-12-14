import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateRecommendation } from "@/lib/recommendation-engine"

export async function POST(
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
      include: { user: true },
    })

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await request.json()
    const { stylePreference, budgetMax, designerId } = body

    const recommendation = await generateRecommendation({
      project,
      stylePreference,
      budgetMax,
      designerId,
    })

    return NextResponse.json(recommendation, { status: 201 })
  } catch (error) {
    console.error("Error generating recommendation:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

