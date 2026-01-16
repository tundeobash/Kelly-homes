import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isDatabaseConnectionError } from "@/lib/db/connection-check"

export const MOCK_USER_ID = "dev-user-001"
export const DEV_MODE = process.env.DEV_MODE !== "false" && process.env.NODE_ENV === "development"

let cachedDevUserId: string | null = null
let devUserIdResolved = false

export interface UserContext {
  userId: string
  isDevMode: boolean
  fallbackUsed?: boolean
}

export async function getUserContext(): Promise<UserContext | null> {
  if (DEV_MODE) {
    // Prioritize explicit DEV_USER_ID from environment
    const explicitDevUserId = process.env.DEV_USER_ID
    if (explicitDevUserId) {
      if (process.env.NODE_ENV === "development") {
        console.log("[getUserContext] DEV_MODE: Using explicit DEV_USER_ID", explicitDevUserId)
      }
      cachedDevUserId = explicitDevUserId
      return {
        userId: explicitDevUserId,
        isDevMode: true,
        fallbackUsed: false,
      }
    }

    if (cachedDevUserId) {
      if (process.env.NODE_ENV === "development") {
        console.log("[getUserContext] DEV_MODE: Using cached dev userId", cachedDevUserId)
      }
      return {
        userId: cachedDevUserId,
        isDevMode: true,
        fallbackUsed: cachedDevUserId !== MOCK_USER_ID,
      }
    }

    if (!devUserIdResolved) {
      devUserIdResolved = true
      try {
        const projectCount = await prisma.roomProject.count({
          where: { userId: MOCK_USER_ID },
        })

        if (projectCount > 0) {
          cachedDevUserId = MOCK_USER_ID
          if (process.env.NODE_ENV === "development") {
            console.log("[getUserContext] DEV_MODE: Using mock user ID", MOCK_USER_ID, `(${projectCount} projects)`)
          }
          return {
            userId: MOCK_USER_ID,
            isDevMode: true,
            fallbackUsed: false,
          }
        }

        const userWithProjects = await prisma.roomProject.groupBy({
          by: ["userId"],
          _count: {
            userId: true,
          },
          orderBy: {
            _count: {
              userId: "desc",
            },
          },
          take: 1,
        })

        if (userWithProjects.length > 0 && userWithProjects[0].userId) {
          const fallbackUserId = userWithProjects[0].userId
          const fallbackCount = userWithProjects[0]._count.userId
          cachedDevUserId = fallbackUserId
          console.log("[DEV_MODE] Auto-selected existing userId:", fallbackUserId, `(${fallbackCount} projects)`)
          return {
            userId: fallbackUserId,
            isDevMode: true,
            fallbackUsed: true,
          }
        }

        cachedDevUserId = MOCK_USER_ID
        if (process.env.NODE_ENV === "development") {
          console.log("[getUserContext] DEV_MODE: No projects found, using mock user ID", MOCK_USER_ID)
        }
        return {
          userId: MOCK_USER_ID,
          isDevMode: true,
          fallbackUsed: false,
        }
      } catch (error) {
        // Check if this is a database connection error
        if (isDatabaseConnectionError(error)) {
          console.log("[DB FALLBACK] Using mock user context due to DB connection error")
          cachedDevUserId = MOCK_USER_ID
          return {
            userId: MOCK_USER_ID,
            isDevMode: true,
            fallbackUsed: true,
          }
        }
        // For other errors, log and still use fallback
        console.error("[getUserContext] DEV_MODE: Error checking projects, using mock user ID", error)
        cachedDevUserId = MOCK_USER_ID
        return {
          userId: MOCK_USER_ID,
          isDevMode: true,
          fallbackUsed: false,
        }
      }
    }
    cachedDevUserId = MOCK_USER_ID
    return {
      userId: MOCK_USER_ID,
      isDevMode: true,
      fallbackUsed: false,
    }
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }
  return {
    userId: session.user.id,
    isDevMode: false,
  }
}
