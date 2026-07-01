"use client";

import { COPY, CheckIcon, ViewWrap } from "./shared";

/** Neutral "Ya votaste" view — no team, no rank (we don't know their vote). */
export function AlreadyVotedView({ reduced }: { reduced: boolean }) {
  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-power-green/50 bg-power-green/10 text-power-green">
          <CheckIcon size={48} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-h1 font-extrabold text-text">
            {COPY.alreadyTitle}
          </h2>
          <p className="max-w-xs text-balance text-small leading-relaxed text-text-dim">
            {COPY.alreadySub}
          </p>
        </div>
        <span className="font-display text-body font-bold text-ey-yellow">
          {COPY.watch}
        </span>
      </div>
    </ViewWrap>
  );
}
