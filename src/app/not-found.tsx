import Link from "next/link";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { EyBeam } from "@/components/brand/EyBeam";

/**
 * 404 — branded cosmic "not found" for missing polls/routes.
 */
export default function NotFound() {
  return (
    <ShaderBackground>
      <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-6">
          <EyBeam surface="dark" size={64} />
          <span className="font-display text-display-xl font-extrabold leading-none text-ey-yellow">
            404
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-h1 font-extrabold text-text">
              No encontramos esta votación
            </h1>
            <p className="max-w-sm text-body text-text-dim">
              El enlace puede haber caducado o el código no es correcto.
              Verifica el código de acceso con el organizador.
            </p>
          </div>
          <Link
            href="/"
            className="h-12 rounded-lg bg-ey-yellow px-6 font-display text-body font-bold leading-[3rem] text-ey-confident transition-opacity hover:opacity-90"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    </ShaderBackground>
  );
}
