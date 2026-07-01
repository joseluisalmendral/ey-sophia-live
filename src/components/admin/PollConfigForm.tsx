"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pickTextOn } from "@/lib/utils/contrast";
import { generateJoinCode } from "./joinCode";
import { colorForTeamName, KEYWORD_COLORS } from "./teamColorKeywords";
import {
  createPoll,
  updatePoll,
  type PollFormInput,
} from "@/app/admin/(panel)/poll-actions";
import type { ChartType, TieRule } from "@/lib/types";

/**
 * PollConfigForm — create/edit a poll and its teams.
 *
 * Teams editor: add/remove rows, each with a name + color picker that shows a
 * LIVE contrast preview (pickTextOn flips label black/white per WCAG so the
 * operator sees exactly how the team color reads with text on top).
 *
 * Also: countdown_seconds (pre-vote count-in), duration_seconds (optional
 * auto-close), chart_type, show_legend / show_names toggles, tie_rule, and a
 * memorable editable join code.
 */

interface TeamDraft {
  id?: string;
  name: string;
  color: string;
  /**
   * The operator touched this row's color picker AFTER the last keyword
   * auto-assignment — from then on the name never overwrites their choice.
   * UI-only; stripped from the save payload.
   */
  colorTouched?: boolean;
}

export interface PollConfigInitial {
  id?: string;
  title: string;
  joinCode: string;
  countdownSeconds: number | null;
  durationSeconds: number | null;
  chartType: ChartType;
  showLegend: boolean;
  showNames: boolean;
  tieRule: TieRule;
  teams: TeamDraft[];
  /** Locked when the poll is no longer a draft (teams/code shouldn't change mid-event). */
  locked?: boolean;
}

const DEFAULT_COLORS = [
  "#FFE600",
  "#96d3b4",
  "#7DB8FF",
  "#FF6B6B",
  "#C792EA",
  "#FFB86C",
];

/**
 * Colors this form can produce on its own (keyword auto-assignment + default
 * palette). A SAVED team whose color is NOT in this set was hand-picked by the
 * operator, so a later name edit must never auto-overwrite it — colorTouched
 * only lives for the current render session and is lost after saving.
 */
const AUTO_ASSIGNABLE_COLORS = new Set(
  [...KEYWORD_COLORS, ...DEFAULT_COLORS].map((c) => c.toLowerCase()),
);

