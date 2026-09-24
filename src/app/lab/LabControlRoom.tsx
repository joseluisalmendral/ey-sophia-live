"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Broqui } from "@/components/mascot/Broqui";
import type { Phase } from "@/app/vote/[poll]/phase";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";
import type { ChartType, PollStatus, TieRule } from "@/lib/types";
import type { LabMessage } from "@/lab/channel";
import { LAB_SPEEDS, type LabSettings, type LabSnapshot } from "@/lab/engine";
import { PERSONA_IDS, PERSONAS, type PersonaId } from "@/lab/personas";
import { SCENARIOS } from "@/lab/scenarios";
import { useLabDriver, type LabControls } from "@/lab/useLab";

/**
 * LabControlRoom — the /lab rehearsal desk.
 *
 * Runs the engine (leader) and shows the projector frame (1920×1080) and four
 * persona phones (390×844) as same-origin iframes, so viewport units behave
 * exactly as on the real devices; they follow the engine over
 * BroadcastChannel("lab"). No Supabase, no network.
 */

const STATUS_LABEL: Record<PollStatus, string> = {
  draft: "Lobby",
  countdown: "Cuenta atrás",
  open: "En directo",
  closed: "Revelación",
};

const PHASE_LABEL: Record<Phase, string> = {
  lobby: "Lobby",
  voting: "Votando",
  submitting: "Enviando",
  confirm: "Voto confirmado",
  alreadyVoted: "Ya votó",
  closedNoVote: "Sin voto",
  reveal: "Resultado",
};

const CHARTS: { value: ChartType; label: string }[] = [
  { value: "bar_race", label: "Carrera" },
  { value: "columns", label: "Columnas" },
  { value: "donut", label: "Donut" },
];

const TIE_RULES: { value: TieRule; label: string }[] = [
  { value: "first_to_count", label: "Primero en llegar" },
  { value: "double_crown", label: "Doble corona" },
];

const btn =
  "rounded-full border px-3 py-1.5 text-small font-medium transition-colors duration-150 disabled:opacity-40";
const btnOff = `${btn} border-glass-border bg-glass-fill text-text-dim hover:text-text`;
const btnOn = `${btn} border-ey-yellow/70 bg-ey-yellow/15 text-ey-yellow`;

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

interface PersonaInfo {
  phase: Phase;
  manual: boolean;
}

