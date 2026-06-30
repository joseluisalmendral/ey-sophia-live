import Link from "next/link";
import { SophiaBanner } from "@/components/brand/SophiaBanner";

/**
 * Landing page for EY SophIA Live.
 *
 * Dark, projector-first, single EY-yellow accent. This is the entry surface;
 * the actual voting (/vote/[poll]), projector (/screen/[poll]), and admin
 * (/admin) routes are built in later phases.
 */
export default function Home() {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-16">
      {/* Distant brand glow, kept subtle so the yellow CTA stays the highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-cosmic-700) 65%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-xl">
        <SophiaBanner
          variant="hero"
          tagline="Vote for the best team, live. Watch the results race in on the big screen."
        />

        <div className="mt-10 flex flex-col gap-4">
          <p className="text-balance text-small leading-relaxed text-text-dim">
            Scan the QR code on screen to join your room, or open the link your
            host shared. No app, no account, one tap to vote.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            {/* Primary CTA — the single yellow highlight on the page */}
            <Link
              href="/admin"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-ey-yellow px-6 font-display text-body font-bold text-ey-confident transition-transform duration-150 ease-out hover:-translate-y-px active:scale-[0.98]"
            >
              Host a session
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-white/15 px-6 text-body font-medium text-text transition-colors duration-150 hover:bg-white/5"
            >
              Admin sign in
            </Link>
          </div>
        </div>
      </div>

      <footer className="relative mt-16 text-center text-micro text-ey-gray1">
        EY SophIA Live, in collaboration with thePower.
      </footer>
    </main>
  );
}
