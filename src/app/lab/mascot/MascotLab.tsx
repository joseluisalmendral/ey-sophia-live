"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import {
  Broqui,
  EXPRESSIONS,
  EXPRESSION_LABELS,
  type BroquiAction,
  type BroquiActionType,
  type Expression,
} from "@/components/mascot/Broqui";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";

/**
 * MascotLab — the interactive gallery behind /lab/mascot.
 *
 * Big stage with every control the character exposes (expression, talking,
 * one-shot actions, look-at following the pointer, size, reduced motion) and
 * a live grid of all expressions looping their signature beats. Purely
 * presentational: no Supabase, no data hooks, no network.
 */

type StageSize = 96 | 200 | 360;

const ACTIONS: { type: BroquiActionType; label: string }[] = [
  { type: "surprise", label: "Sorpresa" },
  { type: "laugh", label: "Risa" },
  { type: "celebrate", label: "Celebrar" },
  { type: "dance", label: "Bailar" },
  { type: "squeeze", label: "Apretar ojos" },
  { type: "peek", label: "Asomarse" },
  { type: "enter", label: "Entrar" },
  { type: "exit", label: "Salir" },
];

/** Expressions whose beat is a one-shot: the grid re-fires them on a loop. */
const LOOPING: Partial<Record<Expression, BroquiActionType>> = {
  surprised: "surprise",
  laughing: "laugh",
  celebrating: "celebrate",
  squeeze: "squeeze",
  peek: "peek",
};

const btn =
  "rounded-full border px-3 py-1.5 text-small font-medium transition-colors duration-150 focus-visible:outline-none";
const btnOff = `${btn} border-glass-border bg-glass-fill text-text-dim hover:text-text`;
const btnOn = `${btn} border-ey-yellow/70 bg-ey-yellow/15 text-ey-yellow`;

export interface MascotLabProps {
  initialExpression: Expression;
  initialSize: StageSize;
  initialTalking: boolean;
  initialReduced: boolean;
  initialGrid: boolean;
}

