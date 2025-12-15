"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ButtonProps } from "@/components/ui/button"

export default function SignOutButton({ ...props }: ButtonProps) {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  return (
    <Button onClick={handleSignOut} {...props}>
      Sign Out
    </Button>
  )
}

