// TODO: Replace placeholder restored after recovery
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const DEV_MODE = process.env.DEV_MODE !== "false" && process.env.NODE_ENV === "development"

export const MOCK_USER_ID = "dev-user-001"

/**
 * Check if the app is running in development mode
 */
export function isDevMode(): boolean {
  return DEV_MODE
}

/**
 * Get the mock user ID for development
 */
export function getMockUserId(): string {
  return MOCK_USER_ID
}

/**
 * Get session (for compatibility with existing code)
 */
export async function getSession() {
  return await getServerSession(authOptions)
}
