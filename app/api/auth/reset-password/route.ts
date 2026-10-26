import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { RESET_LINK_INVALID, hashResetToken, isWellFormedResetToken } from "@/lib/auth/passwordReset"
import { passwordProblem } from "@/lib/auth/passwordRules"

/**
 * Sets a new password from a reset link. The link is claimed before the password changes,
 * so it can only ever be used once; any other open links for the account stop working too.
 */
export async function POST(request: Request) {
  let body: any = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const token = body?.token
  if (!isWellFormedResetToken(token)) {
    return NextResponse.json({ error: RESET_LINK_INVALID, linkInvalid: true }, { status: 400 })
  }
  const problem = passwordProblem(body?.password)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })
  const password: string = body.password

  try {
    const rows = await prisma.$queryRaw<{ id: string; userId: string }[]>`
      SELECT "id", "userId" FROM "PasswordReset"
      WHERE "tokenHash" = ${hashResetToken(token)}
        AND "usedAt" IS NULL
        AND "expiresAt" > (now() AT TIME ZONE 'UTC')
      LIMIT 1`
    const link = rows[0]
    if (!link) return NextResponse.json({ error: RESET_LINK_INVALID, linkInvalid: true }, { status: 400 })

    const claimed = await prisma.$executeRaw`
      UPDATE "PasswordReset" SET "usedAt" = (now() AT TIME ZONE 'UTC')
      WHERE "id" = ${link.id} AND "usedAt" IS NULL`
    if (claimed !== 1) return NextResponse.json({ error: RESET_LINK_INVALID, linkInvalid: true }, { status: 400 })

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.update({
      where: { id: link.userId },
      data: { password: hashed },
      select: { email: true },
    })

    await prisma.$executeRaw`
      UPDATE "PasswordReset" SET "usedAt" = (now() AT TIME ZONE 'UTC')
      WHERE "userId" = ${link.userId} AND "usedAt" IS NULL`

    return NextResponse.json({ ok: true, email: user.email })
  } catch (error) {
    console.error("[reset-password] Error", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
