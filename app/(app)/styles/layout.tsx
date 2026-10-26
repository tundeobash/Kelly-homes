import { redirect } from "next/navigation"
import { showUnfinished } from "@/lib/unfinished"

/** The old styles page; styles are chosen on each room's design screen. Sends people to their rooms unless unfinished features are switched on. */
export default function StylesLayout({ children }: { children: React.ReactNode }) {
  if (!showUnfinished()) redirect("/profile/me")
  return <>{children}</>
}
