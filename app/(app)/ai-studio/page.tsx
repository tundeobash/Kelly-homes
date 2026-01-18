import { Suspense } from "react"
import AiStudioClient from "./AiStudioClient"

export default function AIStudioPage() {
  return (
    <Suspense fallback={null}>
      <AiStudioClient />
    </Suspense>
  )
}
