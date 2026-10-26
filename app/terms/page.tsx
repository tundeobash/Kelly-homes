import Link from "next/link"
import { contactLinks } from "@/lib/landing"

const sections = [
  {
    title: "1. Acceptance of terms",
    body: [
      "By accessing and using Kelly Spaces, you accept and agree to be bound by the terms and provisions of this agreement.",
    ],
  },
  {
    title: "2. Use licence",
    body: [
      "Permission is granted to temporarily use Kelly Spaces for personal, non-commercial transitory viewing only. This is the grant of a licence, not a transfer of title.",
    ],
  },
  {
    title: "3. User accounts",
    body: [
      "You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.",
    ],
  },
  {
    title: "4. Your photos and designs",
    body: [
      "Kelly Spaces is in private preview. When you add a room, your photo is used to design that room. To make and check each design, the photo is sent to our AI providers, OpenAI and Google.",
      "Your photos and designs are stored so you can come back to them. They are kept at web addresses that are hard to guess but not password-protected: anyone with a picture's exact address could open it, so leave out anything private when you take a photo. We do not show your photos or designs to other users.",
      "Deleting a room deletes its photo and designs.",
      "We record how the app is used, for example when a design is made or compared, to improve Kelly Spaces.",
    ],
  },
  {
    title: "5. Limitation of liability",
    body: [
      "Kelly Spaces shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.",
    ],
  },
]

export default function TermsPage() {
  const contact = contactLinks().feedback

  return (
    <div className="min-h-screen bg-ks-paper font-sans text-ks-ink">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <Link href="/" className="font-serif text-[22px] font-semibold text-ks-charcoal">
          Kelly Spaces
        </Link>
        <h1 className="mt-8 font-serif text-[32px] font-semibold leading-tight text-ks-ink sm:text-[40px]">Terms of service</h1>
        <p className="mt-2 text-[14px] text-ks-stone">Last updated 26 October 2026</p>

        <div className="mt-8 flex flex-col gap-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-sans text-[18px] font-semibold leading-snug text-ks-ink">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-[16px] leading-relaxed text-[#4B5563]">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          <section>
            <h2 className="font-sans text-[18px] font-semibold leading-snug text-ks-ink">6. Contact</h2>
            <p className="mt-2 text-[16px] leading-relaxed text-[#4B5563]">
              If you have any questions about these terms or your photos,{" "}
              {contact ? (
                <a href={contact} className="text-[16px] font-medium text-ks-charcoal underline underline-offset-4">
                  contact us
                </a>
              ) : (
                "contact the Kelly Spaces team"
              )}
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
