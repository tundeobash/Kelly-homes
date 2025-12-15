"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ShoppingCart } from "lucide-react"

interface CatalogClientProps {
  items: any[]
  sellers: string[]
}

export default function CatalogClient({ items, sellers }: CatalogClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState("")
  const [styleFilter, setStyleFilter] = useState(searchParams.get("style") || "")
  const [sellerFilter, setSellerFilter] = useState(searchParams.get("seller") || "")
  const [budgetFilter, setBudgetFilter] = useState(searchParams.get("budget") || "")
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") || "")

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (styleFilter && styleFilter !== "all") params.set("style", styleFilter)
    if (sellerFilter && sellerFilter !== "all") params.set("seller", sellerFilter)
    if (budgetFilter && budgetFilter !== "all") params.set("budget", budgetFilter)
    if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter)
    router.push(`/catalog?${params.toString()}`)
  }

  const budgetRanges = [
    { value: "all", label: "All Budgets" },
    { value: "500", label: "$1 – $500" },
    { value: "1000", label: "$501 – $1,000" },
    { value: "2000", label: "$1,001 – $2,000" },
    { value: "5000", label: "$2,001 – $5,000" },
    { value: "10000", label: "$5,001 – $10,000" },
    { value: "10001", label: "$10,001+" },
  ]

  const categories = [
    "Sofa / Sectional",
    "Armchair",
    "Coffee Table",
    "Side Table",
    "TV Stand / Media Console",
    "Dining Table",
    "Dining Chair",
    "Bed Frame",
    "Mattress",
    "Nightstand",
    "Dresser / Chest",
    "Desk",
    "Office Chair",
    "Bookshelf / Storage",
    "Rug",
    "Lighting (Floor / Table / Ceiling)",
    "Curtains / Blinds",
    "Wall Art / Decor",
  ]

  const filteredItems = items.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    return true
  })

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-6">Furniture Catalog</h2>
        <div className="grid md:grid-cols-5 gap-4 mb-4">
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={styleFilter} onValueChange={setStyleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Styles</SelectItem>
              <SelectItem value="Modern">Modern</SelectItem>
              <SelectItem value="Scandinavian">Scandinavian</SelectItem>
              <SelectItem value="Minimal">Minimal</SelectItem>
              <SelectItem value="Vintage">Vintage</SelectItem>
              <SelectItem value="Traditional">Traditional</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Seller" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sellers</SelectItem>
              {sellers.map((seller) => (
                <SelectItem key={seller} value={seller}>
                  {seller}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={budgetFilter} onValueChange={setBudgetFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Budget" />
            </SelectTrigger>
            <SelectContent>
              {budgetRanges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={applyFilters}>Apply Filters</Button>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredItems.map((item) => (
          <Card key={item.id}>
            <div className="aspect-square bg-gray-200 rounded-t-lg overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
            <CardHeader>
              <CardTitle className="text-lg">{item.name}</CardTitle>
              <CardDescription>{item.seller}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-4">
                ${item.price.toFixed(2)}
              </p>
              <Button
                className="w-full"
                onClick={async () => {
                  await fetch("/api/cart", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ furnitureItemId: item.id }),
                  })
                  alert("Added to cart!")
                }}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Add to Cart
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

