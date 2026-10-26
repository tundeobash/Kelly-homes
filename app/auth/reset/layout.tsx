import type { Metadata } from "next"

/** Reset links carry a one-time token in the address: keep it out of referrers and search engines. */
export const metadata: Metadata = {
  title: "Choose a new password · Kelly Spaces",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
}

export default function ResetLayout({ children }: { children: React.ReactNode }) {
  return children
}
