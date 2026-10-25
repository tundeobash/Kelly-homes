import Link from "next/link"
import RightNav from "@/components/RightNav"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex justify-between items-center gap-3">
          <Link href="/" className="flex-shrink-0">
            <h1 className="text-xl sm:text-2xl font-bold">Kelly Homes</h1>
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
