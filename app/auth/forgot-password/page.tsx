import { redirect } from "next/navigation"

/** No reset email exists yet; the sign-in page offers "Ask us to reset it" instead. */
export default function ForgotPasswordPage() {
  redirect("/auth")
}
