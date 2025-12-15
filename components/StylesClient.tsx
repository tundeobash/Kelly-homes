"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { designStyles, type DesignStyle } from "@/lib/mock/styles"

interface StylesClientProps {
  styles: DesignStyle[]
  userPreferredStyles: string[]
  projectId?: string
}

function StyleImage({ slug, name }: { slug: string; name: string }) {
  const [imageError, setImageError] = useState(false)
  const [usePng, setUsePng] = useState(false)

  const handleError = () => {
    if (!usePng) {
      setUsePng(true)
    } else {
      setImageError(true)
    }
  }

  if (imageError) {
    return (
      <div className="h-40 w-full bg-muted flex items-center justify-center rounded-t-lg">
        <span className="text-sm text-muted-foreground">{name}</span>
      </div>
    )
  }

  const imageSrc = `/images/styles/${slug}${usePng ? ".png" : ".jpg"}`

  return (
    <div className="h-40 w-full overflow-hidden rounded-t-lg">
      <img
        src={imageSrc}
        alt={`${name} style`}
        className="h-full w-full object-cover"
        onError={handleError}
      />
    </div>
  )
}

export default function StylesClient({
  styles,
  userPreferredStyles,
  projectId,
}: StylesClientProps) {
  const [search, setSearch] = useState("")

  const filteredStyles = styles.filter((style) =>
    style.name.toLowerCase().includes(search.toLowerCase()) ||
    style.description.toLowerCase().includes(search.toLowerCase()) ||
    style.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div className="mb-6">
        <Input
          placeholder="Search styles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredStyles.map((style) => {
          return (
            <Card key={style.id} className="hover:shadow-lg transition-shadow overflow-hidden">
              <StyleImage slug={style.id} name={style.name} />
              <CardHeader>
                <CardTitle className="text-lg">{style.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {style.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {style.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