export function PollConfigForm({ initial }: { initial: PollConfigInitial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(initial.id);
  const locked = initial.locked ?? false;

  const [title, setTitle] = useState(initial.title);
  const [joinCode, setJoinCode] = useState(initial.joinCode);
  const [countdown, setCountdown] = useState<string>(
    initial.countdownSeconds != null ? String(initial.countdownSeconds) : "",
  );
  const [duration, setDuration] = useState<string>(
    initial.durationSeconds != null ? String(initial.durationSeconds) : "",
  );
  const [chartType, setChartType] = useState<ChartType>(initial.chartType);
  const [showLegend, setShowLegend] = useState(initial.showLegend);
  const [showNames, setShowNames] = useState(initial.showNames);
  const [tieRule, setTieRule] = useState<TieRule>(initial.tieRule);
  const [teams, setTeams] = useState<TeamDraft[]>(
    initial.teams.length > 0
      ? initial.teams
      : [
          { name: "", color: DEFAULT_COLORS[0] },
          { name: "", color: DEFAULT_COLORS[1] },
        ],
  );
  const [error, setError] = useState<string | null>(null);

  // A poll needs at least 2 teams, each with a non-empty (trimmed) name, before
  // it can be saved/created — otherwise the voter/projector would render broken.
  const namedTeams = teams.filter((t) => t.name.trim().length > 0);
  const teamsValid = namedTeams.length >= 2;
  const canSave = Boolean(title.trim()) && teamsValid && !pending;

  function updateTeam(i: number, patch: Partial<TeamDraft>) {
    setTeams((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  /**
   * Name edits may auto-assign the color from a Spanish color keyword in the
   * name ("Equipo Rojo" → red), accent/case-insensitive. Auto-assignment only
   * applies while the operator has NOT customized that row's color by hand
   * after the last auto-set (colorTouched resets on every auto-set, so typing
   * a new color word keeps working after a manual tweak → new keyword wins
   * only when the picker was untouched since).
   *
   * EXISTING teams (t.id present) add a persistence-safe heuristic: colorTouched
   * does not survive a save, so a saved custom color would otherwise be
   * clobbered by fixing a typo in a keyword name ("Equipo Rojo" saved blue →
   * back to red). Auto-assignment only applies when the current color already
   * looks auto-assigned (keyword map or default palette); anything else is
   * treated as a deliberate custom choice and preserved.
   */
  function updateTeamName(i: number, name: string) {
    setTeams((prev) =>
      prev.map((t, idx) => {
        if (idx !== i) return t;
        const looksCustom =
          Boolean(t.id) && !AUTO_ASSIGNABLE_COLORS.has(t.color.toLowerCase());
        const keywordColor =
          t.colorTouched || looksCustom ? null : colorForTeamName(name);
        return keywordColor
          ? { ...t, name, color: keywordColor, colorTouched: false }
          : { ...t, name };
      }),
    );
  }
  function addTeam() {
    setTeams((prev) => [
      ...prev,
      { name: "", color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length] },
    ]);
  }
  function removeTeam(i: number) {
    setTeams((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Añade un título a la votación.");
      return;
    }
    if (!teamsValid) {
      setError("Añade al menos 2 equipos con nombre.");
      return;
    }
    const payload: PollFormInput = {
      id: initial.id,
      title,
      joinCode,
      countdownSeconds: countdown.trim() ? Number(countdown) : null,
      durationSeconds: duration.trim() ? Number(duration) : null,
      chartType,
      showLegend,
      showNames,
      tieRule,
      teams: teams.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    };
    startTransition(async () => {
      const res = isEdit ? await updatePoll(payload) : await createPoll(payload);
      if (!res.ok) {
        setError(res.error ?? "Error al guardar");
        return;
      }
      if (!isEdit && res.pollId) {
        router.push(`/admin/${res.pollId}`);
      } else {
        router.refresh();
      }
    });
  }

  const inputCls =
    "h-11 rounded-lg border border-white/15 bg-surface px-3 text-body text-text placeholder:text-text-dim/60 focus:border-focus focus:outline-none disabled:opacity-60";
  const labelCls = "text-small font-medium text-text-dim";

  return (
    <div className="flex flex-col gap-6">
      {locked && (
        <p className="rounded-lg border border-ey-yellow/30 bg-ey-yellow/5 px-4 py-2.5 text-small text-ey-yellow">
          Esta votación ya no está en borrador: el código y los equipos están
          bloqueados para no alterar un evento en curso.
        </p>
      )}

      {/* Title + join code */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="¿Cuál es el mejor equipo?"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Código de acceso</span>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              disabled={locked}
              maxLength={6}
              className={`${inputCls} w-32 text-center font-mono uppercase tracking-widest`}
            />
            {!locked && (
              <button
                type="button"
                onClick={() => setJoinCode(generateJoinCode(5))}
                className="h-11 rounded-lg border border-white/15 px-3 text-small text-text-dim hover:text-text"
              >
                Generar
              </button>
            )}
          </div>
        </label>
      </div>

      {/* Teams editor with live contrast preview */}
      <div className="rounded-xl border border-white/10 bg-surface-raised p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-h3 font-bold text-text">Equipos</h2>
          {!locked && (
            <button
              type="button"
              onClick={addTeam}
              className="inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-small text-text-dim hover:text-text"
            >
              + Añadir equipo
            </button>
          )}
        </div>
        <ul className="flex flex-col gap-2.5">
          {teams.map((t, i) => (
            <li key={t.id ?? i} className="flex items-center gap-2.5">
              {/* Live contrast preview chip */}
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-display text-small font-bold ring-1 ring-inset ring-white/20"
                style={{ backgroundColor: t.color, color: pickTextOn(t.color) }}
                title={`Vista previa de contraste — texto ${pickTextOn(t.color) === "#000" ? "negro" : "blanco"}`}
              >
                {t.name.trim() ? t.name.trim()[0].toUpperCase() : "A"}
              </span>
              <input
                value={t.name}
                onChange={(e) => updateTeamName(i, e.target.value)}
                placeholder={`Equipo ${i + 1}`}
                disabled={locked}
                className={`${inputCls} flex-1`}
              />
              <input
                type="color"
                value={t.color}
                onChange={(e) =>
                  updateTeam(i, { color: e.target.value, colorTouched: true })
                }
                disabled={locked}
                aria-label={`Color del equipo ${i + 1}`}
                className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-white/15 bg-surface disabled:opacity-60"
              />
              {!locked && teams.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTeam(i)}
                  aria-label={`Eliminar equipo ${i + 1}`}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-text-dim hover:border-[#FF6B6B]/50 hover:text-[#FF9E9E]"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        {/* Inline validation: a poll needs >= 2 named teams to be valid. */}
        {!teamsValid && (
          <p
            role="status"
            className="mt-3 text-small text-ey-yellow"
          >
            Añade al menos 2 equipos con nombre.
          </p>
        )}
      </div>

      {/* Timers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Cuenta atrás previa (seg)</span>
          <input
            type="number"
            min={0}
            value={countdown}
            onChange={(e) => setCountdown(e.target.value)}
            placeholder="p. ej. 5"
            className={inputCls}
          />
          <span className="text-micro text-text-dim">
            Cuenta atrás antes de abrir la votación.
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Duración / auto-cierre (seg)</span>
          <input
            type="number"
            min={0}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="vacío = cierre manual"
            className={inputCls}
          />
          <span className="text-micro text-text-dim">
            Si se define, la votación se cierra sola al expirar.
          </span>
        </label>
      </div>

      {/* Chart + toggles + tie rule */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Tipo de gráfico</span>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className={inputCls}
          >
            <option value="bar_race">Carrera de barras</option>
            <option value="donut">Donut</option>
            <option value="columns">Columnas</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Regla de empate</span>
          <select
            value={tieRule}
            onChange={(e) => setTieRule(e.target.value as TieRule)}
            className={inputCls}
          >
            <option value="first_to_count">
              Primero en llegar (corona única)
            </option>
            <option value="double_crown">Doble corona (co-ganadores)</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2.5 text-small text-text">
          <input
            type="checkbox"
            checked={showLegend}
            onChange={(e) => setShowLegend(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-ey-yellow)]"
          />
          Mostrar leyenda
        </label>
        <label className="flex items-center gap-2.5 text-small text-text">
          <input
            type="checkbox"
            checked={showNames}
            onChange={(e) => setShowNames(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-ey-yellow)]"
          />
          Mostrar nombres de equipos
        </label>
      </div>

      {error && (
        <p role="alert" className="text-small text-[#FF9E9E]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!canSave}
          title={
            !teamsValid ? "Añade al menos 2 equipos con nombre" : undefined
          }
          className="inline-flex h-11 items-center rounded-lg bg-ey-yellow px-6 font-display font-bold text-ey-confident transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Guardando…"
            : isEdit
              ? "Guardar cambios"
              : "Crear votación"}
        </button>
      </div>
    </div>
  );
}

export default PollConfigForm;
