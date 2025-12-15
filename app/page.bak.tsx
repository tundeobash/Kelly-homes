import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Kelly Homes</h1>
          <div className="flex gap-4">
            <Link href="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-4">
            Transform Your Space with AI-Powered Design
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Upload a photo of your room and get personalized furniture recommendations
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Link href="/auth">
              <Button size="lg">Start Designing</Button>
            </Link>
            <Link href="/_temp/stitch/welcome">
              <Button size="lg" variant="outline">Open Temp Stitch Page</Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <Card>
            <CardHeader>
              <CardTitle>Upload Your Room</CardTitle>
              <CardDescription>
                Simply upload a photo of your space
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Our system analyzes your room and understands its dimensions and layout.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Get Recommendations</CardTitle>
              <CardDescription>
                AI-powered furniture suggestions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Receive curated furniture recommendations based on your style, budget, and room type.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visualize & Shop</CardTitle>
              <CardDescription>
                See it in your space and buy instantly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Preview furniture in your room and purchase individual items or complete looks.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

