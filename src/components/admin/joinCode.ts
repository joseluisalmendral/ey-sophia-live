/**
 * Memorable, unambiguous join codes.
 *
 * Alphabet excludes ambiguous glyphs (0/O, 1/I/L, etc.) so codes are easy to
 * read aloud and type from the back of a room. Length 4-6.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0,O,1,I,L

export function generateJoinCode(length = 5): string {
  const n = Math.min(6, Math.max(4, length));
  let out = "";
  const bytes =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint32Array(n))
      : null;
  for (let i = 0; i < n; i++) {
    const r = bytes ? bytes[i] : Math.floor(Math.random() * 0xffffffff);
    out += ALPHABET[r % ALPHABET.length];
  }
  return out;
}

/** True if a code uses only the allowed unambiguous alphabet and is 4-6 chars. */
export function isValidJoinCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  if (c.length < 4 || c.length > 6) return false;
  return [...c].every((ch) => ALPHABET.includes(ch));
}
