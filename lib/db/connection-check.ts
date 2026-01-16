/**
 * Check if an error is a database connection error
 */
export function isDatabaseConnectionError(error: any): boolean {
  if (!error) return false

  const errorMessage = String(error.message || "").toLowerCase()
  const errorName = String(error.name || "").toLowerCase()
  const errorCode = String(error.code || "").toLowerCase()

  // Check for PrismaClientInitializationError
  if (errorName.includes("prismaclientinitializationerror")) {
    return true
  }

  // Check for common connection error messages
  const connectionErrorPatterns = [
    "can't reach database server",
    "can't reach database",
    "connection refused",
    "connection timeout",
    "connection error",
    "database server",
    "p1001", // Prisma error code for connection issues
    "p1002", // Prisma error code for connection timeout
    "p1003", // Prisma error code for database not found
    "p1017", // Prisma error code for server closed connection
    "econnrefused",
    "etimedout",
    "enotfound",
    "neon",
    "postgres",
  ]

  return connectionErrorPatterns.some(
    (pattern) =>
      errorMessage.includes(pattern) ||
      errorCode.includes(pattern)
  )
}
