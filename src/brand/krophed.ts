// Krophed (Garismantra), the display face of the RUMBO wordmark, as converted
// into src/assets/fonts. It only has A–Z (lowercase drawn as capitals), 0–9 and
// basic punctuation: no accents, ñ, ¿ or ¡. Advance widths in em, used to check
// a text can be set in it and to size it to fit its container.
export const KROPHED_ADVANCE: Record<string, number> = {
  ' ': 0.525,
  '!': 0.237,
  '"': 0.47,
  $: 0.879,
  '&': 0.879,
  "'": 0.237,
  '(': 0.308,
  ')': 0.308,
  '*': 0.536,
  '+': 0.568,
  ',': 0.271,
  '-': 0.568,
  '.': 0.271,
  '/': 1.053,
  '0': 0.996,
  '1': 0.506,
  '2': 0.898,
  '3': 0.874,
  '4': 0.862,
  '5': 0.869,
  '6': 0.896,
  '7': 0.872,
  '8': 0.874,
  '9': 0.899,
  ':': 0.271,
  ';': 0.271,
  '=': 0.568,
  '?': 0.859,
  A: 1.011,
  B: 0.875,
  C: 0.86,
  D: 0.875,
  E: 0.832,
  F: 0.832,
  G: 0.846,
  H: 0.862,
  I: 0.221,
  J: 0.772,
  K: 0.894,
  L: 0.802,
  M: 0.999,
  N: 0.862,
  O: 0.967,
  P: 0.862,
  Q: 1.024,
  R: 0.914,
  S: 0.912,
  T: 0.862,
  U: 0.937,
  V: 1.011,
  W: 1.367,
  X: 0.962,
  Y: 0.988,
  Z: 0.862,
  '\u00a0': 0.525,
};

/** True when every character exists in Krophed (case-insensitive). */
export function fitsKrophed(text: string): boolean {
  return [...text.toUpperCase()].every((c) => c in KROPHED_ADVANCE);
}

/** Width of the text in em when set in Krophed (unknown characters count as 1 em). */
export function krophedWidth(text: string): number {
  return [...text.toUpperCase()].reduce((sum, c) => sum + (KROPHED_ADVANCE[c] ?? 1), 0);
}
