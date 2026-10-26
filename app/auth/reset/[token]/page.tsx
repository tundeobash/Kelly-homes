"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/auth/passwordRules"

const fieldClass =
  "mt-2 h-[50px] w-full rounded-xl border border-[#D1D5DB] bg-white px-3.5 text-[16px] text-ks-ink outline-none focus:border-ks-charcoal"

/** Step 2 of "Forgot password?": the link from the email opens this page. */
export default function ResetPasswordPage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = typeof params?.token === "string" ? params.token : ""
  const [password, setPassword] = useState("")
  const [again, setAgain] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [linkInvalid, setLinkInvalid] = useState(false)
  const [savedButNotSignedIn, setSavedButNotSignedIn] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const problem = passwordProblem(password)
    if (problem) {
      setError(problem)
      return
    }
    if (password !== again) {
      setError("The two passwords don't match. Please type them again.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.")
        setLinkInvalid(Boolean(data.linkInvalid))
        return
      }
      const result = await signIn("credentials", { email: data.email, password, redirect: false })
      if (result?.ok) router.push("/ai-studio")
      else setSavedButNotSignedIn(true)
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

      {savedButNotSignedIn ? (
        <div className="mt-7 flex w-full max-w-md flex-col rounded-[18px] border border-ks-line bg-white px-5 py-6 sm:px-7 sm:py-8">
          <h1 className="font-serif text-[26px] font-semibold leading-tight text-ks-ink">Password saved</h1>
          <p className="mt-2 text-[15px] leading-normal text-ks-stone">Sign in with your email and your new password.</p>
          <Link
            href="/auth"
            className="mt-6 flex h-[52px] items-center justify-center rounded-xl bg-ks-charcoal text-[16px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-7 flex w-full max-w-md flex-col rounded-[18px] border border-ks-line bg-white px-5 py-6 sm:px-7 sm:py-8"
        >
          <h1 className="font-serif text-[26px] font-semibold leading-tight text-ks-ink">Choose a new password</h1>
          <p className="mt-1.5 text-[15px] leading-normal text-ks-stone">
            Use at least {MIN_PASSWORD_LENGTH} characters. You'll be signed in straight after.
          </p>

          <label htmlFor="password" className="mt-5 text-[14px] font-semibold text-ks-ink">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            className={fieldClass}
          />

          <label htmlFor="again" className="mt-4 text-[14px] font-semibold text-ks-ink">
            Type it again
          </label>
          <input
            id="again"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            className={fieldClass}
          />

          {error && (
            <p role="alert" className="mt-4 text-[14px] leading-normal text-[#B42318]">
              {error}
              {linkInvalid && (
                <>
                  {" "}
                  <Link
                    href="/auth/forgot-password"
                    className="text-[14px] font-medium text-[#B42318] underline underline-offset-4"
                  >
                    Send a new link
                  </Link>
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
            Save new password
          </button>
        </form>
      )}
    </div>
  )
}
