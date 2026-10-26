import { redirect } from "next/navigation"
import { showUnfinished } from "@/lib/unfinished"

/** The old galleries page; each room's design screen now shows and compares its designs. Sends people to their rooms unless unfinished features are switched on. */
export default function GalleriesLayout({ children }: { children: React.ReactNode }) {
  if (!showUnfinished()) redirect("/profile/me")
  return <>{children}</>
}
