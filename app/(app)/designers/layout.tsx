import { notFound } from "next/navigation"
import { showUnfinished } from "@/lib/unfinished"

/** The designer directory is a mock-up; hidden unless unfinished features are switched on (lib/unfinished.ts). */
export default function DesignersLayout({ children }: { children: React.ReactNode }) {
  if (!showUnfinished()) notFound()
  return <>{children}</>
}
