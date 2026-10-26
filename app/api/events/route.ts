import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { getUserContext } from "@/lib/auth/getUserContext"
import { prisma } from "@/lib/prisma"
import { cleanProjectId, isTrackedEvent } from "@/lib/tracking"

/**
 * Records one tester action (see lib/tracking.ts). Signed-in people only.
 * "app_open" is kept once per person per day, counted in Gulf time (UTC+4).
 * Raw SQL keeps this working even where the Prisma client predates the table.
 */
export async function POST(request: Request) {
  const user = await getUserContext()
  if (!user) return new NextResponse(null, { status: 401 })

  let body: any = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const name = body?.name
  if (!isTrackedEvent(name)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 })
  }
  const projectId = cleanProjectId(body?.projectId)
  const id = randomUUID()

  try {
    if (name === "app_open") {
      await prisma.$executeRaw`
        INSERT INTO "ProductEvent" ("id", "userId", "name", "projectId")
        SELECT ${id}::text, ${user.userId}::text, ${name}::text, ${projectId}::text
        WHERE NOT EXISTS (
          SELECT 1 FROM "ProductEvent"
          WHERE "userId" = ${user.userId}
            AND "name" = 'app_open'
            AND date_trunc('day', "createdAt" + interval '4 hours')
              = date_trunc('day', (now() AT TIME ZONE 'UTC') + interval '4 hours')
        )`
    } else {
      await prisma.$executeRaw`
        INSERT INTO "ProductEvent" ("id", "userId", "name", "projectId")
        VALUES (${id}, ${user.userId}, ${name}, ${projectId})`
    }
  } catch (error) {
    console.error("[events] Could not record event", {
      name,
      error: error instanceof Error ? error.message : String(error),
    })
    return new NextResponse(null, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
