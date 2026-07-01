"use client";

import { useState } from "react";

/**
 * CopyButton — copies a value to the clipboard with brief visual confirmation.
 * Used for quick-copying voter/projector URLs and join codes during an event.
 */
export function CopyButton({
  value,
  label = "Copiar",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context); silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 px-2.5 text-micro font-medium text-text-dim transition-colors hover:text-text"
      }
      aria-label={`${label}: ${value}`}
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}

export default CopyButton;
