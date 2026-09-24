"use client";

import { COPY, LockIcon, ViewWrap, WatchPill } from "./shared";
import { StatusGlyph } from "./StatusGlyph";

/** Neutral "Ya votaste" view — no team, no rank (we don't know their vote). */
export function AlreadyVotedView({ reduced }: { reduced: boolean }) {
  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16 pt-4 text-center">
        <StatusGlyph tone="var(--color-power-green)" reduced={reduced}>
          <LockIcon size={40} />
        </StatusGlyph>
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-display text-m-hero font-black leading-none text-text">
            {COPY.alreadyTitle}
          </h1>
          <p className="max-w-[17rem] text-balance text-m-body leading-snug text-text-dim">
            {COPY.alreadySub}
          </p>
        </div>
        <WatchPill reduced={reduced} delay={0.2} />
      </div>
    </ViewWrap>
  );
}
