import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost">← Back to Home</Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Terms of Service</CardTitle>
            <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
          </CardHeader>
          <CardContent className="prose max-w-none space-y-4">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using Kelly Homes, you accept and agree to be bound by the terms
                and provision of this agreement.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">2. Use License</h2>
              <p className="text-muted-foreground">
                Permission is granted to temporarily use Kelly Homes for personal, non-commercial
                transitory viewing only. This is the grant of a license, not a transfer of title.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">3. User Accounts</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account and password.
                You agree to accept responsibility for all activities that occur under your account.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">4. Privacy Policy</h2>
              <p className="text-muted-foreground">
                Your use of Kelly Homes is also governed by our Privacy Policy. Please review our
                Privacy Policy to understand our practices.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">5. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                Kelly Homes shall not be liable for any indirect, incidental, special, consequential,
                or punitive damages resulting from your use of or inability to use the service.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">6. Contact Information</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms of Service, please contact us.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

