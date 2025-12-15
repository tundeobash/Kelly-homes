import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "@/app/globals.css"

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-stitch",
})

export const metadata: Metadata = {
  title: "Kelly Homes - Interior Design",
  description: "Transform your space with AI-powered interior design recommendations",
}

export default function StitchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light">
      <body
        className={`${plusJakartaSans.variable} font-display bg-background-light dark:bg-background-dark text-[#0e1b12] dark:text-white transition-colors duration-200`}
      >
        {children}
      </body>
    </html>
  )
}

