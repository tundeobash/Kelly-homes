import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Kelly Spaces · See your room redesigned",
  description:
    "Take a photo of your room, pick a style, and see it furnished in under a minute. Your walls, windows and doors stay as they are.",
  // The preview card shown when the invite link is shared on WhatsApp.
  openGraph: {
    type: "website",
    siteName: "Kelly Spaces",
    title: "Kelly Spaces · See your room redesigned",
    description: "Take a photo of your room, pick a style, and see it furnished in under a minute.",
    images: [{ url: "/images/landing/hero-after.jpg", width: 1200, height: 900, alt: "A living room designed with Kelly Spaces" }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

