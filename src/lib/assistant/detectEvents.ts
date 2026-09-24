/**
 * detectEvents — pure event detection over the projector's derived data stream
 * (ranked teams + status + closesAt + joined). Read-only: it never subscribes
 * to anything; the host feeds it every snapshot and a periodic tick.
 *
 * Spec table (xp/05 §4.8) with stability windows:
 *   first_vote   total 0 → >0                                   prio 80  once
 *   lead_change  new rank-1 id, stable ≥ 1.5 s, count > 0, no tie   70  12 s
 *   tie_top      top-2 equal, total ≥ 4, stable ≥ 0.8 s              65  20 s
 *   milestone    total crosses 10/25/50/75/100/150/200               50  15 s
 *   surge        ≥ max(5, 8 % of total) votes in the last 5 s         55  20 s
 *   landslide    leader share ≥ 60 %, total ≥ 20                      40  60 s
 *   quiet        open, no new vote for 20 s (re-fires every 30 s)     30  30 s
 *   last10       closesAt − now ≤ 10 s                                95  once
 *   count_in     status → countdown                                   90  once
 *   lobby_joins  joined crosses 10/25/50/100/150                      50  15 s
 *   close        status → closed                                     100  once
 *   reveal_winner podium beat settled (fed by the host as `podiumSettled`) 100 once
 *
 * Cooldowns/once-per-run are enforced by the scheduler; this module only
 * decides WHEN a condition becomes true (edge-triggered).
 */

import type { PollStatus } from "@/lib/types";

export type AssistantEventType =
  | "first_vote"
  | "lead_change"
  | "tie_top"
  | "milestone"
  | "surge"
  | "landslide"
  | "quiet"
  | "last10"
  | "count_in"
  | "lobby_joins"
  | "close"
  | "reveal_winner";

export interface AssistantEvent {
  type: AssistantEventType;
  /** Wall-clock ms when the condition became true. */
  at: number;
  /** Optional payload for the resolver (milestone value, surge size…). */
  milestone?: number;
  votes?: number;
  leaderId?: string;
}

export const EVENT_PRIORITY: Record<AssistantEventType, number> = {
  first_vote: 80,
  lead_change: 70,
  tie_top: 65,
  milestone: 50,
  surge: 55,
  landslide: 40,
  quiet: 30,
  last10: 95,
  count_in: 90,
  lobby_joins: 50,
  close: 100,
  reveal_winner: 100,
};

/** Cooldown in ms; `null` = once per run. */
export const EVENT_COOLDOWN_MS: Record<AssistantEventType, number | null> = {
  first_vote: null,
  lead_change: 12_000,
  tie_top: 20_000,
  milestone: 15_000,
  surge: 20_000,
  landslide: 60_000,
  quiet: 30_000,
  last10: null,
  count_in: null,
  lobby_joins: 15_000,
  close: null,
  reveal_winner: null,
};

export const VOTE_MILESTONES = [10, 25, 50, 75, 100, 150, 200] as const;
export const JOIN_MILESTONES = [10, 25, 50, 100, 150] as const;

export const LEAD_STABLE_MS = 1500;
export const TIE_STABLE_MS = 800;
export const SURGE_WINDOW_MS = 5000;
export const QUIET_AFTER_MS = 20_000;
export const QUIET_REPEAT_MS = 30_000;
export const LAST10_MS = 10_000;

export interface DetectorTeam {
  id: string;
  count: number;
  rank: number;
}

export interface DetectorInput {
  now: number;
  status: PollStatus;
  teams: readonly DetectorTeam[];
  closesAt: string | null;
  joined: number | null;
  /** True once the podium beat has settled (host-fed, reveal only). */
  podiumSettled?: boolean;
}

export interface DetectorState {
  status: PollStatus | null;
  total: number;
  lastVoteAt: number | null;
  /** Confirmed leader (spoken about). */
  leaderId: string | null;
  /** Candidate leader awaiting the stability window. */
  pendingLeaderId: string | null;
  pendingLeaderSince: number;
  tieSince: number | null;
  tieAnnounced: boolean;
  /** [time, total] samples for the surge window. */
  history: readonly (readonly [number, number])[];
  voteMilestone: number;
  joinMilestone: number;
  firstVoteFired: boolean;
  last10Fired: boolean;
  countInFired: boolean;
  closeFired: boolean;
  winnerFired: boolean;
  quietFiredAt: number | null;
  landslideOn: boolean;
}

export function createDetectorState(): DetectorState {
  return {
    status: null,
    total: 0,
    lastVoteAt: null,
    leaderId: null,
    pendingLeaderId: null,
    pendingLeaderSince: 0,
    tieSince: null,
    tieAnnounced: false,
    history: [],
    voteMilestone: 0,
    joinMilestone: 0,
    firstVoteFired: false,
    last10Fired: false,
    countInFired: false,
    closeFired: false,
    winnerFired: false,
    quietFiredAt: null,
    landslideOn: false,
  };
}

function topTwo(teams: readonly DetectorTeam[]): [DetectorTeam | null, DetectorTeam | null] {
  const sorted = [...teams].sort((a, b) => b.count - a.count || a.rank - b.rank);
  return [sorted[0] ?? null, sorted[1] ?? null];
}

/**
 * Advance the detector with a fresh snapshot (or a tick with unchanged data).
 * Returns the next state and the events that became true at `input.now`.
 */
