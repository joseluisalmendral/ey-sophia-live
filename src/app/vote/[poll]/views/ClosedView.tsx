"use client";

import { SophiaBanner } from "@/components/brand/SophiaBanner";
import { COPY, ViewWrap } from "./shared";

/** Neutral closed view — shown when the poll closed without a fresh vote. */
export function ClosedView({ reduced }: { reduced: boolean }) {
  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        <SophiaBanner variant="confirmation" />
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-h1 font-extrabold text-text">
            {COPY.closedTitle}
          </h2>
          <p className="max-w-xs text-balance text-small leading-relaxed text-text-dim">
            {COPY.closedSub}
          </p>
        </div>
        <span className="font-display text-body font-bold text-ey-yellow">
          {COPY.watch}
        </span>
      </div>
    </ViewWrap>
  );
}
