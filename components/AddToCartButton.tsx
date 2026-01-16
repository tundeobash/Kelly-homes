// TODO: Replace placeholder restored after recovery
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, ShoppingCart } from "lucide-react"
import { useRouter } from "next/navigation"

interface AddToCartButtonProps {
  itemId: string
  className?: string
  size?: "default" | "sm" | "lg" | "icon"
}

export default function AddToCartButton({
  itemId,
  className,
  size = "default",
}: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAddToCart = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ furnitureItemId: itemId, quantity: 1 }),
      })

      if (!res.ok) {
        throw new Error("Failed to add to cart")
      }

      // Optionally refresh or show success message
      router.refresh()
    } catch (error) {
      console.error("Error adding to cart:", error)
      alert("Failed to add item to cart. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleAddToCart}
      disabled={loading}
      className={className}
      size={size}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Adding...
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Add to Cart
        </>
      )}
    </Button>
  )
}
