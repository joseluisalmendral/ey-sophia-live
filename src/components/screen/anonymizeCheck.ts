import type { SelfCheckItem } from "@/lib/assistant/selfCheck";
import {
  ANONYMOUS_NAME,
  anonSeed,
  anonymousIdentity,
  colorDistance,
  hexToOklab,
  seededDerangement,
  teamInitials,
} from "./anonymize";

/**
 * /lab self-check for the anonymous identities (pure, a few ms):
 *  - palette: every anonymous color stays ≥ ANON_MIN_TEAM_DISTANCE (ΔE OKLab)
 *    from every real team color of the set, ≥ ANON_MIN_PAIR_DISTANCE from the
 *    other anonymous colors, and is chromatic (never a grey);
 *  - derangement: seeded, deterministic, a permutation with no fixed point
 *    (n ≥ 2), and different runs produce different shuffles;
 *  - labels: every hidden identity reads "?" (chips too) — no names, no
 *    letters.
 * The live DOM leak test runs in the projector frame (LabScreen) and reports
 * separately.
 */

/** ΔE_OK floor vs any real team color (0.02 ≈ just noticeable). */
export const ANON_MIN_TEAM_DISTANCE = 0.12;
/** ΔE_OK floor between two anonymous colors of the same run. */
export const ANON_MIN_PAIR_DISTANCE = 0.1;
/** OKLab chroma floor: below this a color reads as grey. */
const MIN_CHROMA = 0.09;

export interface AnonTeamSet {
  label: string;
  teams: ReadonlyArray<{ id: string; name: string; color: string }>;
}

function item(id: string, label: string, errors: string[], okDetail: string): SelfCheckItem {
  return {
    id,
    label,
    ok: errors.length === 0,
    detail: errors.length
      ? errors.slice(0, 5).join(" · ") + (errors.length > 5 ? ` · +${errors.length - 5}` : "")
      : okDetail,
  };
}

export function runAnonymousSelfCheck(sets: readonly AnonTeamSet[]): SelfCheckItem[] {
  const items: SelfCheckItem[] = [];

  /* 1. Palette distance */
  {
    const errors: string[] = [];
    let minTeam = Infinity;
    let minPair = Infinity;
    for (const set of sets) {
      for (let run = 1; run <= 4; run++) {
        const identity = anonymousIdentity(set.teams, anonSeed(`lab-${set.label}`, run));
        const colors = [...identity.values()].map((v) => v.color);
        for (const c of colors) {
          const [, a, b] = hexToOklab(c);
          if (Math.hypot(a, b) < MIN_CHROMA) errors.push(`${set.label}: ${c} gris`);
          for (const t of set.teams) {
            const d = colorDistance(c, t.color);
            minTeam = Math.min(minTeam, d);
            if (d < ANON_MIN_TEAM_DISTANCE) errors.push(`${set.label}: ${c}~${t.color} ${d.toFixed(3)}`);
          }
        }
        for (let i = 0; i < colors.length; i++) {
          for (let j = i + 1; j < colors.length; j++) {
            const d = colorDistance(colors[i], colors[j]);
            minPair = Math.min(minPair, d);
            if (d < ANON_MIN_PAIR_DISTANCE) errors.push(`${set.label}: ${colors[i]}~${colors[j]} ${d.toFixed(3)}`);
          }
        }
      }
    }
    items.push(
      item(
        "anon-palette",
        `Anónimo: colores distintos (ΔE ≥ ${ANON_MIN_TEAM_DISTANCE} vs equipos)`,
        [...new Set(errors)],
        `${sets.length} repartos · mín ${minTeam.toFixed(3)} vs equipos · ${minPair.toFixed(3)} entre sí`,
      ),
    );
  }

  /* 2. Derangement */
  {
    const errors: string[] = [];
    let cases = 0;
    for (let n = 1; n <= 8; n++) {
      const seen = new Set<string>();
      for (let s = 0; s < 150; s++) {
        const seed = anonSeed("lab-derange", s * 7919 + n);
        const perm = seededDerangement(n, seed);
        cases++;
        const sorted = [...perm].sort((a, b) => a - b);
        if (sorted.some((v, i) => v !== i)) errors.push(`n=${n}: no es permutación`);
        if (n >= 2 && perm.some((p, i) => p === i)) errors.push(`n=${n}: punto fijo`);
        if (seededDerangement(n, seed).join() !== perm.join()) errors.push(`n=${n}: no determinista`);
        seen.add(perm.join());
      }
      if (n >= 3 && seen.size < 2) errors.push(`n=${n}: siempre el mismo reparto`);
    }
    for (const set of sets) {
      const ids = set.teams.map((t) => t.id);
      const a = anonymousIdentity(set.teams, anonSeed(`lab-${set.label}`, 1));
      if (ids.some((id, i) => set.teams.length >= 2 && a.get(id)?.slot === i)) {
        errors.push(`${set.label}: conserva su posición`);
      }
    }
    items.push(
      item("anon-derange", "Anónimo: reparto barajado (sin puntos fijos)", [...new Set(errors)], `${cases} barajas · sin puntos fijos`),
    );
  }

  /* 3. Labels */
  {
    const errors: string[] = [];
    for (const set of sets) {
      const identity = anonymousIdentity(set.teams, anonSeed(`lab-${set.label}`, 1));
      const names = [...identity.values()].map((v) => v.name);
      for (const v of identity.values()) {
        if (v.name !== ANONYMOUS_NAME) errors.push(`${set.label}: "${v.name}"`);
        if (/[A-Za-zÀ-ÿ]/.test(v.name)) errors.push(`${set.label}: letra en "${v.name}"`);
        const chip = teamInitials(v.name, names);
        if (chip !== ANONYMOUS_NAME) errors.push(`${set.label}: chip "${chip}"`);
      }
    }
    items.push(item("anon-labels", "Anónimo: etiquetas «?» (sin nombres ni letras)", errors, "todas las identidades leen «?»"));
  }

  return items;
}
