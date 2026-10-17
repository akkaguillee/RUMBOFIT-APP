import { describe, expect, it } from 'vitest';
import { decodeImage, decodeRow, encodeEan } from './ean';

/** Deterministic noise so the tests never flake. */
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648 - 0.5;
  };
}

interface DrawOptions {
  module?: number;
  offset?: number;
  /** Extra width of every dark bar, in modules (ink spread or blur). */
  spread?: number;
  /** How much wider the last module is than the first (a tilted code). */
  perspective?: number;
  blur?: number;
  noise?: number;
  /** Light falling off from left to right (0 = even light). */
  gradient?: number;
  reverse?: boolean;
}

/** Draws one row of pixels across a printed code, as a camera would see it. */
function draw(code: string, o: DrawOptions = {}): number[] {
  const mods = encodeEan(code);
  const s = o.module ?? 3;
  const start = (o.offset ?? 0) + 14 * s;
  const t = o.perspective ?? 0;
  const pos = (u: number) => start + s * u * (1 + (t * u) / mods.length);
  const spread = ((o.spread ?? 0) * s) / 2;
  const bars: [number, number][] = [];
  for (let i = 0; i < mods.length; ) {
    if (!mods[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < mods.length && mods[j]) j++;
    bars.push([pos(i) - spread, pos(j) + spread]);
    i = j;
  }
  const length = Math.ceil(pos(mods.length) + 14 * s * (1 + t) + 4);
  const rand = noise(7);
  let row = Array.from({ length }, (_, p) => {
    let cover = 0;
    for (const [a, b] of bars) cover += Math.max(0, Math.min(p + 1, b) - Math.max(p, a));
    const light = 225 - (o.gradient ?? 0) * (p / length);
    const dark = 35;
    return light - (light - dark) * Math.min(1, cover);
  });
  const r = o.blur ?? 0;
  if (r > 0) row = row.map((_, i) => row.slice(Math.max(0, i - r), i + r + 1).reduce((a, b) => a + b, 0) / (Math.min(row.length, i + r + 1) - Math.max(0, i - r)));
  row = row.map((v) => Math.max(0, Math.min(255, v + (o.noise ?? 0) * rand())));
  return o.reverse ? row.reverse() : row;
}

describe('EAN reader', () => {
  it('reads EAN-13, UPC-A (as EAN-13) and EAN-8 codes', () => {
    expect(decodeRow(draw('4006381333931'))).toBe('4006381333931');
    expect(decodeRow(draw('8410000123456'))).toBe('8410000123456');
    expect(decodeRow(draw('0036000291452'))).toBe('0036000291452');
    expect(decodeRow(draw('96385074'))).toBe('96385074');
  });

  it('copes with what a phone camera sees: small bars, blur, noise, ink spread, uneven light, tilt', () => {
    expect(decodeRow(draw('4006381333931', { module: 1.7, offset: 3.3 }))).toBe('4006381333931');
    expect(decodeRow(draw('4006381333931', { module: 2.4, blur: 1, noise: 18 }))).toBe('4006381333931');
    expect(decodeRow(draw('4006381333931', { module: 3, spread: 0.35 }))).toBe('4006381333931');
    expect(decodeRow(draw('4006381333931', { module: 3, spread: -0.3 }))).toBe('4006381333931');
    expect(decodeRow(draw('4006381333931', { module: 2.8, gradient: 90 }))).toBe('4006381333931');
    expect(decodeRow(draw('4006381333931', { module: 2.5, perspective: 0.3 }))).toBe('4006381333931');
    expect(decodeRow(draw('96385074', { module: 2.2, blur: 1, noise: 12 }))).toBe('96385074');
  });

  it('reads codes whose edge pixels sit exactly on the threshold', () => {
    // A camera frame drawn half a pixel off: every edge has one mid-grey pixel.
    const modules = encodeEan('4006381333931');
    const row: number[] = new Array(40).fill(247);
    modules.forEach((dark, i) => {
      const prev = i > 0 ? modules[i - 1] : false;
      row.push(dark === prev ? (dark ? 9 : 247) : 128, dark ? 9 : 247, dark ? 9 : 247);
    });
    row.push(128, ...new Array(40).fill(247));
    expect(decodeRow(row)).toBe('4006381333931');
  });

  it('reads codes upside down', () => {
    expect(decodeRow(draw('4006381333931', { reverse: true }))).toBe('4006381333931');
    expect(decodeRow(draw('96385074', { reverse: true, module: 2.6 }))).toBe('96385074');
  });

  it('returns nothing for noise, blank rows or damaged codes', () => {
    const rand = noise(3);
    expect(decodeRow(Array.from({ length: 640 }, () => 128 + 120 * rand()))).toBeNull();
    expect(decodeRow(new Array(640).fill(200))).toBeNull();
    // A smudged digit: the space after the start guard painted over.
    const row = draw('4006381333931', { module: 3 });
    for (let p = 14 * 3 + 3 * 3; p < 14 * 3 + 6 * 3; p++) row[p] = 35;
    expect(decodeRow(row)).toBeNull();
    // Cut in half by the edge of the frame.
    expect(decodeRow(draw('4006381333931').slice(0, 180))).toBeNull();
  });

  it('needs the same code on several rows of an image', () => {
    const line = draw('4006381333931', { module: 2.5 });
    const width = line.length;
    const height = 40;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4;
        // Only the middle band holds the code; the rest is a plain label.
        const v = y > 8 && y < 32 ? (line[x] as number) : 220;
        rgba[p] = rgba[p + 1] = rgba[p + 2] = v;
        rgba[p + 3] = 255;
      }
    expect(decodeImage(rgba, width, height)).toBe('4006381333931');
    expect(decodeImage(rgba, width, height, { rows: 16, agree: 20 })).toBeNull();
  });

  it('only encodes valid EAN codes', () => {
    expect(() => encodeEan('4006381333932')).toThrow();
    expect(encodeEan('4006381333931')).toHaveLength(95);
    expect(encodeEan('96385074')).toHaveLength(67);
  });
});
