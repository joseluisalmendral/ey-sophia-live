import Link from "next/link";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { SophiaBanner } from "@/components/brand/SophiaBanner";
import { JoinByCode } from "./JoinByCode";

/**
 * Home hub — the public `/` route.
 *
 * A Kahoot-style JOIN-BY-CODE surface: the attendee lands here, types the code
 * from the projector, and is handed off to their voting room (`/vote/[code]`).
 * Most attendees actually enter by scanning the projector QR; this page is the
 * typed-code fallback plus a discreet door to the admin panel.
 *
 * Composition: a server shell (this file) over the shared ShaderBackground with
 * the SophiaBanner hero. The only client JS shipped is the small <JoinByCode />
 * form island, so the public entry point stays light.
 */
export default function Home() {
  return (
    <ShaderBackground>
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-5 py-12">
        <SophiaBanner
          variant="hero"
          tagline="Vota en directo y mira cómo los resultados se disparan en la pantalla grande."
        />

        <section
          aria-labelledby="join-heading"
          className="mt-8 rounded-2xl border border-white/10 bg-cosmic-deep/60 p-5 shadow-[var(--shadow-e2)] backdrop-blur-sm sm:p-6"
        >
          <h1
            id="join-heading"
            className="font-display text-h3 font-extrabold text-text"
          >
            Únete a la sala
          </h1>
          <p className="mt-1 text-small leading-relaxed text-text-dim">
            ¿Estás en la sala? Normalmente entras escaneando el QR de la
            pantalla, o mete el código aquí.
          </p>

          <div className="mt-5">
            <JoinByCode />
          </div>
        </section>

        <div className="mt-8 text-center">
          <Link
            href="/admin"
            className="text-small font-medium text-text-dim underline-offset-4 transition-colors duration-150 hover:text-text hover:underline"
          >
            Panel de administración
          </Link>
        </div>

        <footer className="mt-10 text-center text-micro text-ey-gray1">
          EY SophIA Live, en colaboración con thePower.
        </footer>
      </main>
    </ShaderBackground>
  );
}
