import { isValidGtin } from './barcode';

/**
 * A small EAN-13 / UPC-A / EAN-8 reader for one line of pixels across a
 * barcode. Browsers without a native BarcodeDetector (Safari on iPhone) use
 * it on camera frames. It measures bar widths with sub-pixel edges, corrects
 * ink spread with the guard bars, matches every digit by its own width (so a
 * tilted code still reads) and only returns codes whose check digit is right.
 */

// Widths (in modules) of the four runs of each digit. L and R codes share the
// same widths; G codes are the L widths reversed.
const L_WIDTHS: readonly (readonly number[])[] = [
  [3, 2, 1, 1],
  [2, 2, 2, 1],
  [2, 1, 2, 2],
  [1, 4, 1, 1],
  [1, 1, 3, 2],
  [1, 2, 3, 1],
  [1, 1, 1, 4],
  [1, 3, 1, 2],
  [1, 2, 1, 3],
  [3, 1, 1, 2],
];
const G_WIDTHS = L_WIDTHS.map((w) => [...w].reverse());

/** Parity of the six left digits (L or G) that encodes the first EAN-13 digit. */
const FIRST_DIGIT_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLG', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

interface Runs {
  widths: number[];
  /** Whether the first run is dark. */
  firstDark: boolean;
}

/** Darkest and lightest value within `w` pixels of each position (monotonic queues, linear time). */
function slidingExtremes(v: Float32Array, w: number): { min: Float32Array; max: Float32Array } {
  const n = v.length;
  const min = new Float32Array(n);
  const max = new Float32Array(n);
  const qMin: number[] = [];
  const qMax: number[] = [];
  let headMin = 0;
  let headMax = 0;
  let next = 0;
  for (let i = 0; i < n; i++) {
    for (const last = Math.min(n - 1, i + w); next <= last; next++) {
      const x = v[next] as number;
      while (qMin.length > headMin && (v[qMin[qMin.length - 1] as number] as number) >= x) qMin.pop();
      qMin.push(next);
      while (qMax.length > headMax && (v[qMax[qMax.length - 1] as number] as number) <= x) qMax.pop();
      qMax.push(next);
    }
    while ((qMin[headMin] as number) < i - w) headMin++;
    while ((qMax[headMax] as number) < i - w) headMax++;
    min[i] = v[qMin[headMin] as number] as number;
    max[i] = v[qMax[headMax] as number] as number;
  }
  return { min, max };
}

/** Run widths between threshold crossings, with sub-pixel edge positions. */
export function runsOf(row: ArrayLike<number>): Runs | null {
  const n = row.length;
  if (n < 60) return null;
  const v = Float32Array.from(row as ArrayLike<number>);
  const sorted = Array.from(v).sort((a, b) => a - b);
  const lo = sorted[Math.floor(n * 0.05)] as number;
  const hi = sorted[Math.floor(n * 0.95)] as number;
  if (hi - lo < 32) return null; // no contrast: nothing printed here
  const global = (lo + hi) / 2;
  // Local threshold (middle of the nearby darkest and lightest values), so
  // light falling off across the label does not thin one side of the code.
  // Where there is little contrast nearby it eases back to the global one.
  const { min, max } = slidingExtremes(v, Math.max(12, Math.round(n / 10)));
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const near = (max[i] as number) - (min[i] as number);
    const weight = Math.min(1, Math.max(0, (near / (hi - lo) - 0.3) / 0.3));
    d[i] = (v[i] as number) - (global + (((min[i] as number) + (max[i] as number)) / 2 - global) * weight);
  }
  const edges: number[] = [];
  for (let i = 1; i < n; i++) {
    const a = d[i - 1] as number;
    const b = d[i] as number;
    if (a < 0 !== b < 0) edges.push(i - 1 + a / (a - b));
  }
  if (edges.length < 30) return null;
  const widths: number[] = [];
  for (let i = 1; i < edges.length; i++) widths.push((edges[i] as number) - (edges[i - 1] as number));
  // The run after the first edge is dark when the signal goes down there. The
  // pixel strictly after the edge decides: one exactly on the threshold cannot.
  const firstDark = (d[Math.min(n - 1, Math.floor(edges[0] as number) + 1)] as number) < 0;
  return { widths, firstDark };
}

