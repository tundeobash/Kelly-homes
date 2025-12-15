"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import SignOutButton from "@/components/SignOutButton"
import { Palette, ShoppingBag, Users, ShoppingCart, User } from "lucide-react"

const navItems = [
  { href: "/styles", label: "Styles", icon: Palette },
  { href: "/catalog", label: "Catalog", icon: ShoppingBag },
  { href: "/designers", label: "Designers", icon: Users },
  { href: "/checkout", label: "Cart", icon: ShoppingCart },
  { href: "/profile/me", label: "Profile", icon: User },
]

export default function RightNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-2">
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
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Button>
          </Link>
        )
      })}
      <SignOutButton variant="ghost" size="sm" className="gap-2">
        Sign Out
      </SignOutButton>
    </nav>
  )
}
