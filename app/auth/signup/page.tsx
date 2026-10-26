import { redirect } from "next/navigation"

/** Old address; sign-up lives at /auth?mode=signup. */
export default function SignupPage() {
  redirect("/auth?mode=signup")
}
