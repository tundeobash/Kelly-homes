"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { contactLinks } from "@/lib/landing"

const fieldClass =
  "mt-2 h-[50px] w-full rounded-xl border border-[#D1D5DB] bg-white px-3.5 text-[16px] text-ks-ink outline-none focus:border-ks-charcoal"

/** Step 1 of "Forgot password?": ask for the email and send a link. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [unavailable, setUnavailable] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const askUs = contactLinks().passwordReset

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setUnavailable(false)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSentTo(email.trim())
      } else {
        setError(data.error || "Something went wrong. Please try again.")
        setUnavailable(Boolean(data.unavailable))
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-ks-paper px-5 pb-8 pt-14 font-sans text-ks-ink">
      <Link href="/" className="font-serif text-[26px] font-semibold text-ks-charcoal">
        Kelly Spaces
      </Link>

      {sentTo ? (
        <div className="mt-7 flex w-full max-w-md flex-col rounded-[18px] border border-ks-line bg-white px-5 py-6 sm:px-7 sm:py-8">
          <h1 className="font-serif text-[26px] font-semibold leading-tight text-ks-ink">Check your email</h1>
          <p className="mt-2 text-[15px] leading-normal text-ks-stone">
            If there's an account for <span className="text-[15px] font-semibold text-ks-ink">{sentTo}</span>, we've
            sent a link to choose a new password. It works for 1 hour.
          </p>
          <p className="mt-3 text-[15px] leading-normal text-ks-stone">
            Nothing after a few minutes? Check your spam folder, or{" "}
            <button
              type="button"
              onClick={() => setSentTo(null)}
              className="text-[15px] font-medium text-ks-charcoal underline underline-offset-4"
            >
              try again
            </button>
            .
          </p>
          <Link
            href="/auth"
            className="mt-6 flex h-[52px] items-center justify-center rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-7 flex w-full max-w-md flex-col rounded-[18px] border border-ks-line bg-white px-5 py-6 sm:px-7 sm:py-8"
        >
          <h1 className="font-serif text-[26px] font-semibold leading-tight text-ks-ink">Reset your password</h1>
          <p className="mt-1.5 text-[15px] leading-normal text-ks-stone">
            Enter the email you signed up with. We'll send you a link to choose a new password.
          </p>

          <label htmlFor="email" className="mt-5 text-[14px] font-semibold text-ks-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className={fieldClass}
          />

          {error && (
            <p role="alert" className="mt-4 text-[14px] leading-normal text-[#B42318]">
              {error}
              {unavailable && askUs && (
                <>
                  {" "}
                  <a href={askUs} className="text-[14px] font-medium text-[#B42318] underline underline-offset-4">
                    Ask us to reset it
                  </a>
                </>
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 flex h-[52px] items-center justify-center gap-2 rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Send reset link
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-[14px] leading-normal text-[#4B5563]">
        Remembered it?{" "}
        <Link href="/auth" className="text-[14px] font-semibold text-ks-charcoal underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  )
}
