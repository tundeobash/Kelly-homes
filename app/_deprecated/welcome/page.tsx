"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Scan, Apple, Chrome, Facebook } from "lucide-react"

export default function WelcomePage() {
  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark group/design-root">
      {/* Header Image / Hero Section */}
      <div className="relative flex-grow w-full overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 w-full h-full bg-center bg-no-repeat bg-cover"
          style={{
            backgroundImage:
              'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAghW87bN0CcEIfyZ6jpiED8FzuPTA9cw5TqXqzLD1aOY8Y6F5ZGanJCvT2L1qU3dPp_MRq4PhDRYZRYp2uDoCot4MCsCnY4HwVuB8N6LU0YmWp5z8iZ3jDbF6bGgIOfATTjA8v2RkItUamD1_Yh_TQrJfexTPNDKbGQOHRT0M-Oj_aa7ZBouswslPDFYiXcOLH0YUgrIJ8n3jdhs5rOjHZr8PZJjI1VoBXtFye9mS-N1an4sItyqHEz5mlaarQyuI1n-2GJNy8aQM")',
          }}
        >
          {/* Gradient Overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background-light dark:to-background-dark"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background-light via-background-light/80 to-transparent dark:from-background-dark dark:via-background-dark/80 opacity-90 bottom-0 h-3/5 top-auto"></div>
        </div>

        {/* Top Logo Area */}
        <div className="absolute top-0 left-0 w-full pt-12 pb-4 px-6 z-10 flex justify-center">
          <div className="flex items-center gap-2 text-white drop-shadow-md">
            <Scan className="text-3xl font-bold" />
            <span className="text-xl font-bold tracking-tight">AR Design</span>
          </div>
        </div>
      </div>

      {/* Content Area: Text + Controls */}
      <div className="relative z-10 flex flex-col items-center w-full px-6 pb-2 safe-area-bottom bg-transparent">
        {/* Carousel Indicators */}
        <div className="flex w-full flex-row items-center justify-center gap-2 py-4">
          <div className="h-2 w-8 rounded-full bg-primary-green transition-all duration-300"></div>
          <div className="h-2 w-2 rounded-full bg-[#d0e7d7] dark:bg-white/20"></div>
          <div className="h-2 w-2 rounded-full bg-[#d0e7d7] dark:bg-white/20"></div>
        </div>

        {/* Headline */}
        <h1 className="text-[#0e1b12] dark:text-white tracking-tight text-[36px] font-extrabold leading-tight text-center pb-2 pt-2">
          Redesign Reality
        </h1>

        {/* Body Text */}
        <p className="text-[#0e1b12]/70 dark:text-white/70 text-base font-normal leading-relaxed pb-8 pt-2 text-center max-w-[320px]">
          Experience furniture in your home before you buy. Join the marketplace for modern living.
        </p>

        {/* Buttons Container */}
        <div className="flex flex-col gap-3 w-full max-w-[480px]">
          {/* Primary Button */}
          <Link href="/auth/signup">
            <Button className="flex w-full h-14 px-5 bg-primary-green hover:bg-primary-green/90 text-[#0e1b12] text-[17px] font-bold leading-normal tracking-[0.015em] active:scale-[0.98] transform duration-100 rounded-xl">
              <span className="truncate">Get Started</span>
            </Button>
          </Link>

          {/* Secondary Button (Outline/Ghost) */}
          <Link href="/auth/login">
            <Button
              variant="outline"
              className="flex w-full h-14 px-5 bg-transparent border border-gray-200 dark:border-gray-700 hover:bg-black/5 dark:hover:bg-white/5 text-[#0e1b12] dark:text-white text-[17px] font-semibold leading-normal tracking-[0.015em] active:scale-[0.98] transform duration-100 transition-colors rounded-xl"
            >
              <span className="truncate">I already have an account</span>
            </Button>
          </Link>
        </div>

        {/* Social Login / Divider */}
        <div className="flex flex-col items-center w-full mt-6 mb-4">
          <div className="relative flex items-center w-full max-w-[280px] mb-5">
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
            <span className="flex-shrink mx-4 text-xs font-medium text-gray-400 uppercase tracking-widest">
              Or continue with
            </span>
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
          </div>

          <div className="flex gap-6 justify-center">
            {/* Apple */}
            <button
              className="h-12 w-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[#0e1b12] dark:text-white shadow-sm hover:scale-110 transition-transform"
              disabled
            >
              <Apple className="w-5 h-5" />
            </button>

            {/* Google */}
            <button
              className="h-12 w-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
              disabled
            >
              <Chrome className="w-5 h-5" />
            </button>

            {/* Facebook/Meta */}
            <button
              className="h-12 w-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[#1877F2] shadow-sm hover:scale-110 transition-transform"
              disabled
            >
              <Facebook className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Footer Small Print */}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center pb-2">
          By continuing you agree to our{" "}
          <Link href="#" className="underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  )
}

