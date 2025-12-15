import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import DesignerCard from "@/components/DesignerCard"

export default async function DesignersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const designers = await prisma.designer.findMany({
    orderBy: { createdAt: "desc" },
  })

  return (
    <>
      <h2 className="text-3xl font-bold mb-8">Interior Designers</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {designers.map((designer) => (
          <DesignerCard key={designer.id} designer={designer} />
        ))}
      </div>
    </>
  )
}