export function LabControlRoom({
  initial,
  autoplay,
}: {
  initial: LabSettings;
  autoplay: boolean;
}) {
  const [personaInfo, setPersonaInfo] = useState<Partial<Record<PersonaId, PersonaInfo>>>({});
  const [keepouts, setKeepouts] = useState<number | null>(null);
  const onMessage = useCallback((msg: LabMessage) => {
    if (msg.type === "persona") {
      setPersonaInfo((prev) => ({ ...prev, [msg.id]: { phase: msg.phase, manual: msg.manual } }));
    } else if (msg.type === "keepouts") {
      setKeepouts(msg.count);
    }
  }, []);
  const { snap, controls } = useLabDriver(initial, { autoplay, onMessage });
  const reducedPref = useReducedMotionPref();

  return (
    <div className="flex h-[100dvh] min-h-[640px] flex-col overflow-hidden bg-cosmic-deep text-text">
      <Toolbar snap={snap} controls={controls} reduced={reducedPref} />
      {snap && <Scrubber snap={snap} controls={controls} />}

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-3 pt-2">
        <section className="flex min-w-0 flex-1 flex-col gap-2">
          <FrameLabel>
            Proyector · 1920×1080
            {snap && (
              <span className="ml-2 text-ey-yellow">{STATUS_LABEL[snap.status]}</span>
            )}
          </FrameLabel>
          <ScaledFrame src="/lab/screen" title="Proyector" width={1920} height={1080} />
        </section>

        <aside className="grid w-[26rem] shrink-0 grid-cols-2 grid-rows-2 gap-3">
          {PERSONA_IDS.map((id) => (
            <div key={id} className="flex min-h-0 flex-col gap-1">
              <PersonaLabel
                id={id}
                info={personaInfo[id]}
                onResume={() => controls.post({ type: "persona-reset", id })}
              />
              <ScaledFrame
                src={`/lab/phone?persona=${id}`}
                title={`Móvil de ${PERSONAS[id].name}`}
                width={390}
                height={844}
              />
            </div>
          ))}
        </aside>
      </div>

      {snap && (
        <Drawer settings={snap.settings} controls={controls} keepouts={keepouts} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Toolbar({
  snap,
  controls,
  reduced,
}: {
  snap: LabSnapshot | null;
  controls: LabControls;
  reduced: boolean;
}) {
  const settings = snap?.settings;
  const [seedDraft, setSeedDraft] = useState<string | null>(null);
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-glass-border px-4 py-2">
      {/* Static cameo — the real mascot host arrives with E3. */}
      <div className="flex h-11 w-10 items-center justify-center" aria-hidden>
        <Broqui size={44} expression="smug" reduced={reduced} />
      </div>
      <h1 className="font-display text-h3 font-black leading-none">
        Sala de <span className="text-ey-yellow">ensayo</span>
      </h1>

      <select
        aria-label="Escenario"
        value={settings?.scenarioId ?? ""}
        onChange={(e) => controls.update({ scenarioId: e.target.value })}
        className="rounded-lg border border-glass-border bg-cosmic-700 px-3 py-1.5 text-small"
      >
        {SCENARIOS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1.5">
        <button type="button" className={snap?.playing ? btnOn : btnOff} onClick={controls.toggle}>
          {snap?.playing ? "Pausa" : "Reproducir"}
        </button>
        <button type="button" className={btnOff} onClick={controls.step}>
          Siguiente beat
        </button>
        <button type="button" className={btnOff} onClick={controls.reset}>
          Reiniciar
        </button>
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="Velocidad">
        {LAB_SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={settings?.speed === s}
            className={settings?.speed === s ? btnOn : btnOff}
            onClick={() => controls.update({ speed: s })}
          >
            ×{s}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-small text-text-dim">
        Semilla
        <input
          type="number"
          min={1}
          value={seedDraft ?? String(settings?.seed ?? "")}
          onChange={(e) => setSeedDraft(e.target.value)}
          onBlur={() => {
            const n = Number(seedDraft);
            if (seedDraft !== null && Number.isInteger(n) && n > 0) controls.update({ seed: n });
            setSeedDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-20 rounded-lg border border-glass-border bg-cosmic-700 px-2 py-1 text-small text-text"
        />
      </label>

      <div className="ml-auto flex items-center gap-3">
        {snap && (
          <span className="font-mono text-small tabular-nums text-text-dim" data-lab-clock data-lab-t={snap.t.toFixed(2)} data-lab-status={snap.status}>
            t {fmt(snap.t)} · {STATUS_LABEL[snap.status]}
            {snap.status === "closed" ? " · ×1" : ` · ×${snap.settings.speed}`}
          </span>
        )}
        <a
          href="/lab/screen"
          target="_blank"
          rel="noreferrer"
          className={btnOff}
        >
          Abrir proyector
        </a>
      </div>
    </header>
  );
}

function Scrubber({ snap, controls }: { snap: LabSnapshot; controls: LabControls }) {
  const pct = (at: number) => `${(at / snap.end) * 100}%`;
  return (
    <div className="shrink-0 px-4 pt-2">
      <input
        type="range"
        aria-label="Línea de tiempo"
        min={0}
        max={snap.end}
        step={0.1}
        value={snap.t}
        onChange={(e) => controls.seek(Number(e.target.value))}
        className="w-full accent-[var(--color-ey-yellow)]"
      />
      <div className="relative h-5">
        {snap.beats.map((b) => (
          <button
            key={`${b.kind}-${b.at}`}
            type="button"
            title={`${b.label} · ${fmt(b.at)}`}
            onClick={() => controls.seek(b.at)}
            className="absolute top-0 whitespace-nowrap text-micro font-semibold uppercase tracking-[0.08em] text-text-dim hover:text-ey-yellow"
            style={{
              left: pct(b.at),
              // Keep edge labels inside the track.
              transform: `translateX(${b.at < snap.end * 0.03 ? "0" : b.at > snap.end * 0.97 ? "-100%" : "-50%"})`,
            }}
          >
            <span className="mx-auto mb-0.5 block h-1.5 w-px bg-current" aria-hidden />
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Drawer({
  settings,
  controls,
  keepouts,
}: {
  settings: LabSettings;
  controls: LabControls;
  keepouts: number | null;
}) {
  const { assistant } = settings;
  const [minDraft, setMinDraft] = useState(String(assistant.minIntervalS));
  const [maxDraft, setMaxDraft] = useState(String(assistant.maxIntervalS));
  const min = Number(minDraft);
  const max = Number(maxDraft);
  const error =
    !Number.isInteger(min) || min < 6 || min > 120
      ? "El mínimo debe estar entre 6 y 120 s."
      : !Number.isInteger(max) || max < 8 || max > 120
        ? "El máximo debe estar entre 8 y 120 s."
        : max < min + 2
          ? "El máximo debe superar al mínimo en al menos 2 s."
          : null;
  const applyInterval = () => {
    if (error === null) {
      controls.update({ assistant: { ...assistant, minIntervalS: min, maxIntervalS: max } });
    }
  };

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-glass-border px-4 py-2.5 text-small">
      <Toggle
        label="Anónimo"
        on={settings.anonymous}
        onChange={(v) => controls.update({ anonymous: v })}
      />
      <Segmented
        label="Gráfico"
        options={CHARTS}
        value={settings.chartType}
        onChange={(v) => controls.update({ chartType: v })}
      />
      <Segmented
        label="Desempate"
        options={TIE_RULES}
        value={settings.tieRule}
        onChange={(v) => controls.update({ tieRule: v })}
      />
      <Toggle
        label="Movimiento reducido"
        on={settings.reduced}
        onChange={(v) => controls.update({ reduced: v })}
      />
      <Toggle
        label="Mostrar keep-outs"
        on={settings.showKeepouts}
        onChange={(v) => controls.update({ showKeepouts: v })}
        hint={settings.showKeepouts ? `${keepouts ?? 0} zonas` : undefined}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          label="Asistente"
          on={assistant.enabled}
          onChange={(v) => controls.update({ assistant: { ...assistant, enabled: v } })}
        />
        <label className="flex items-center gap-1 text-text-dim">
          mín
          <input
            type="number"
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            onBlur={applyInterval}
            className="w-14 rounded-md border border-glass-border bg-cosmic-700 px-1.5 py-0.5 text-text"
          />
        </label>
        <label className="flex items-center gap-1 text-text-dim">
          máx
          <input
            type="number"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            onBlur={applyInterval}
            className="w-14 rounded-md border border-glass-border bg-cosmic-700 px-1.5 py-0.5 text-text"
          />
          s
        </label>
        {error && <span className="text-[#FF8A8A]">{error}</span>}
      </div>
    </footer>
  );
}

function Toggle({
  label,
  on,
  onChange,
  hint,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 text-text-dim hover:text-text"
    >
      <span
        aria-hidden
        className={`relative inline-block h-5 w-9 rounded-full transition-colors ${on ? "bg-ey-yellow" : "bg-white/15"}`}
      >
        <span
          className="absolute top-[2px] h-4 w-4 rounded-full bg-cosmic-deep transition-[left] duration-150"
          style={{ left: on ? 18 : 2 }}
        />
      </span>
      {label}
      {hint && <span className="text-micro text-ey-yellow">{hint}</span>}
    </button>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <span className="text-text-dim">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className={value === o.value ? btnOn : btnOff}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PersonaLabel({
  id,
  info,
  onResume,
}: {
  id: PersonaId;
  info: PersonaInfo | undefined;
  onResume: () => void;
}) {
  const p = PERSONAS[id];
  return (
    <div className="flex min-h-[2.4rem] flex-col text-micro leading-tight">
      <div className="flex items-center gap-1.5">
        <span className="font-display text-small font-bold text-text">{p.name}</span>
        {info && (
          <span className="rounded-full bg-white/10 px-1.5 py-px text-ey-yellow" data-persona-phase={info.phase}>
            {PHASE_LABEL[info.phase]}
          </span>
        )}
        {info?.manual && (
          <button type="button" onClick={onResume} className="ml-auto text-sophia-accent underline">
            Volver al guion
          </button>
        )}
      </div>
      <span className="truncate text-text-dim">{info?.manual ? "Control manual" : p.script}</span>
    </div>
  );
}

function FrameLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-micro font-semibold uppercase tracking-[0.14em] text-text-dim">
      {children}
    </span>
  );
}

/**
 * ScaledFrame — an iframe laid out at its real device size and scaled down to
 * fit its box, so the embedded page sees a true 1920×1080 / 390×844 viewport.
 */
function ScaledFrame({
  src,
  title,
  width,
  height,
}: {
  src: string;
  title: string;
  width: number;
  height: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      setScale(Math.max(0, Math.min(cw / width, ch / height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  return (
    <div ref={boxRef} className="flex min-h-0 min-w-0 flex-1 items-start justify-center">
      <div
        className="relative overflow-hidden rounded-lg ring-1 ring-white/12"
        style={{ width: width * scale, height: height * scale }}
      >
        <iframe
          src={src}
          title={title}
          className="absolute left-0 top-0 border-0"
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        />
      </div>
    </div>
  );
}
