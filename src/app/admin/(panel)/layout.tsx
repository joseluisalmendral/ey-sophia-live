import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims, isAdmin } from "@/lib/supabase/auth";
import { EyBeam } from "@/components/brand/EyBeam";
import { SignOutButton } from "@/components/admin/SignOutButton";

/**
 * Protected admin layout (route group `(panel)`).
 *
 * The login page lives OUTSIDE this group (at /admin/login) so it is never
 * gated — avoiding a redirect loop. Everything inside `(panel)` is gated:
 *   - not authenticated         -> redirect to /admin/login
 *   - authenticated, NOT admin  -> clear "No autorizado" screen + sign-out
 *   - authenticated allowlisted -> the panel chrome + page
 *
 * Authz uses getClaims() (local verified JWT) + isAdmin() (admins table, with
 * ADMIN_ALLOWLIST env fallback). The DB's is_admin() RLS is the real wall; this
 * is the UI/route guard.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const claims = await getClaims();
  if (!claims) {
    redirect("/admin/login");
  }

  const authorized = await isAdmin();
  if (!authorized) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-surface-raised p-8 text-center shadow-[var(--shadow-e2)]">
          <div
            aria-hidden
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6B6B]/15 text-3xl"
          >
            🔒
          </div>
          <h1 className="font-display text-h2 font-extrabold text-text">
            No autorizado
          </h1>
          <p className="mt-2 text-small text-text-dim">
            La cuenta{" "}
            <span className="font-medium text-text">{claims.email}</span> no está
            en la lista de administradores. Si creés que es un error, pedile a un
            administrador que te agregue.
          </p>
          <div className="mt-6 flex justify-center">
            <SignOutButton variant="solid" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link
            href="/admin"
            className="flex items-center gap-3"
            aria-label="Panel de administración SophIA"
          >
            <EyBeam surface="dark" size={26} label="" />
            <span className="font-display text-h3 font-bold text-text">
              SophIA <span className="text-text-dim">· Admin</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/admins"
              className="text-small text-text-dim transition-colors hover:text-text"
            >
              Administradores
            </Link>
            <span
              className="hidden text-micro text-text-dim sm:inline"
              title={claims.email ?? undefined}
            >
              {claims.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
