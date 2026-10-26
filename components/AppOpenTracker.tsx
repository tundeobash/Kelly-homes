"use client"

import { useEffect } from "react"
import { track } from "@/lib/tracking"

/** Counts one "app_open" per day per person (the server also keeps only one a day). */
export default function AppOpenTracker() {
  useEffect(() => {
    const today = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
    try {
      if (window.localStorage.getItem("ks-opened") === today) return
      window.localStorage.setItem("ks-opened", today)
    } catch {
      // Storage can be blocked; the server still keeps one a day.
    }
    track("app_open")
  }, [])
  return null
}
