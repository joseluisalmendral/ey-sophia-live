import type { ChartType, TieRule } from "@/lib/types";

/**
 * /lab rehearsal scenarios (pure data).
 *
 * Votes are scripted as CUMULATIVE per-team counts at seconds-since-open
 * (piecewise-linear vote rates). The engine spreads each segment's delta with
 * a seeded jitter, so counts are exact at every keyframe (guaranteed ties and
 * margins) and organic in between.
 */

export interface ScenarioTeam {
  id: string;
  name: string;
  color: string;
}

/** [secondsSinceOpen, cumulative counts per team in scenario order]. */
export type TallyKeyframe = readonly [number, readonly number[]];

export interface Scenario {
  id: string;
  /** Control-room label. */
  name: string;
  description: string;
  /** Poll title shown on the projector. */
  title: string;
  joinCode: string;
  teams: ScenarioTeam[];
  chartType: ChartType;
  anonymous: boolean;
  tieRule: TieRule;
  /** Seconds in draft before the count-in (or before opening). */
  lobbySec: number;
  /** Count-in length; 0 = the admin opens straight from the lobby. */
  countInSec: number;
  /** Configured duration; null = manual close (no on-screen countdown). */
  durationSec: number | null;
  /** Manual close moment (seconds since open) when durationSec is null. */
  manualCloseSec?: number;
  /** Distinct lobby joins reached by the open. */
  joinTarget: number;
  tally: TallyKeyframe[];
  /** Extra scrubber beats (seconds since open). */
  marks?: { at: number; label: string }[];
}

const GREEN = "#2DB67C";
const PURPLE = "#8B5CF6";
const ORANGE = "#F97316";
const BLUE = "#3B82F6";
const YELLOW = "#FACC15";

const TITLE = "IA Hackathon · Gran final";

export const SCENARIOS: Scenario[] = [
  {
    id: "final-ajustada",
    name: "Final ajustada",
    description: "3 equipos, 170 en la sala, 60 s, 3 cambios de líder, empate a los 40 s y victoria por 2.",
    title: TITLE,
    joinCode: "LAB27",
    teams: [
      { id: "fa-neuronas", name: "Neuronas Nómadas", color: GREEN },
      { id: "fa-prompt", name: "Prompt y Circunstancia", color: PURPLE },
      { id: "fa-tokens", name: "Los Tokenizados", color: ORANGE },
    ],
    chartType: "bar_race",
    anonymous: false,
    tieRule: "first_to_count",
    lobbySec: 12,
    countInSec: 8,
    durationSec: 60,
    joinTarget: 170,
    tally: [
      [0, [0, 0, 0]],
      [8, [6, 4, 3]],
      [18, [14, 17, 9]],
      [28, [26, 24, 15]],
      [40, [34, 34, 22]],
      [52, [44, 46, 29]],
      [60, [50, 52, 33]],
    ],
    marks: [
      { at: 18, label: "Cambio de líder" },
      { at: 28, label: "Remontada" },
      { at: 40, label: "Empate" },
      { at: 52, label: "Nuevo líder" },
    ],
  },
  {
    id: "ventaja-clara",
    name: "Ventaja clara",
    description: "Un equipo se escapa desde el principio y cierra con el 65 % de los votos.",
    title: TITLE,
    joinCode: "LAB27",
    teams: [
      { id: "vc-cafe", name: "Café y Algoritmos", color: BLUE },
      { id: "vc-datos", name: "Datos al Horno", color: GREEN },
      { id: "vc-bots", name: "Bots con Botas", color: ORANGE },
    ],
    chartType: "bar_race",
    anonymous: false,
    tieRule: "first_to_count",
    lobbySec: 10,
    countInSec: 5,
    durationSec: 45,
    joinTarget: 140,
    tally: [
      [0, [0, 0, 0]],
      [10, [12, 4, 3]],
      [25, [34, 11, 8]],
      [45, [78, 26, 16]],
    ],
  },
  {
    id: "empate-cierre",
    name: "Empate al cierre",
    description: "Dos equipos llegan empatados al cierre; prueba la regla de desempate (doble corona).",
    title: TITLE,
    joinCode: "LAB27",
    teams: [
      { id: "ec-rojo", name: "Equipo Rojo Pasión", color: PURPLE },
      { id: "ec-verde", name: "Los Verdes del Excel", color: GREEN },
      { id: "ec-azul", name: "Azul Consultoría", color: BLUE },
    ],
    chartType: "bar_race",
    anonymous: false,
    tieRule: "double_crown",
    lobbySec: 10,
    countInSec: 5,
    durationSec: 45,
    joinTarget: 120,
    tally: [
      [0, [0, 0, 0]],
      [10, [8, 9, 4]],
      [20, [15, 18, 9]],
      [30, [26, 24, 14]],
      [40, [33, 34, 18]],
      [45, [38, 38, 20]],
    ],
    marks: [{ at: 45, label: "Empate final" }],
  },
  {
    id: "sin-duracion",
    name: "Sin duración",
    description: "Sin cuenta atrás de cierre: los votos se paran a los 30 s y el admin cierra tras 25 s de calma.",
    title: TITLE,
    joinCode: "LAB27",
    teams: [
      { id: "sd-norte", name: "Norte Digital", color: BLUE },
      { id: "sd-sur", name: "Sur Analítico", color: YELLOW },
      { id: "sd-este", name: "Este Creativo", color: PURPLE },
    ],
    chartType: "bar_race",
    anonymous: false,
    tieRule: "first_to_count",
    lobbySec: 10,
    countInSec: 0,
    durationSec: null,
    manualCloseSec: 55,
    joinTarget: 90,
    tally: [
      [0, [0, 0, 0]],
      [10, [7, 5, 6]],
      [20, [15, 12, 11]],
      [30, [22, 18, 14]],
      [55, [22, 18, 14]],
    ],
    marks: [{ at: 30, label: "Calma" }],
  },
  {
    id: "cinco-equipos",
    name: "5 equipos, nombres largos",
    description: "Cinco finalistas con nombres largos para probar truncado y maquetación.",
    title: TITLE,
    joinCode: "LAB27",
    teams: [
      { id: "ce-auditores", name: "Los Auditores del Prompt Perdido", color: GREEN },
      { id: "ce-cuanticos", name: "Consultores Cuánticos Sin Fronteras", color: PURPLE },
      { id: "ce-hojas", name: "Las Hojas de Cálculo Rebeldes", color: ORANGE },
      { id: "ce-brigada", name: "Brigada de Transformación Digital", color: BLUE },
      { id: "ce-cafe", name: "Equipo Café y Algoritmos", color: YELLOW },
    ],
    chartType: "bar_race",
    anonymous: false,
    tieRule: "first_to_count",
    lobbySec: 12,
    countInSec: 5,
    durationSec: 50,
    joinTarget: 200,
    tally: [
      [0, [0, 0, 0, 0, 0]],
      [10, [5, 7, 4, 6, 3]],
      [25, [14, 15, 12, 13, 9]],
      [40, [24, 22, 21, 25, 16]],
      [50, [31, 28, 27, 30, 20]],
    ],
  },
];

export const DEFAULT_SCENARIO_ID = SCENARIOS[0].id;

export function getScenario(id?: string | null): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}
