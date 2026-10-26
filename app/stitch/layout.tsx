import { notFound } from "next/navigation"
import { showUnfinished } from "@/lib/unfinished"
import { Plus_Jakarta_Sans } from "next/font/google"

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-stitch",
})

export default function StitchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Leftover test page, hidden unless unfinished features are switched on
  if (!showUnfinished()) notFound()
  return (
    <div
      className={`${plusJakartaSans.variable} font-display bg-background-light dark:bg-background-dark text-[#0e1b12] dark:text-white transition-colors duration-200 min-h-screen`}
    >
      {children}
    </div>
  )
}

