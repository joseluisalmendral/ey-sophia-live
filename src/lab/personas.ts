import type { Action } from "@/app/vote/[poll]/phase";
import type { Timeline } from "./engine";

/**
 * /lab phone personas — scripted voters whose ACTION is a pure function of
 * the virtual time. Each phone frame feeds that action to the REAL
 * derivePhase, so the phones walk exactly the production state machine.
 */

export type PersonaId = "ana" | "luis" | "marta" | "pablo";

export const PERSONA_IDS: readonly PersonaId[] = ["ana", "luis", "marta", "pablo"];

export interface PersonaState {
  action: Action;
  selectedId: string | null;
  /** Team of a fresh 'ok' vote (null for 'already' / no vote). */
  votedTeamId: string | null;
}

export interface PersonaDef {
  id: PersonaId;
  name: string;
  /** Control-room caption (Spanish). */
  script: string;
}

export const PERSONAS: Record<PersonaId, PersonaDef> = {
  ana: { id: "ana", name: "Ana", script: "Vota al equipo 1 a los 8 s" },
  luis: { id: "luis", name: "Luis", script: "Vota en los últimos 3 s" },
  marta: { id: "marta", name: "Marta", script: "Duda y nunca vota" },
  pablo: { id: "pablo", name: "Pablo", script: "Vota y recarga → «Ya votaste»" },
};

export function isPersonaId(v: string | undefined | null): v is PersonaId {
  return !!v && (PERSONA_IDS as readonly string[]).includes(v);
}

interface Step {
  at: number;
  patch: Partial<PersonaState>;
}

const IDLE: PersonaState = { action: "idle", selectedId: null, votedTeamId: null };
/** Fake submit round-trip, like a real POST /api/vote on venue Wi-Fi. */
const SUBMIT_SEC = 0.6;

function vote(at: number, teamId: string, pickLead = 2.5): Step[] {
  return [
    { at: at - pickLead, patch: { selectedId: teamId } },
    { at, patch: { action: "submitting" } },
    { at: at + SUBMIT_SEC, patch: { action: "voted", votedTeamId: teamId } },
  ];
}

function script(id: PersonaId, tl: Timeline): Step[] {
  const teams = tl.scenario.teams;
  const team = (i: number) => teams[i % teams.length].id;
  const { openAt, closeAt } = tl;
  switch (id) {
    case "ana":
      return vote(openAt + 8, team(0), 3);
    case "luis":
      return vote(closeAt - 3, team(1), 3);
    case "marta":
      // Picks a card, hesitates, never submits → closedNoVote.
      return [{ at: openAt + 20, patch: { selectedId: team(2) } }];
    case "pablo":
      return [
        ...vote(openAt + 14, team(2), 2),
        // Reload: the fresh vote is forgotten, only the neutral cookie remains.
        { at: openAt + 22, patch: { action: "already", votedTeamId: null, selectedId: null } },
      ];
  }
}

export function personaStateAt(id: PersonaId, tl: Timeline, t: number): PersonaState {
  let state = IDLE;
  for (const step of script(id, tl)) {
    if (step.at <= t) state = { ...state, ...step.patch };
  }
  return state;
}

export function personaStatesAt(tl: Timeline, t: number): Record<PersonaId, PersonaState> {
  return {
    ana: personaStateAt("ana", tl, t),
    luis: personaStateAt("luis", tl, t),
    marta: personaStateAt("marta", tl, t),
    pablo: personaStateAt("pablo", tl, t),
  };
}
