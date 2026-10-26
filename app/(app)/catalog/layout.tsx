import { notFound } from "next/navigation"
import { showUnfinished } from "@/lib/unfinished"

/** The furniture catalogue is a mock-up; hidden unless unfinished features are switched on (lib/unfinished.ts). */
export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  if (!showUnfinished()) notFound()
  return <>{children}</>
}