function bestDigit(w: readonly number[], table: readonly (readonly number[])[]): { digit: number; error: number } {
  const total = w.reduce((a, b) => a + b, 0);
  const unit = total / 7;
  let digit = -1;
  let error = Infinity;
  for (let d = 0; d < 10; d++) {
    const p = table[d] as readonly number[];
    let e = 0;
    for (let i = 0; i < 4; i++) e += Math.abs((w[i] as number) / unit - (p[i] as number));
    if (e < error) {
      error = e;
      digit = d;
    }
  }
  return { digit, error };
}

const MAX_DIGIT_ERROR = 1.5;

function nearModule(w: number, m: number): boolean {
  return w > m * 0.45 && w < m * 1.75;
}

/**
 * Tries to read a code whose start guard begins at run `k` (a dark run).
 * `digitsPerSide` is 6 for EAN-13 and 4 for EAN-8.
 */
function readAt(widths: readonly number[], k: number, digitsPerSide: 4 | 6): string | null {
  const runCount = 3 + digitsPerSide * 4 + 5 + digitsPerSide * 4 + 3;
  if (k + runCount > widths.length) return null;
  const run = (i: number) => widths[k + i] as number;
  let total = 0;
  for (let i = 0; i < runCount; i++) total += run(i);
  const modules = digitsPerSide === 6 ? 95 : 67;
  const m = total / modules;
  // Quiet zones: clearly wider than a module on both sides (when visible).
  if (k > 0 && (widths[k - 1] as number) < m * 2.5) return null;
  const after = widths[k + runCount];
  if (after !== undefined && after < m * 2.5) return null;

  const mid = 3 + digitsPerSide * 4;
  const end = mid + 5 + digitsPerSide * 4;
  const guardIdx = [0, 1, 2, mid, mid + 1, mid + 2, mid + 3, mid + 4, end, end + 1, end + 2];
  if (!guardIdx.every((i) => nearModule(run(i), m))) return null;

  // Ink spread: dark runs print wider and light runs narrower by the same
  // amount. The one-module guard bars tell how much.
  const darkGuards = [0, 2, mid + 1, mid + 3, end, end + 2].map(run);
  const lightGuards = [1, mid, mid + 2, mid + 4, end + 1].map(run);
  const spread = (darkGuards.reduce((a, b) => a + b, 0) / darkGuards.length - lightGuards.reduce((a, b) => a + b, 0) / lightGuards.length) / 2;
  const digitRuns = (start: number, darkFirst: boolean) =>
    [0, 1, 2, 3].map((i) => {
      const dark = (i % 2 === 0) === darkFirst;
      return Math.max(0.1, run(start + i) + (dark ? -spread : spread));
    });

  let parity = '';
  let digits = '';
  for (let d = 0; d < digitsPerSide; d++) {
    const w = digitRuns(3 + d * 4, false);
    const l = bestDigit(w, L_WIDTHS);
    if (digitsPerSide === 4) {
      if (l.error > MAX_DIGIT_ERROR) return null;
      digits += l.digit;
      continue;
    }
    const g = bestDigit(w, G_WIDTHS);
    const pick = l.error <= g.error ? l : g;
    if (pick.error > MAX_DIGIT_ERROR) return null;
    parity += l.error <= g.error ? 'L' : 'G';
    digits += pick.digit;
  }
  for (let d = 0; d < digitsPerSide; d++) {
    const r = bestDigit(digitRuns(mid + 5 + d * 4, true), L_WIDTHS);
    if (r.error > MAX_DIGIT_ERROR) return null;
    digits += r.digit;
  }

  let code = digits;
  if (digitsPerSide === 6) {
    const first = FIRST_DIGIT_PARITY.indexOf(parity);
    if (first < 0) return null;
    code = `${first}${digits}`;
  }
  return isValidGtin(code) ? code : null;
}

