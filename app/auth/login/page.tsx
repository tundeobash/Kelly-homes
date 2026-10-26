import { redirect } from "next/navigation"

/** Old address; sign-in lives at /auth. */
export default function LoginPage() {
  redirect("/auth")
}
