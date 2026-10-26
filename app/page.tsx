import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import BeforeAfterSlider from "@/components/design/BeforeAfterSlider"
import { HERO_PAIR, LANDING_STYLES, SHOWCASE_ROOMS, contactLinks } from "@/lib/landing"
import { cleanInviteCode } from "@/lib/invite"

const serif = "font-serif font-semibold text-ks-ink"
const primaryButton =
  "inline-flex h-14 items-center justify-center rounded-xl bg-ks-charcoal px-7 text-[17px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"

const steps = [
  {
    title: "Take a photo of your room",
    text: "Stand in a corner, hold your phone upright, and turn the lights on.",
  },
  {
    title: "Pick a style",
    text: "Choose from 19 styles, including Contemporary Majlis and Modern Arabic.",
  },
  {
    title: "Compare and keep your favourites",
    text: "Slide between before and after, try another style, and compare designs side by side. Every design is saved.",
  },
]

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getServerSession(authOptions)
  const signedIn = Boolean(session?.user?.id)
  // ?invite=CODE comes from the WhatsApp invite link and is passed on to sign-up.
  const params = await searchParams
  const inviteCode = cleanInviteCode(typeof params.invite === "string" ? params.invite : null)
  const inviteQuery = inviteCode ? `invite=${encodeURIComponent(inviteCode)}` : ""
  // Signed in: straight to their newest room. Signed out: sign up (by invitation).
  const startHref = signedIn ? "/ai-studio" : `/auth?mode=signup${inviteQuery ? `&${inviteQuery}` : ""}`
  const signInHref = signedIn ? "/ai-studio" : `/auth${inviteQuery ? `?${inviteQuery}` : ""}`
  // People who came with an invite link don't need to ask for one.
  const invite = inviteCode ? null : contactLinks().invite
  const previewNote = inviteCode ? "Private preview. You're invited." : "Private preview, by invitation."

  return (
    <div className="min-h-screen bg-ks-paper font-sans text-ks-ink">
      <header className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-5 sm:h-20 sm:px-10">
        <Link href="/" className="font-serif text-[22px] font-semibold text-ks-charcoal sm:text-[26px]">
          Kelly Spaces
        </Link>
        <nav className="flex items-center gap-5">
          <Link
            href={signInHref}
            className="px-1 py-3 text-[15px] font-medium text-ks-charcoal hover:underline"
          >
            {signedIn ? "Your rooms" : "Sign in"}
          </Link>
          <Link
            href={startHref}
            className="hidden h-11 items-center rounded-xl bg-ks-charcoal px-[18px] text-[15px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 sm:inline-flex"
          >
            Design your room
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-14 gap-y-6 px-5 pb-12 pt-3 sm:px-10 sm:pb-[72px] sm:pt-8">
          <div className="min-w-0 flex-[1_1_440px]">
            <h1 className={`${serif} text-[36px] leading-[1.12] tracking-[-0.01em] sm:text-[60px] sm:leading-[1.06]`}>
              See your own room redesigned.
            </h1>
            <p className="mt-3.5 max-w-[30rem] text-[17px] leading-normal text-[#4B5563] sm:mt-5 sm:text-[19px]">
              Take a photo, pick a style, and see it furnished in under a minute. Your walls, windows and doors stay
              exactly as they are.
            </p>
            <div className="mt-8 hidden flex-wrap items-center gap-x-5 gap-y-3 lg:flex">
              <Link href={startHref} className={primaryButton}>
                Design your room
              </Link>
              <p className="text-[14px] text-ks-stone">
                {previewNote}
                {invite && (
                  <>
                    {" "}
                    <a href={invite} className="text-[14px] font-medium text-ks-charcoal underline underline-offset-4">
                      Ask for an invite
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="w-full min-w-0 lg:w-auto lg:flex-[0_1_465px]">
            <div className="overflow-hidden rounded-[20px] shadow-[0_20px_50px_rgba(17,24,39,0.12)]">
              <BeforeAfterSlider
                beforeSrc={HERO_PAIR.before}
                beforeAlt="Before: an empty living room photographed on a phone"
                afterSrc={HERO_PAIR.after}
                afterAlt={`After: the same living room furnished in ${HERO_PAIR.styleName} style`}
              />
            </div>
            <p className="mt-2.5 text-center text-[13px] text-ks-stone lg:text-left">
              A real empty room, redesigned in {HERO_PAIR.styleName} style.
            </p>
          </div>

          <div className="w-full lg:hidden">
            <Link href={startHref} className={`${primaryButton} w-full`}>
              Design your room
            </Link>
            <p className="mt-2.5 text-center text-[13px] text-ks-stone">
              {previewNote}
              {invite && (
                <>
                  {" "}
                  <a href={invite} className="text-[13px] font-medium text-ks-charcoal underline underline-offset-4">
                    Ask for an invite
                  </a>
                </>
              )}
            </p>
          </div>
        </section>

        <section className="border-y border-ks-line bg-white">
          <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-10 sm:py-16">
            <h2 className={`${serif} mb-6 text-[26px] leading-tight sm:mb-8 sm:text-[36px]`}>How it works</h2>
            <ol className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:gap-8">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-3.5 sm:min-w-0 sm:flex-[1_1_260px] sm:flex-col sm:gap-4">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ks-sand text-[15px] font-semibold text-ks-charcoal sm:h-9 sm:w-9 sm:text-[16px]">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[17px] font-semibold leading-snug text-ks-ink sm:text-[19px]">{step.title}</p>
                    <p className="mt-1 text-[15px] leading-normal text-ks-stone sm:mt-1.5 sm:text-[16px]">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] py-10 sm:px-10 sm:py-[72px]">
          <div className="px-5 sm:px-0">
            <h2 className={`${serif} text-[26px] leading-tight sm:text-[36px]`}>Real rooms, real phone photos</h2>
            <p className="mt-2 max-w-[40rem] text-[15px] leading-normal text-ks-stone sm:mt-2.5 sm:text-[17px]">
              Empty rooms in a Gulf apartment, redesigned by Kelly Spaces. The rooms stay the same; the furniture and
              decor are imagined by AI.
            </p>
          </div>
          <div className="flex snap-x snap-mandatory scroll-px-5 gap-3.5 overflow-x-auto px-5 pb-1 pt-5 [scrollbar-width:none] sm:flex-wrap sm:gap-6 sm:overflow-visible sm:px-0 sm:pt-8 [&::-webkit-scrollbar]:hidden">
            {SHOWCASE_ROOMS.map((room) => (
              <figure key={room.id} className="m-0 w-[296px] flex-shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-[1_1_300px]">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-ks-sand sm:rounded-[18px]">
                  <img
                    src={room.after}
                    alt={`${room.room} redesigned in ${room.styleName} style`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-2.5 left-2.5 h-28 w-[84px] overflow-hidden rounded-[10px] border-2 border-white shadow-[0_2px_10px_rgba(17,24,39,0.3)] sm:bottom-3 sm:left-3 sm:h-32 sm:w-24">
                    <img src={room.before} alt={`The same ${room.room.toLowerCase()}, empty`} loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-[rgba(17,24,39,0.72)] py-[3px] text-center text-[11px] font-medium leading-normal text-white">
                      Before
                    </span>
                  </div>
                </div>
                <figcaption className="mt-2.5 sm:mt-3">
                  <span className="block text-[15px] font-semibold text-ks-ink sm:text-[17px]">{room.styleName}</span>
                  <span className="mt-0.5 block text-[13px] text-ks-stone sm:text-[14px]">{room.room}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="border-t border-ks-line bg-white">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-x-10 gap-y-5 px-5 pb-11 pt-9 sm:px-10 sm:pb-[72px] sm:pt-16">
            <div className="min-w-0 flex-[1_1_300px]">
              <h2 className={`${serif} text-[26px] leading-tight sm:text-[36px]`}>Made for Gulf homes</h2>
              <p className="mt-2 text-[15px] leading-normal text-ks-stone sm:mt-3 sm:text-[17px]">
                Styles for how homes here are lived in, from hosting guests in the majlis to warm, modern family rooms.
              </p>
              <p className="mt-4 hidden text-[15px] text-[#4B5563] sm:block">
                Plus Minimalist, Scandinavian and 13 more.
              </p>
            </div>
            <div className="grid min-w-0 flex-[2_1_560px] grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 sm:gap-4">
              {LANDING_STYLES.map((style) => (
                <div key={style.id}>
                  <img src={style.cardImage} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
                  <p className="mt-2 text-[15px] font-semibold text-ks-ink">{style.name}</p>
                </div>
              ))}
            </div>
            <p className="text-[14px] text-[#4B5563] sm:hidden">Plus Minimalist, Scandinavian and 13 more.</p>
          </div>
        </section>

        <section className="bg-ks-charcoal">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-10 gap-y-6 px-5 py-12 sm:px-10 sm:py-16">
            <div className="min-w-0 flex-[1_1_420px]">
              <h2 className="font-serif text-[28px] font-semibold leading-tight text-white sm:text-[38px]">
                Try a style before you buy a thing.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[#D1D5DB] sm:text-[16px]">
                {inviteCode
                  ? "Kelly Spaces is in private preview, and you're invited. Create your account to start."
                  : "Kelly Spaces is in private preview. Sign up with the invite link you were sent."}
                {invite && (
                  <>
                    {" "}
                    <a href={invite} className="text-[15px] font-medium text-white underline underline-offset-4 sm:text-[16px]">
                      Ask for an invite
                    </a>
                  </>
                )}
              </p>
            </div>
            <Link
              href={startHref}
              className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-ks-gold px-[30px] text-[17px] font-semibold text-ks-charcoal transition-opacity duration-150 hover:opacity-90 sm:w-auto"
            >
              Design your room
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-7">
        <p className="text-[13px] text-ks-stone sm:text-[14px]">© 2026 Kelly Spaces</p>
        <Link href="/terms" className="py-3 text-[13px] text-[#4B5563] hover:underline sm:text-[14px]">
          Terms
        </Link>
      </footer>
    </div>
  )
}
