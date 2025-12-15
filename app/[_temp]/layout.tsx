import { Plus_Jakarta_Sans } from "next/font/google"

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-stitch-temp",
})

export default function TempLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${plusJakartaSans.variable} font-[var(--font-stitch-temp)] bg-[#f6f8f6] dark:bg-[#112116] text-[#0e1b12] dark:text-white transition-colors duration-200 min-h-screen`}
      style={{ fontFamily: 'var(--font-stitch-temp), ui-sans-serif, system-ui' }}
    >
      {children}
    </div>
  )
}

