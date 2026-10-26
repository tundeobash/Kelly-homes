import Link from "next/link"
import RightNav from "@/components/RightNav"
import AppOpenTracker from "@/components/AppOpenTracker"
import { contactLinks } from "@/lib/landing"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const feedback = contactLinks().feedback
  const opensNewTab = Boolean(feedback?.startsWith("https:"))

  return (
    <div className="min-h-screen bg-ks-paper">
      <AppOpenTracker />
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex justify-between items-center gap-3">
          <Link href="/profile/me" className="flex-shrink-0 font-serif text-[22px] font-semibold text-ks-charcoal sm:text-[24px]">
            Kelly Spaces
          </Link>
          <RightNav />
        </div>
      </header>
      <main className="container mx-auto px-4 py-4 sm:py-8">
        {children}
      </main>
      <footer className="container mx-auto flex items-center justify-center gap-6 px-4 pb-8 pt-2">
        {feedback && (
          <a
            href={feedback}
            target={opensNewTab ? "_blank" : undefined}
            rel={opensNewTab ? "noopener noreferrer" : undefined}
            className="py-3 text-[14px] font-medium text-ks-charcoal underline underline-offset-4"
          >
            Send feedback
          </a>
        )}
        <Link href="/terms" className="py-3 text-[14px] text-[#4B5563] hover:underline">
          Terms
        </Link>
      </footer>
    </div>
  )
}
