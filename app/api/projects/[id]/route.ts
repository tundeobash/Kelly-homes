import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { unlink } from "fs/promises"
import { join } from "path"
import { existsSync, readdirSync } from "fs"
import { getUserContext, DEV_MODE } from "@/lib/auth/getUserContext"
import { isDatabaseConnectionError } from "@/lib/db/connection-check"
import { normalizeProject } from "@/lib/api/normalize-project"
import { randomBytes } from "crypto"

// Generate a unique request ID for logging
function generateRequestId(): string {
  return `req_${Date.now()}_${randomBytes(4).toString("hex")}`
}

/**
 * Try to find a project image URL from saved uploads directory
 * Returns the first image found that might belong to this project
 */
function findProjectImageFromUploads(projectId: string): string | null {
  try {
    const uploadsDir = join(process.cwd(), "public", "uploads")
    if (!existsSync(uploadsDir)) {
      return null
    }

    const files = readdirSync(uploadsDir)
    // Look for image files (png, jpg, jpeg)
    const imageFiles = files.filter(
      (f) => f.match(/\.(png|jpg|jpeg)$/i) && !f.startsWith("design-")
    )

    if (imageFiles.length > 0) {
      // Return the most recent image file
      const sortedFiles = imageFiles.sort().reverse()
      return `/uploads/${sortedFiles[0]}`
    }
  } catch (error) {
    // Silently fail - this is a fallback
  }
  return null
}

/**
 * Create a minimal mock project for DEV_MODE fallback
 */
function createMockProject(projectId: string, userId: string): any {
  const imageUrl = findProjectImageFromUploads(projectId)
  
  return {
    id: projectId,
    userId,
    name: `Project ${projectId.substring(0, 8)}`,
    roomType: "living room",
    imageUrl: imageUrl || null,
    length: 12,
    width: 10,
    height: 9,
    aiDesignsJson: [],
    selectedAiDesignId: null,
    lastAiSettings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId()
  const { id } = await params
  
  try {
    const userContext = await getUserContext()
    if (!userContext) {
      console.error(`[API PROJECT] [${requestId}] Unauthorized: No user context`)
      return NextResponse.json(
        {
          error: "Unauthorized",
          requestId,
        },
        { status: 401 }
      )
    }

    const { userId, isDevMode } = userContext
    const projectId = id

    console.log(`[API PROJECT] [${requestId}] Fetch`, {
      projectId,
      userId,
      isDevMode,
    })

    try {
      const project = await prisma.roomProject.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          userId: true,
          name: true,
          roomType: true,
          imageUrl: true,
          length: true,
          width: true,
          height: true,
          aiDesignsJson: true,
          selectedAiDesignId: true,
          lastAiSettings: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      if (!project) {
        console.error(`[API PROJECT] [${requestId}] Project not found: ${projectId}`)
        return NextResponse.json(
          {
            error: "Project not found",
            requestId,
          },
          { status: 404 }
        )
      }

      if (project.userId !== userId) {
        console.error(`[API PROJECT] [${requestId}] Unauthorized access: ${projectId}`)
        return NextResponse.json(
          {
            error: "Unauthorized",
            requestId,
          },
          { status: 403 }
        )
      }

      const normalizedProject = normalizeProject(project)

      console.log(`[API PROJECT] [${requestId}] Success`, {
        projectId,
        fallbackUsed: false,
      })

      return NextResponse.json({
        ...normalizedProject,
        requestId,
        fallbackUsed: false,
      })
    } catch (prismaError: any) {
      // Check if this is a database connection error
      if (isDatabaseConnectionError(prismaError)) {
        if (DEV_MODE) {
          console.log(`[API PROJECT] [${requestId}] DB connection error, using fallback`)
          
          // Try to create a mock project
          const mockProject = createMockProject(projectId, userId)
          const normalizedProject = normalizeProject(mockProject)

          console.log(`[API PROJECT] [${requestId}] Success (fallback)`, {
            projectId,
            fallbackUsed: true,
            imageUrl: mockProject.imageUrl,
          })

          return NextResponse.json({
            ...normalizedProject,
            requestId,
            fallbackUsed: true,
          })
        } else {
          // In production, return 503 Service Unavailable
          console.error(`[API PROJECT] [${requestId}] Database unavailable (production)`)
          return NextResponse.json(
            {
              error: "Database unavailable",
              message: "The database server is currently unreachable. Please try again later.",
              requestId,
            },
            { status: 503 }
          )
        }
      }

      // For other Prisma errors, log and return error
      console.error(`[API PROJECT] [${requestId}] Error`, {
        projectId,
        message: prismaError.message,
        code: prismaError.code,
      })
      return NextResponse.json(
        {
          error: "Database error",
          message: prismaError.message || "Failed to fetch project",
          requestId,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error(`[API PROJECT] [${requestId}] Unhandled error:`, error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error.message || "An unexpected error occurred",
        requestId,
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await prisma.roomProject.findUnique({
      where: { id },
    })

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await request.json()
    const { styleId, imageUrl } = body

    const updateData: any = {}

    // Update imageUrl if provided
    if (imageUrl) {
      // Block blob URLs - never save them to database
      if (imageUrl.startsWith("blob:")) {
        return NextResponse.json(
          { error: "Invalid image URL. Please upload the image again." },
          { status: 400 }
        )
      }
      updateData.imageUrl = imageUrl
    }

    // Store styleId in project metadata (using a JSON field or adding to schema)
    // For now, we'll add it as a note in the name or create a separate field
    // Since schema doesn't have styleId, we'll update user preferences instead
    if (styleId) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      })

      if (user) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            preferredStyles: [...(user.preferredStyles || []), styleId],
          },
        })
      }
    }

    // Update project if there's data to update
    if (Object.keys(updateData).length > 0) {
      const updatedProject = await prisma.roomProject.update({
        where: { id },
        data: updateData,
      })

      if (process.env.NODE_ENV === "development") {
        console.log("[API PROJECTS PATCH] Updated project:", updatedProject.id)
        if (imageUrl) {
          console.log("[API PROJECTS PATCH] New imageUrl:", updatedProject.imageUrl)
        }
      }

      return NextResponse.json(updatedProject)
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await prisma.roomProject.findUnique({
      where: { id },
    })

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Attempt to delete associated image file if it's in /uploads/
    if (project.imageUrl && project.imageUrl.startsWith("/uploads/")) {
      try {
        const filename = project.imageUrl.replace("/uploads/", "")
        const filepath = join(process.cwd(), "public", "uploads", filename)
        if (existsSync(filepath)) {
          await unlink(filepath)
          if (process.env.NODE_ENV === "development") {
            console.log("[API PROJECTS DELETE] Deleted image file:", filepath)
          }
        }
      } catch (fileError) {
        // Best-effort: log but don't fail deletion if file removal fails
        console.error("[API PROJECTS DELETE] Failed to delete image file:", fileError)
      }
    }

    // Delete the project
    await prisma.roomProject.delete({
      where: { id },
    })

    if (process.env.NODE_ENV === "development") {
      console.log("[API PROJECTS DELETE] Deleted project:", id)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

