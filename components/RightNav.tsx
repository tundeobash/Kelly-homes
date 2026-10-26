"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { Plus } from "lucide-react"
import { showUnfinished } from "@/lib/unfinished"

/** Mock-up sections, shown only when unfinished features are switched on. */
const unfinishedItems = [
  { href: "/catalog", label: "Catalog" },
  { href: "/designers", label: "Designers" },
  { href: "/checkout", label: "Cart" },
]

export default function RightNav() {
  const extras = showUnfinished() ? unfinishedItems : []

  return (
    <nav className="flex min-w-0 items-center gap-1.5 sm:gap-3">
      {extras.map((item) => (
        <Link key={item.href} href={item.href} className="hidden px-2 py-3 text-[14px] font-medium text-ks-charcoal hover:underline sm:block">
          {item.label}
        </Link>
      ))}
      <Link
        href="/project/new"
        className="flex h-10 flex-shrink-0 items-center gap-1.5 rounded-[10px] bg-ks-charcoal px-3.5 text-[14px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
      >
        <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        New room
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex h-11 flex-shrink-0 items-center px-2 text-[14px] font-medium text-ks-charcoal hover:underline"
      >
        Sign out
      </button>
    </nav>
  )
}
