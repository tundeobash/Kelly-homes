import { redirect, notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { getCatalogItemById } from "@/lib/catalog"
import { getSession } from "@/lib/dev-mode"
import AddToCartButton from "@/components/AddToCartButton"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({
  params,
}: PageProps) {
  const { id } = await params
  const session = await getSession()

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const item = getCatalogItemById(id)

  if (!item) {
    notFound()
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        href="/catalog"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Catalog
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="relative aspect-square bg-gray-200 rounded-lg overflow-hidden">
          <Image
            src={item.imagePath}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl mb-2">{item.name}</CardTitle>
              <CardDescription className="text-lg">
                {item.category} • {item.seller}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-4xl font-bold mb-4">${item.price.toFixed(2)}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Dimensions</h3>
                <p className="text-muted-foreground">
                  {item.dimensions.w} × {item.dimensions.d} × {item.dimensions.h} cm
                </p>
              </div>

              <AddToCartButton itemId={item.id} className="w-full" size="lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