export function MascotLab({
  initialExpression,
  initialSize,
  initialTalking,
  initialReduced,
  initialGrid,
}: MascotLabProps) {
  const osReduced = useReducedMotionPref();
  const [expression, setExpression] = useState<Expression>(initialExpression);
  const [talking, setTalking] = useState(initialTalking);
  const [size, setSize] = useState<StageSize>(initialSize);
  const [forceReduced, setForceReduced] = useState(initialReduced);
  const [follow, setFollow] = useState(true);
  const [lookAt, setLookAt] = useState<{ x: number; y: number } | null>(null);
  const [action, setAction] = useState<BroquiAction | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = osReduced || forceReduced;

  const fire = useCallback((type: BroquiActionType) => {
    setAction((a) => ({ type, key: (a?.key ?? 0) + 1 }));
  }, []);

  // Pointer → normalised look-at over the big stage (-1..1 from its centre).
  useEffect(() => {
    if (!follow) return;
    const onMove = (e: PointerEvent) => {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      setLookAt({
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * 0.5))),
        y: Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * 0.5))),
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [follow]);

  const onActionEnd = useCallback((type: BroquiActionType) => {
    setLog((l) => [`${new Date().toLocaleTimeString("es-ES")} · fin ${type}`, ...l].slice(0, 6));
  }, []);

  return (
    <ShaderBackground>
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1800px] flex-col gap-8 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-micro font-bold uppercase tracking-[0.2em] text-power-green">
              Laboratorio · mascota
            </p>
            <h1 className="font-display text-h1 font-extrabold text-text">
              Broqui
              <span className="ml-3 text-h3 font-semibold text-text-dim">de broquel</span>
            </h1>
          </div>
          <div className="glass flex items-center gap-2 px-4 py-2 text-small text-text-dim">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-live" />
            Rig SVG · motion/react · sin filtros animados
          </div>
        </header>

        {/* ------------------------------------------------ big stage */}
        <section className="grid gap-6 lg:grid-cols-[minmax(420px,1fr)_minmax(320px,420px)]">
          <div
            ref={stageRef}
            data-lab-stage=""
            className="glass relative flex min-h-[520px] items-center justify-center overflow-hidden"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.05) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <Broqui
              size={size}
              expression={expression}
              talking={talking}
              lookAt={follow ? lookAt : null}
              action={action}
              reduced={reduced}
              onActionEnd={onActionEnd}
            />
            <div className="absolute left-4 top-4 flex gap-2 text-micro text-text-dim">
              <span className="rounded-full bg-black/30 px-2 py-0.5">{EXPRESSION_LABELS[expression]}</span>
              <span className="rounded-full bg-black/30 px-2 py-0.5">{size}px</span>
              {talking && <span className="rounded-full bg-black/30 px-2 py-0.5">hablando</span>}
              {reduced && <span className="rounded-full bg-black/30 px-2 py-0.5">movimiento reducido</span>}
            </div>
          </div>

          <div className="glass flex flex-col gap-5 p-5">
            <Group title="Expresión">
              {EXPRESSIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={e === expression ? btnOn : btnOff}
                  onClick={() => setExpression(e)}
                >
                  {EXPRESSION_LABELS[e]}
                </button>
              ))}
            </Group>

            <Group title="Acciones (one-shot)">
              {ACTIONS.map((a) => (
                <button key={a.type} type="button" className={btnOff} onClick={() => fire(a.type)}>
                  {a.label}
                </button>
              ))}
            </Group>

            <Group title="Overlays">
              <button type="button" className={talking ? btnOn : btnOff} onClick={() => setTalking((v) => !v)}>
                Hablando
              </button>
              <button type="button" className={follow ? btnOn : btnOff} onClick={() => setFollow((v) => !v)}>
                Mirada sigue al ratón
              </button>
              <button
                type="button"
                className={forceReduced ? btnOn : btnOff}
                onClick={() => setForceReduced((v) => !v)}
              >
                Movimiento reducido{osReduced ? " (SO)" : ""}
              </button>
            </Group>

            <Group title="Tamaño">
              {([96, 200, 360] as const).map((s) => (
                <button key={s} type="button" className={s === size ? btnOn : btnOff} onClick={() => setSize(s)}>
                  {s === 96 ? "96 · móvil" : s === 200 ? "200 · proyector" : "360 · prueba 4K"}
                </button>
              ))}
            </Group>

            <div className="mt-auto text-micro text-text-dim">
              <p className="mb-1 font-semibold uppercase tracking-[0.16em]">Registro</p>
              {log.length === 0 ? (
                <p>Sin acciones todavía.</p>
              ) : (
                <ul className="space-y-0.5 font-mono">
                  {log.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ gallery */}
        {initialGrid && (
          <section aria-labelledby="grid-heading">
            <h2 id="grid-heading" className="mb-4 font-display text-h3 font-bold text-text">
              Las {EXPRESSIONS.length} expresiones, en bucle
            </h2>
            <div
              data-lab-grid=""
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7"
            >
              {EXPRESSIONS.map((e) => (
                <GridTile key={e} expression={e} reduced={reduced} />
              ))}
            </div>
          </section>
        )}

        <footer className="text-micro text-ey-gray1">
          Ruta de revisión interna · oculta en producción salvo ENABLE_LAB=1 · sin Supabase.
        </footer>
      </main>
    </ShaderBackground>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-micro font-semibold uppercase tracking-[0.16em] text-text-dim">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** One looping tile: sustained pose + its signature beat re-fired every ~4.5 s. */
function GridTile({ expression, reduced }: { expression: Expression; reduced: boolean }) {
  const loop = LOOPING[expression];
  const [action, setAction] = useState<BroquiAction | null>(null);

  useEffect(() => {
    if (!loop) return;
    let key = 0;
    const t = window.setInterval(() => {
      key += 1;
      setAction({ type: loop, key });
    }, loop === "peek" ? 5200 : 4400);
    return () => window.clearInterval(t);
  }, [loop]);

  // A peek that retreats leaves the stage empty: bring him back in.
  const onActionEnd = useCallback(
    (type: BroquiActionType) => {
      if (type === "peek") setAction((a) => ({ type: "enter", key: (a?.key ?? 0) + 1000 }));
    },
    [],
  );

  return (
    <figure
      data-lab-tile={expression}
      className="glass glass--flat relative flex aspect-[4/5] flex-col items-center justify-center overflow-hidden"
    >
      <Broqui
        size={150}
        expression={expression}
        talking={expression === "talking"}
        action={action}
        reduced={reduced}
        onActionEnd={onActionEnd}
      />
      <figcaption className="absolute bottom-3 left-0 right-0 text-center text-small font-semibold text-text">
        {EXPRESSION_LABELS[expression]}
        <span className="ml-2 font-mono text-micro text-text-dim">{expression}</span>
      </figcaption>
    </figure>
  );
}
