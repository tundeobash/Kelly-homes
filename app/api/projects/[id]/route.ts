import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { unlink } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

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
        where: { id: params.id },
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
      where: { id: params.id },
    })

    if (process.env.NODE_ENV === "development") {
      console.log("[API PROJECTS DELETE] Deleted project:", params.id)
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

