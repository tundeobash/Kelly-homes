import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserContext } from "@/lib/auth/getUserContext"
import { normalizeProject } from "@/lib/api/normalize-project"
import { isDatabaseConnectionError } from "@/lib/db/connection-check"
import { DEV_MODE } from "@/lib/auth/getUserContext"

export async function GET() {
  try {
    const userContext = await getUserContext()

    if (!userContext) {
      console.error("[API PROJECTS] No user context found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId, isDevMode, fallbackUsed } = userContext

    if (process.env.NODE_ENV === "development") {
      console.log("[API PROJECTS] Fetching projects", {
        userId,
        isDevMode,
        fallbackUsed: fallbackUsed || false
      })
    }

    try {
      const projects = await prisma.roomProject.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          roomType: true,
          selectedAiDesignId: true,
          aiDesignsJson: true,
          lastAiSettings: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      })

      const normalizedProjects = projects.map(normalizeProject)

      if (process.env.NODE_ENV === "development") {
        const totalDesigns = normalizedProjects.reduce((sum, p) => sum + (p.aiDesigns?.length || 0), 0)
        console.log("[API PROJECTS] Success", {
          count: normalizedProjects.length,
          totalDesigns,
          userId,
          isDevMode,
          fallbackUsed: fallbackUsed || false
        })
      }
      return NextResponse.json({ projects: normalizedProjects })
    } catch (prismaError: any) {
      // Check if this is a database connection error
      if (isDatabaseConnectionError(prismaError)) {
        if (DEV_MODE) {
          console.log("[DB FALLBACK] Using mock projects due to DB connection error")
          return NextResponse.json({
            projects: [],
            count: 0,
            totalDesigns: 0,
            fallbackUsed: true,
          })
        } else {
          // In production, return 503 Service Unavailable
          return NextResponse.json(
            {
              error: "Database temporarily unavailable",
              message: "The database server is currently unreachable. Please try again later.",
              projects: [],
            },
            { status: 503 }
          )
        }
      }

      // For other Prisma errors, log and return error
      console.error("[API PROJECTS] Prisma error:", prismaError)
      if (process.env.NODE_ENV === "development") {
        console.error("[API PROJECTS] Error details:", {
          code: prismaError.code,
          message: prismaError.message,
          userId,
          isDevMode,
        })
      }
      return NextResponse.json(
        { error: "Database error", projects: [] },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("[API PROJECTS] Unhandled error:", error)
    return NextResponse.json(
      { error: "Internal server error", projects: [] },
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
    const { name, roomType, imageUrl } = body

    if (!name || !roomType || !imageUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Block blob URLs - never save them to database
    if (imageUrl.startsWith("blob:")) {
      return NextResponse.json(
        { error: "Invalid image URL. Please upload the image again." },
        { status: 400 }
      )
    }

    const project = await prisma.roomProject.create({
      data: {
        userId: session.user.id,
        name,
        roomType,
        length: 0,
        width: 0,
        height: 0,
        imageUrl,
      },
    })

    if (process.env.NODE_ENV === "development") {
      console.log("[API PROJECTS] Created project:", project.id)
      console.log("[API PROJECTS] Stored imageUrl:", project.imageUrl)
    }

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

