/**
 * teamColorKeywords — pure keyword → color mapping for the admin team editor.
 *
 * When an operator types a team name containing a Spanish color word ("Equipo
 * Rojo", "Los Azules"... matching is per-word, accent-insensitive and
 * case-insensitive), the form auto-assigns a matching hex color so the team
 * reads instantly on the projector without a manual picker round-trip.
 *
 * All hexes are vivid tones chosen to stay legible over the app's dark cosmic
 * background and to sit inside the existing palette (purple = --color-sophia-
 * purple #8b5cf6, yellow = EY yellow #FFE600). "Negro" cannot literally be
 * #000 on a dark stage, so it maps to a deep readable charcoal; "blanco" is
 * softened off-white to avoid glare.
 */

/** Keyword (already lowercase + accent-stripped) → vivid dark-bg-legible hex. */
const COLOR_KEYWORDS: Record<string, string> = {
  rojo: "#FF5252",
  azul: "#4D9FFF",
  verde: "#3DDC84",
  amarillo: "#FFE600", // EY yellow
  naranja: "#FF9F40",
  morado: "#8b5cf6", // --color-sophia-purple
  violeta: "#8b5cf6",
  purpura: "#8b5cf6",
  rosa: "#FF7EB6",
  gris: "#9CA3AF",
  negro: "#3A3F4B", // readable charcoal on a dark stage
  blanco: "#F6F6FA",
  marron: "#C08552",
  turquesa: "#2DD4BF",
  cian: "#22D3EE",
  dorado: "#F5C542",
  plateado: "#C9D1E0",
  lila: "#C4A7F7",
  granate: "#C0304A",
};

/**
 * Every hex the keyword auto-assignment can produce. Lets the form tell a
 * keyword-assigned color apart from a hand-picked custom one when the
 * per-render `colorTouched` flag is unavailable (e.g. editing a saved poll).
 */
export const KEYWORD_COLORS: readonly string[] = [
  ...new Set(Object.values(COLOR_KEYWORDS)),
];

/** Lowercase + strip diacritics (NFD) so "Púrpura" matches "purpura". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Return the hex color for the first color keyword found in the team name, or
 * null when the name carries no recognizable Spanish color word. Matches whole
 * words plus common plural forms ("rojos", "azules", "marrones").
 */
export function colorForTeamName(name: string): string | null {
  const words = normalize(name).split(/[^a-zñ]+/);
  for (const word of words) {
    if (!word) continue;
    // Exact, simple plural (-s) and -es plural ("azules", "grises", "marrones").
    const candidates = [
      word,
      word.replace(/s$/, ""),
      word.replace(/es$/, ""),
      // "-ones" → "-on" ("marrones" → "marron")
      word.replace(/ones$/, "on"),
    ];
    for (const c of candidates) {
      const hex = COLOR_KEYWORDS[c];
      if (hex) return hex;
    }
  }
  return null;
}