function scanRuns({ widths, firstDark }: Runs): string | null {
  for (let k = 0; k < widths.length; k++) {
    if ((k % 2 === 0) !== firstDark) continue; // guards start with a dark run
    const code = readAt(widths, k, 6) ?? readAt(widths, k, 4);
    if (code) return code;
  }
  return null;
}

/** Reads one row of luminance values (0–255) in both directions. */
export function decodeRow(row: ArrayLike<number>): string | null {
  const runs = runsOf(row);
  if (!runs) return null;
  const forward = scanRuns(runs);
  if (forward) return forward;
  const reversed = [...runs.widths].reverse();
  const lastDark = runs.widths.length % 2 === 1 ? runs.firstDark : !runs.firstDark;
  return scanRuns({ widths: reversed, firstDark: lastDark });
}

/**
 * Reads several rows of an image (RGBA pixels) and returns a code seen on at
 * least `agree` rows, so one misread line is never enough.
 */
export function decodeImage(data: Uint8ClampedArray, width: number, height: number, opts: { rows?: number; agree?: number; vertical?: boolean } = {}): string | null {
  const lines = opts.rows ?? 16;
  const agree = opts.agree ?? 2;
  const counts = new Map<string, number>();
  const along = opts.vertical ? height : width;
  const across = opts.vertical ? width : height;
  const line = new Uint8Array(along);
  for (let r = 0; r < lines; r++) {
    // Rows spread over the middle 80 % of the image.
    const pos = Math.round(across * (0.1 + (0.8 * (r + 0.5)) / lines));
    // Three neighbouring lines averaged: less sensor noise, no extra blur along the bars' axis.
    for (let i = 0; i < along; i++) {
      let sum = 0;
      for (let k = -1; k <= 1; k++) {
        const q = Math.min(across - 1, Math.max(0, pos + k));
        const p = (opts.vertical ? i * width + q : q * width + i) * 4;
        sum += 299 * (data[p] as number) + 587 * (data[p + 1] as number) + 114 * (data[p + 2] as number);
      }
      line[i] = sum / 3000;
    }
    const code = decodeRow(line);
    if (!code) continue;
    const c = (counts.get(code) ?? 0) + 1;
    if (c >= agree) return code;
    counts.set(code, c);
  }
  return null;
}

// ── Encoding (used by the tests to draw codes) ─────────────────────────

/** Modules of an EAN-13 or EAN-8 code (true = dark), without quiet zones. */
export function encodeEan(code: string): boolean[] {
  if (!isValidGtin(code) || (code.length !== 13 && code.length !== 8)) throw new Error('EAN-13 or EAN-8 expected');
  const out: boolean[] = [];
  const push = (widths: readonly number[], darkFirst: boolean) =>
    widths.forEach((w, i) => {
      for (let j = 0; j < w; j++) out.push((i % 2 === 0) === darkFirst);
    });
  const digits = [...code].map(Number);
  const left = code.length === 13 ? digits.slice(1, 7) : digits.slice(0, 4);
  const right = code.length === 13 ? digits.slice(7) : digits.slice(4);
  const parity = code.length === 13 ? (FIRST_DIGIT_PARITY[digits[0] as number] as string) : 'LLLL';
  push([1, 1, 1], true);
  left.forEach((d, i) => push((parity[i] === 'G' ? G_WIDTHS : L_WIDTHS)[d] as number[], false));
  push([1, 1, 1, 1, 1], false);
  right.forEach((d) => push(L_WIDTHS[d] as number[], true));
  push([1, 1, 1], true);
  return out;
}
