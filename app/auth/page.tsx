"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { contactLinks } from "@/lib/landing"
import { cleanInviteCode } from "@/lib/invite"
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/auth/passwordRules"

const fieldClass =
  "mt-2 h-[50px] w-full rounded-xl border border-[#D1D5DB] bg-white px-3.5 text-[16px] text-ks-ink outline-none focus:border-ks-charcoal"

/**
 * Sign in and sign up (by invitation). ?mode=signup opens sign-up.
 * ?invite=CODE comes from the WhatsApp invite link; it is kept for this visit
 * so it still works after switching between sign in and sign up.
 */
export default function AuthPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const { invite } = contactLinks()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("mode") === "signup") setIsLogin(false)
    let code = cleanInviteCode(params.get("invite"))
    try {
      if (code) window.sessionStorage.setItem("ks-invite", code)
      else code = cleanInviteCode(window.sessionStorage.getItem("ks-invite"))
    } catch {
      // Storage can be blocked; the code from the link still works.
    }
    setInviteCode(code)
  }, [])

  const switchMode = () => {
    setIsLogin((value) => !value)
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!isLogin) {
      const problem = passwordProblem(password)
      if (problem) {
        setError(problem)
        return
      }
    }
    setLoading(true)
    try {
      if (isLogin) {
        const result = await signIn("credentials", { email, password, redirect: false })
        if (result?.error) {
          setError("That email and password don't match. Please try again.")
        } else {
          router.push("/ai-studio")
        }
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name, invite: inviteCode || undefined }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error || "We couldn't create your account. Please try again.")
        } else {
          const result = await signIn("credentials", { email, password, redirect: false })
          if (result?.ok) router.push("/ai-studio")
          else setError("Your account was created. Please sign in.")
        }
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

      <form
        onSubmit={handleSubmit}
        className="mt-7 flex w-full max-w-md flex-col rounded-[18px] border border-ks-line bg-white px-5 py-6 sm:px-7 sm:py-8"
      >
        <h1 className="font-serif text-[26px] font-semibold leading-tight text-ks-ink">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-[15px] leading-normal text-ks-stone">
          {isLogin
            ? "Sign in to see your rooms."
            : inviteCode
              ? "You're invited to the Kelly Spaces private preview. Create your account to start."
              : "Kelly Spaces is in private preview. Sign up with the invite link you were sent."}
        </p>

        {!isLogin && (
          <>
            <label htmlFor="name" className="mt-5 text-[14px] font-semibold text-ks-ink">
              Your name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={fieldClass}
            />
          </>
        )}

        <label htmlFor="email" className={`${isLogin ? "mt-5" : "mt-4"} text-[14px] font-semibold text-ks-ink`}>
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

        <label htmlFor="password" className="mt-4 text-[14px] font-semibold text-ks-ink">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={isLogin ? undefined : MIN_PASSWORD_LENGTH}
          className={fieldClass}
        />
        {!isLogin && (
          <p className="mt-1.5 text-[13px] leading-normal text-ks-stone">At least {MIN_PASSWORD_LENGTH} characters.</p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[14px] leading-normal text-[#B42318]">
            {error}
            {!isLogin && invite && (
              <>
                {" "}
                <a href={invite} className="text-[14px] font-medium text-[#B42318] underline underline-offset-4">
                  Ask for an invite
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
          {isLogin ? "Sign in" : "Create account"}
        </button>

        {isLogin && (
          <p className="mt-4 text-center text-[14px] leading-normal text-ks-stone">
            Forgot your password?{" "}
            <Link href="/auth/forgot-password" className="text-[14px] font-medium text-ks-charcoal underline underline-offset-4">
              Reset it
            </Link>
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-[14px] leading-normal text-[#4B5563]">
        {isLogin ? "New here? " : "Already have an account? "}
        <button type="button" onClick={switchMode} className="text-[14px] font-semibold text-ks-charcoal underline underline-offset-4">
          {isLogin ? "Sign up with your invitation" : "Sign in"}
        </button>
      </p>
      {invite && !inviteCode && (
        <p className="mt-2 text-center text-[14px] text-ks-stone">
          No invitation yet?{" "}
          <a href={invite} className="text-[14px] font-medium text-ks-charcoal underline underline-offset-4">
            Ask for an invite
          </a>
        </p>
      )}

      <p className="mt-10 text-center text-[12px] text-ks-stone">
        By continuing you agree to our{" "}
        <Link href="/terms" className="text-[12px] text-[#4B5563] underline">
          Terms
        </Link>
      </p>
    </div>
  )
}