export function detectEvents(
  prev: DetectorState,
  input: DetectorInput,
): { state: DetectorState; events: AssistantEvent[] } {
  const { now, status, teams, closesAt, joined } = input;
  const events: AssistantEvent[] = [];
  const s: DetectorState = { ...prev };
  const total = teams.reduce((acc, t) => acc + t.count, 0);
  const isOpen = status === "open";

  /* ---- status transitions ---- */
  const first = prev.status === null;
  if (prev.status !== status) {
    if (status === "countdown" && !s.countInFired && !first) {
      s.countInFired = true;
      events.push({ type: "count_in", at: now });
    }
    if (status === "closed" && !s.closeFired && !first) {
      s.closeFired = true;
      events.push({ type: "close", at: now });
    }
    if (status === "open") {
      // Fresh run: the quiet timer starts at the open, not at the last vote.
      s.lastVoteAt = now;
      s.quietFiredAt = null;
      s.history = [[now, total]];
    }
    s.status = status;
  }

  /* ---- lobby joins ---- */
  if ((status === "draft" || status === "countdown") && joined !== null) {
    let reached = s.joinMilestone;
    for (const m of JOIN_MILESTONES) if (joined >= m && m > reached) reached = m;
    if (reached > s.joinMilestone) {
      s.joinMilestone = reached;
      // Milestones already crossed before the mascot mounted stay silent.
      if (!first) events.push({ type: "lobby_joins", at: now, milestone: reached, votes: joined });
    }
  }

  /* ---- votes ---- */
  if (total !== prev.total) {
    if (total > prev.total) s.lastVoteAt = now;
    s.total = total;
    s.history = [...prev.history.filter(([t]) => now - t <= SURGE_WINDOW_MS), [now, total]];
  }

  if (isOpen) {
    if (total > 0 && prev.total === 0 && !s.firstVoteFired && !first) {
      s.firstVoteFired = true;
      events.push({ type: "first_vote", at: now, votes: total });
    }
    if (total > 0) s.firstVoteFired = true;

    // Milestones (only the highest newly crossed one is announced).
    let reached = s.voteMilestone;
    for (const m of VOTE_MILESTONES) if (total >= m && m > reached) reached = m;
    if (reached > s.voteMilestone) {
      if (!first) events.push({ type: "milestone", at: now, milestone: reached, votes: total });
      s.voteMilestone = reached;
    }

    // Surge: votes in the last 5 s.
    const window = s.history.filter(([t]) => now - t <= SURGE_WINDOW_MS);
    if (window.length >= 2) {
      const gained = total - window[0][1];
      const threshold = Math.max(5, Math.ceil(total * 0.08));
      if (gained >= threshold && total >= 8) {
        events.push({ type: "surge", at: now, votes: gained });
        // Reset the window so the same burst is not counted twice.
        s.history = [[now, total]];
      }
    }

    // Lead change / tie on the top two.
    const [a, b] = topTwo(teams);
    const tied = a !== null && b !== null && a.count === b.count && a.count > 0;
    if (tied && total >= 4) {
      if (s.tieSince === null) s.tieSince = now;
      if (!s.tieAnnounced && now - s.tieSince >= TIE_STABLE_MS) {
        s.tieAnnounced = true;
        events.push({ type: "tie_top", at: now, votes: total });
      }
      s.pendingLeaderId = null;
    } else {
      s.tieSince = null;
      s.tieAnnounced = false;
      const leaderId = a && a.count > 0 ? a.id : null;
      if (leaderId === null) {
        s.pendingLeaderId = null;
      } else if (leaderId === s.leaderId) {
        s.pendingLeaderId = null;
      } else {
        if (s.pendingLeaderId !== leaderId) {
          s.pendingLeaderId = leaderId;
          s.pendingLeaderSince = now;
        }
        if (now - s.pendingLeaderSince >= LEAD_STABLE_MS) {
          const hadLeader = s.leaderId !== null;
          s.leaderId = leaderId;
          s.pendingLeaderId = null;
          if (hadLeader) events.push({ type: "lead_change", at: now, leaderId });
        }
      }
    }

    // Landslide (edge-triggered; re-arms when the share drops below 55 %).
    const share = a && total > 0 ? a.count / total : 0;
    if (total >= 20 && share >= 0.6 && !tied) {
      if (!s.landslideOn) {
        s.landslideOn = true;
        events.push({ type: "landslide", at: now, votes: total });
      }
    } else if (share < 0.55) {
      s.landslideOn = false;
    }

    // Quiet: no new vote for 20 s, then every 30 s while it stays quiet.
    const since = s.lastVoteAt ?? now;
    const silentFor = now - since;
    if (silentFor >= QUIET_AFTER_MS) {
      const lastFired = s.quietFiredAt;
      if (lastFired === null || lastFired < since || now - lastFired >= QUIET_REPEAT_MS) {
        s.quietFiredAt = now;
        events.push({ type: "quiet", at: now });
      }
    }

    // Last 10 s (only with a server-authoritative close).
    if (closesAt && !s.last10Fired) {
      const left = new Date(closesAt).getTime() - now;
      if (left <= LAST10_MS && left > 1500) {
        s.last10Fired = true;
        events.push({ type: "last10", at: now, votes: Math.round(left / 1000) });
      }
    }
  } else {
    // Keep the confirmed leader across the close so the reveal can reference it.
    s.pendingLeaderId = null;
    s.tieSince = null;
    s.tieAnnounced = false;
  }

  /* ---- reveal ---- */
  if (status === "closed" && input.podiumSettled && !s.winnerFired) {
    s.winnerFired = true;
    events.push({ type: "reveal_winner", at: now });
  }

  return { state: s, events };
}
