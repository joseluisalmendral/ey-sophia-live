/**
 * Sep — the broadcast middle-dot separator ("EN DIRECTO · 12 VOTOS") drawn as
 * a small disc with symmetric margins: the display font's "·" glyph sits off
 * centre in its advance, which read as "A ·B" on the projector.
 */
export function Sep({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={[
        "mx-[0.55em] inline-block h-[0.2em] w-[0.2em] shrink-0 self-center rounded-full bg-current opacity-60",
        className ?? "",
      ].join(" ")}
    />
  );
}

export default Sep;
