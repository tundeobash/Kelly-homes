"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// TODO: Import from recommendation engine when needed
// For now, calculate inline
function calculateCommission(itemPrice: number, seller: string): number {
  const rates: Record<string, number> = {
    IKEA: 0.05,
    Etsy: 0.10,
    "Home Center": 0.08,
  }
  return itemPrice * (rates[seller] || 0.05)
}

interface CheckoutClientProps {
  cart: any
}

export default function CheckoutClient({ cart }: CheckoutClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    city: "",
    zip: "",
  })

  const total = cart.items.reduce(
    (sum: number, item: any) => sum + item.furnitureItem.price * item.quantity,
    0
  )

  // TODO: Replace with real Stripe integration
  // This is a mock checkout - in production, integrate with Stripe Checkout
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Calculate commissions for each item
      // TODO: This would integrate with seller APIs and payment processing
      const orderItems = cart.items.map((item: any) => ({
        furnitureItemId: item.furnitureItem.id,
        quantity: item.quantity,
        price: item.furnitureItem.price,
        commission: calculateCommission(
          item.furnitureItem.price,
          item.furnitureItem.seller
        ),
      }))

      const totalCommission = orderItems.reduce(
        (sum: number, item: any) => sum + item.commission * item.quantity,
        0
      )

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: orderItems,
          totalAmount: total,
          commission: totalCommission,
        }),
      })

      if (res.ok) {
        // Clear cart
        await fetch("/api/cart", { method: "DELETE" })
        router.push("/dashboard?order=success")
      } else {
        alert("Checkout failed. Please try again.")
      }
    } catch (error) {
      console.error("Checkout error:", error)
      alert("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8">Checkout</h2>
      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Shipping Information</CardTitle>
            <CardDescription>
              Enter your shipping details (mock checkout)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) =>
                      setFormData({ ...formData, zip: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Processing..." : "Complete Order (Mock)"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cart.items.map((item: any) => (
                <div key={item.id} className="flex gap-4">
                  <img
                    src={item.furnitureItem.imageUrl}
                    alt={item.furnitureItem.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold">{item.furnitureItem.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Qty: {item.quantity}
                    </p>
                    <p className="font-bold">
                      ${(item.furnitureItem.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
              <div className="border-t pt-4">
                <div className="flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  This is a mock checkout. No real payment will be processed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

