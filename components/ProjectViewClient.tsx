"use client"

import dynamic from "next/dynamic"

const ProjectView = dynamic(() => import("./ProjectView"), { ssr: false })

interface ProjectViewClientProps {
  project: any
  userPreferences: string[]
  userBudget?: number | null
  designers: Array<{ id: string; name: string; style: string }>
}

export default function ProjectViewClient(props: ProjectViewClientProps) {
  return <ProjectView {...props} />
}
