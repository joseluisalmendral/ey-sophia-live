import Image from "next/image";
import Link from "next/link";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { EyBeam } from "@/components/brand/EyBeam";
import { JoinByCode } from "./JoinByCode";
import { HomeBroqui } from "./HomeBroqui";

/**
 * Home hub — the public `/` route.
 *
 * A Kahoot-style JOIN-BY-CODE surface: the attendee lands here, types the code
 * from the projector, and is handed off to their voting room (`/vote/[code]`).
 * Most attendees actually enter by scanning the projector QR; this page is the
 * typed-code fallback. The admin door is demoted to the footer.
 *
 * Composition (spec §3.1.1): brand lockup (no card) → ONE glass card "Únete a
 * la sala" with the code input, Broqui peeking over its corner → footer. The
 * only client JS is the <JoinByCode /> form island and the small mascot cameo.
 */
export default function Home() {
  return (
    <ShaderBackground>
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col justify-center gap-9 py-6">
          {/* Lockup — no card. */}
          <div className="flex flex-col items-center gap-3 text-center">
            <EyBeam surface="dark" size={48} label="EY" />
            <p className="font-display text-[2.25rem] font-black leading-none tracking-tight text-text">
              <span className="text-ey-yellow">IA</span> HACKATHON
            </p>
            <p className="font-display text-m-label font-extrabold uppercase tracking-[0.28em] text-text-dim">
              #EYBOOTCAMPFY27
            </p>
          </div>

          <section aria-labelledby="join-heading" className="relative">
            <HomeBroqui />
            <div className="glass px-5 pb-6 pt-6 sm:px-6">
              <h1
                id="join-heading"
                className="pr-20 font-display text-m-title font-extrabold leading-tight text-text"
              >
                Únete a la sala
              </h1>
              <p className="mt-1.5 pr-16 text-[0.9375rem] leading-snug text-text-dim">
                Escanea el QR de la pantalla o escribe aquí el código.
              </p>
              <div className="mt-6">
                <JoinByCode />
              </div>
            </div>
          </section>
        </div>

        <footer className="flex flex-col items-center gap-3 pt-4 text-center">
          <span className="inline-flex items-center gap-2 text-m-label text-text-dim">
            en colaboración con
            <Image
              src="/brand/thepower-logo.webp"
              alt="thePower"
              width={72}
              height={24}
              className="h-auto w-[72px] opacity-80 [filter:brightness(0)_invert(1)]"
            />
          </span>
          <Link
            href="/admin"
            className="text-m-label font-medium text-text-dim/70 underline-offset-4 transition-colors duration-150 hover:text-text hover:underline"
          >
            Acceso organización
          </Link>
        </footer>
      </main>
    </ShaderBackground>
  );
}
