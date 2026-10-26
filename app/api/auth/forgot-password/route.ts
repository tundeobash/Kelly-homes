import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isValidEmail, normalizeEmail } from "@/lib/auth/signupPolicy"
import { MAX_RESET_EMAILS_PER_HOUR, appBaseUrl, newResetToken, resetEmail, resetLink } from "@/lib/auth/passwordReset"
import { emailConfigured, sendEmail } from "@/lib/email"

/**
 * Sends a "choose a new password" link. The answer is the same whether or not the email
 * has an account, so nobody can use this page to find out who has signed up.
 * Raw SQL for PasswordReset keeps this working where the Prisma client predates the table.
 */
export async function POST(request: Request) {
  let email = ""
  try {
    const body = await request.json()
    email = typeof body?.email === "string" ? normalizeEmail(body.email) : ""
  } catch {
    email = ""
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
  }

  if (!emailConfigured()) {
    console.error("[forgot-password] RESEND_API_KEY is not set, so no reset email can be sent")
    return NextResponse.json(
      { error: "Password reset by email isn't available right now.", unavailable: true },
      { status: 503 }
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, password: true },
    })

    if (user?.password) {
      const recent = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "PasswordReset"
        WHERE "userId" = ${user.id}
          AND "createdAt" > (now() AT TIME ZONE 'UTC') - interval '1 hour'`

      if ((recent[0]?.n ?? 0) < MAX_RESET_EMAILS_PER_HOUR) {
        const { token, tokenHash } = newResetToken()
        await prisma.$executeRaw`
          INSERT INTO "PasswordReset" ("id", "userId", "tokenHash", "expiresAt")
          VALUES (${randomUUID()}, ${user.id}, ${tokenHash}, (now() AT TIME ZONE 'UTC') + interval '1 hour')`

        const link = resetLink(appBaseUrl(process.env, request.url), token)
        const message = resetEmail({ name: user.name, link })
        try {
          await sendEmail({ to: email, ...message })
        } catch (error) {
          console.error("[forgot-password] Could not send the reset email", {
            error: error instanceof Error ? error.message : String(error),
          })
          return NextResponse.json(
            { error: "We couldn't send the email just now. Please try again in a few minutes." },
            { status: 502 }
          )
        }
      } else {
        console.log("[forgot-password] Hourly limit reached; no email sent")
      }
    }
  } catch (error) {
    console.error("[forgot-password] Error", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
