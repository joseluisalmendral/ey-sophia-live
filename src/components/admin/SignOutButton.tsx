"use client";

import { useTransition } from "react";
import { signOut } from "@/app/admin/actions";

/**
 * SignOutButton — triggers the signOut server action. Two visual variants so it
 * can sit subtly in the admin header or prominently on the unauthorized screen.
 */
export function SignOutButton({
  variant = "ghost",
}: {
  variant?: "ghost" | "solid";
}) {
  const [pending, startTransition] = useTransition();

  const base =
    "inline-flex h-9 items-center justify-center rounded-lg px-4 text-small font-medium transition-opacity disabled:opacity-50";
  const styles =
    variant === "solid"
      ? "bg-ey-yellow text-ey-confident hover:opacity-90"
      : "border border-white/15 text-text-dim hover:text-text";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void signOut())}
      className={`${base} ${styles}`}
    >
      {pending ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}

export default SignOutButton;
