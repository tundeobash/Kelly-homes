import Link from "next/link"
import RightNav from "@/components/RightNav"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-ks-paper">
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
    </div>
  )
}
