import { notFound } from "next/navigation"
import { showUnfinished } from "@/lib/unfinished"

/** Cart and checkout (no payment is taken) is a mock-up; hidden unless unfinished features are switched on (lib/unfinished.ts). */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  if (!showUnfinished()) notFound()
  return <>{children}</>
}
