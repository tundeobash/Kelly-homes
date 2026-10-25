"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import SignOutButton from "@/components/SignOutButton"
import { Palette, ShoppingBag, Users, ShoppingCart, User, Sparkles, Image as ImageIcon } from "lucide-react"

const navItems = [
  { href: "/profile/me", label: "Profile", icon: User },
  { href: "/ai-studio", label: "AI Studio", icon: Sparkles },
  { href: "/galleries", label: "Galleries", icon: ImageIcon },
  { href: "/styles", label: "Styles", icon: Palette },
  { href: "/catalog", label: "Catalog", icon: ShoppingBag },
  { href: "/designers", label: "Designers", icon: Users },
  { href: "/checkout", label: "Cart", icon: ShoppingCart },
]

export default function RightNav() {
  const pathname = usePathname()

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
      {navItems.map((item) => {
        const Icon = item.icon
        let isActive = false
        if (item.href === "/profile/me") {
          isActive = pathname?.startsWith("/profile")
        } else if (item.href === "/checkout") {
          isActive = pathname === "/checkout" || pathname?.startsWith("/checkout")
        } else {
          isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
        }
        return (
          <Link key={item.href} href={item.href} aria-label={item.label} className="flex-shrink-0">
            <Button
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className="gap-2 px-2.5 sm:px-3"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden text-sm sm:inline">{item.label}</span>
            </Button>
          </Link>
        )
      })}
      <SignOutButton variant="ghost" size="sm" className="flex-shrink-0 gap-2">
        Sign Out
      </SignOutButton>
    </nav>
  )
}
