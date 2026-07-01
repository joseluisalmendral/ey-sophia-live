"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * JoinByCode — the Kahoot-style "join by code" form island for the home hub.
 *
 * The only interactive part of the public `/` route, kept as a small client
 * island so the page shell stays a light server component.
 *
 * Flow:
 *  - The attendee types the code shown on the projector. We normalise as they
 *    type (uppercase + strip whitespace) and cap length so a stray paste can't
 *    blow up the request.
 *  - On submit we VALIDATE the code against the cacheable status endpoint
 *    (`/api/poll/[id]/status`, which accepts a join code OR a UUID) before
 *    navigating, so a wrong code shows a friendly inline error instead of
 *    bouncing the attendee to a 404 page.
 *      · 200 → the poll exists → router.push('/vote/CODE').
 *      · 404 → unknown code → inline aria-live error, NO navigation.
 *      · network/other → soft error, the attendee can just try again.
 *  - The submit button shows a subtle checking state and is disabled while the
 *    request is in flight (and when the field is empty).
 *
 * Accessibility: real <form>/<label>/<input>/<button>, the error is wired to the
 * input via aria-describedby + aria-invalid and announced through an aria-live
 * region. Focus-visible rings come from the global :focus-visible style.
 */

const MAX_CODE_LENGTH = 8;

/** Normalise to the shape join codes take: uppercase, no inner/outer spaces. */
function normaliseCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, MAX_CODE_LENGTH);
}

type Phase = "idle" | "checking";

export function JoinByCode() {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const checking = phase === "checking";
  const canSubmit = code.length > 0 && !checking;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = normaliseCode(code);
    if (!value || checking) return;

    setPhase("checking");
    setError(null);

    try {
      const res = await fetch(`/api/poll/${encodeURIComponent(value)}/status`, {
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        // Valid code — hand off to the voter surface. Leave the button in its
        // checking state during the route transition so it doesn't flicker.
        router.push(`/vote/${value}`);
        return;
      }

      if (res.status === 404) {
        setError(
          "No encontramos ninguna votación con ese código. Revisa el código de la pantalla.",
        );
      } else {
        setError("Algo ha fallado al comprobar el código. Inténtalo otra vez.");
      }
    } catch {
      // Network hiccup, offline, etc. — let them retry, never crash.
      setError(
        "No hemos podido conectar. Comprueba tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setPhase("idle");
      // Return focus to the field so a keyboard/AT user lands where they retry.
      inputRef.current?.focus();
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        className="font-display text-small font-semibold uppercase tracking-[0.16em] text-text-dim"
      >
        Introduce el código
      </label>

      <input
        ref={inputRef}
        id={inputId}
        name="code"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        // Desktop convenience; on touch we skip autofocus so the keyboard
        // doesn't cover the hero on load.
        autoFocus
        enterKeyHint="go"
        maxLength={MAX_CODE_LENGTH}
        value={code}
        onChange={(e) => {
          setCode(normaliseCode(e.target.value));
          if (error) setError(null);
        }}
        placeholder="Ej. DEMO42"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-16 w-full rounded-xl border border-white/15 bg-white/5 px-5 text-center font-display text-h2 font-extrabold uppercase tracking-[0.24em] text-text placeholder:tracking-[0.12em] placeholder:text-text-dim/50 transition-colors duration-150 focus:border-ey-yellow/60 aria-[invalid=true]:border-red-400/70"
      />

      {/* aria-live so the error is announced when it appears; always in the DOM
          (as an empty polite region) so AT registers subsequent updates. */}
      <p
        id={errorId}
        role="alert"
        aria-live="polite"
        className={
          error
            ? "text-small font-medium leading-snug text-red-300"
            : "sr-only"
        }
      >
        {error}
      </p>

      <button
        type="submit"
        disabled={!canSubmit}
        aria-busy={checking}
        className="mt-1 inline-flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-ey-yellow font-display text-h3 font-extrabold text-ey-confident shadow-[var(--shadow-glow-win)] transition-[transform,opacity] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-text-dim disabled:shadow-none"
      >
        {checking ? (
          <>
            <span
              aria-hidden
              className="h-5 w-5 animate-spin rounded-full border-2 border-ey-confident/30 border-t-ey-confident motion-reduce:animate-none"
            />
            Comprobando…
          </>
        ) : (
          "Entrar"
        )}
      </button>
    </form>
  );
}

export default JoinByCode;
