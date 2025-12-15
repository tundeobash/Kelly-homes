"use client"

import Link from "next/link"
import { Scan, Apple, Chrome, Facebook } from "lucide-react"

export default function TempStitchWelcomePage() {
  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[#f6f8f6] dark:bg-[#112116] group/design-root">
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
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#f6f8f6] dark:to-[#112116]"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#f6f8f6] via-[#f6f8f6]/80 to-transparent dark:from-[#112116] dark:via-[#112116]/80 opacity-90 bottom-0 h-3/5 top-auto"></div>
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
          <div className="h-2 w-8 rounded-full bg-[#19e65e] transition-all duration-300"></div>
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
          <button className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-[#19e65e] hover:bg-[#19e65e]/90 transition-colors text-[#0e1b12] text-[17px] font-bold leading-normal tracking-[0.015em] active:scale-[0.98] transform duration-100">
            <span className="truncate">Get Started</span>
          </button>

          {/* Secondary Button (Outline/Ghost) */}
          <button className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-transparent border border-gray-200 dark:border-gray-700 hover:bg-black/5 dark:hover:bg-white/5 text-[#0e1b12] dark:text-white text-[17px] font-semibold leading-normal tracking-[0.015em] active:scale-[0.98] transform duration-100 transition-colors">
            <span className="truncate">I already have an account</span>
          </button>
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
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.8055 10.0415H21V10H12V14H17.6515C16.827 16.3285 14.6115 18 12 18C8.6865 18 6 15.3135 6 12C6 8.6865 8.6865 6 12 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12 2C6.4775 2 2 6.4775 2 12C2 17.5225 6.4775 22 12 22C17.5225 22 22 17.5225 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#FFC107"></path>
                <path d="M3.15302 7.3455L6.43852 9.755C7.32752 7.554 9.48052 6 12.0005 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12.0005 2C8.15902 2 4.82802 4.1685 3.15302 7.3455Z" fill="#FF3D00"></path>
                <path d="M12.0005 22C14.583 22 16.7305 20.488 17.6125 18.337L14.353 15.8695C13.6825 16.327 12.8715 16.592 12.0005 16.592C9.42952 16.592 7.24552 14.978 6.40202 12.718L3.11652 15.2595C4.77802 18.5255 8.13652 22 12.0005 22Z" fill="#4CAF50"></path>
                <path d="M21.8055 10.0415H21V10H12V14H17.6515C17.257 15.108 16.546 16.0765 15.635 16.7825L15.6565 16.7635L14.353 15.8695C13.6825 16.327 12.8715 16.592 12.0005 16.592C9.42952 16.592 7.24552 14.978 6.40202 12.718L6.38102 12.7335L6.43852 9.755C6.15502 9.0185 6.00002 8.2195 6.00002 7.4005V12C6.00002 12.2885 6.01252 12.574 6.03752 12.856L3.11652 15.2595C2.39202 13.823 2.00002 12.193 2.00002 10.5C2.00002 9.389 2.18952 8.3185 2.53602 7.311L3.15302 7.3455Z" fill="#1976D2"></path>
              </svg>
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

      {/* Debug Badge */}
      <div className="fixed bottom-4 right-4 bg-[#19e65e] text-[#0e1b12] px-3 py-1.5 rounded-full text-xs font-bold shadow-lg z-50">
        TEMP STITCH OK
      </div>
    </div>
  )
}
