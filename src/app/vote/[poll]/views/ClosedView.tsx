"use client";

import { ClockIcon, COPY, ViewWrap, WatchPill } from "./shared";
import { StatusGlyph } from "./StatusGlyph";

/**
 * Neutral closed view — shown when the poll closed without a fresh vote.
 * `justMissed` switches to the honest variant for a voter whose submit bounced
 * with 'closed' (the poll closed just before their vote landed).
 */
export function ClosedView({
  reduced,
  justMissed = false,
}: {
  reduced: boolean;
  justMissed?: boolean;
}) {
  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16 pt-4 text-center">
        <StatusGlyph tone="var(--color-text-dim)" reduced={reduced}>
          <ClockIcon size={40} />
        </StatusGlyph>
        <div className="flex flex-col items-center gap-2">
          <h1 className="max-w-[19rem] text-balance font-display text-m-title font-extrabold leading-[1.1] text-text">
            {justMissed ? COPY.closedJustMissedTitle : COPY.closedTitle}
          </h1>
          <p className="max-w-[18rem] text-balance text-m-body leading-snug text-text-dim">
            {justMissed ? COPY.closedJustMissedSub : COPY.closedSub}
          </p>
        </div>
        <WatchPill reduced={reduced} delay={0.2} />
      </div>
    </ViewWrap>
  );
}
