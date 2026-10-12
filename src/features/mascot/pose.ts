import type { MascotExpression } from './expression';

/*
 * Rumbi's geometry, in the units of a 100 × 100 viewBox. The body is a sphere
 * of radius 40 centred at (50, 50); the eyes sit on its surface, so moving the
 * gaze projects them onto the sphere (they narrow and draw together near the
 * edge) instead of sliding flat across it.
 */
export const BODY = { cx: 50, cy: 50, r: 40 } as const;
/** Height of the eye line at rest (slightly above the centre reads friendlier). */
export const EYE_LINE = 48.5;

/** Everything an expression sets. Springs carry the rig from one pose to the next. */
export interface Pose {
  /** Eye width and height (a tall pill, a short dash or a round eye). */
  w: number;
  h: number;
  /** Arch: > 0 lifts the middle (content squint ∩), < 0 sags it (sleepy ∪). */
  bend: number;
  /** Degrees; > 0 raises the inner ends (gentle concern). Mirrored per eye. */
  tilt: number;
  /** Eye line offset; < 0 looks up and brighter. */
  y: number;
  /** Half the distance between the eyes. */
  gap: number;
  /** Head tilt in degrees (rotates the face around the centre). */
  roll: number;
  /** Resting gaze. */
  gazeX: number;
  gazeY: number;
  /** Accent glow behind the body, accent rim light, warm and cool tints, thinking badge (0–1). */
  glow: number;
  rim: number;
  warm: number;
  cool: number;
  badge: number;
  /** Idle breathing: period (s) and depth (fraction of scale). */
  breath: number;
  breathDepth: number;
  /** Seconds between blinks [min, max] and blink speed factor (> 1 slower). */
  blinkEvery: readonly [number, number];
  blinkSlow: number;
  /** Seconds between idle glances [min, max]; null = keeps its gaze. */
  glanceEvery: readonly [number, number] | null;
  /** How far an idle glance or the pointer can move the eyes (fraction of the full range). */
  glanceReach: number;
}

const base: Pose = {
  w: 8.4,
  h: 17,
  bend: 0,
  tilt: 0,
  y: 0,
  gap: 9.2,
  roll: 0,
  gazeX: 0,
  gazeY: 0,
  glow: 0.42,
  rim: 0.72,
  warm: 0,
  cool: 0,
  badge: 0,
  breath: 4.2,
  breathDepth: 0.012,
  blinkEvery: [2.2, 5.4],
  blinkSlow: 1,
  glanceEvery: [4.5, 9],
  glanceReach: 1,
};

export const POSES: Record<MascotExpression, Pose> = {
  neutral: base,
  happy: { ...base, w: 11, h: 3.8, bend: 3, y: -1, gap: 10, glow: 0.56, rim: 0.82, breath: 3.8, blinkEvery: [3, 6], glanceEvery: [6, 10] },
  proud: {
    ...base,
    w: 12,
    h: 4.2,
    bend: 3.8,
    y: -2.5,
    gap: 10.5,
    glow: 1,
    rim: 1,
    breath: 3.2,
    breathDepth: 0.015,
    blinkEvery: [3.5, 6.5],
    glanceEvery: [6, 11],
  },
  encouraging: { ...base, w: 8.8, h: 16, bend: 0.8, y: -2.5, roll: 4, gazeY: -1.2, glow: 0.6, rim: 0.85, breath: 3.8 },
  thinking: {
    ...base,
    w: 8,
    h: 15,
    y: -1,
    gap: 9,
    roll: -5,
    gazeX: 3.6,
    gazeY: -3.2,
    glow: 0.48,
    rim: 0.9,
    cool: 0.55,
    badge: 1,
    breath: 3.6,
    glanceEvery: [2.4, 4],
    glanceReach: 0.8,
  },
  sleepy: {
    ...base,
    w: 10.5,
    h: 3.4,
    bend: -1.6,
    y: 2.5,
    gap: 10,
    gazeY: 1,
    glow: 0.22,
    rim: 0.5,
    cool: 0.28,
    breath: 6.2,
    breathDepth: 0.022,
    blinkEvery: [4.5, 8],
    blinkSlow: 1.8,
    glanceEvery: null,
    glanceReach: 0.4,
  },
  concerned: {
    ...base,
    // Soft, slightly shortened pills with raised inner ends: attentive and kind, not a flat "error" face.
    w: 9,
    h: 11,
    tilt: 7,
    y: 2,
    gap: 10,
    glow: 0.26,
    rim: 0.45,
    warm: 0.62,
    breath: 4.8,
    breathDepth: 0.01,
    blinkEvery: [2.6, 5.2],
    glanceEvery: [6, 10],
    glanceReach: 0.6,
  },
  surprised: { ...base, w: 11.5, h: 13, y: -2, gap: 10.5, glow: 0.62, rim: 0.85, breath: 3, breathDepth: 0.01, glanceEvery: [5, 9] },
};

/** Full gaze range (viewBox units) before an expression's reach is applied. */
export const GAZE_RANGE = { x: 6.5, y: 4.8 } as const;

const K = 0.5523; // cubic Bézier circle approximation
const f = (n: number) => (Math.abs(n) < 0.005 ? '0' : n.toFixed(2));

/**
 * Path of one eye: a stadium (rounded rectangle with fully round ends) of
 * `w` × `h`, arched by `bend` and rotated by `rot` degrees around (cx, cy).
 * Every edge is a cubic segment, so the arch warp bends straight edges too and
 * any two eyes interpolate smoothly. Pure: unit-tested.
 */
export function eyePath(cx: number, cy: number, w: number, h: number, bend: number, rot: number): string {
  const W = Math.max(w, 0.4);
  const H = Math.max(h, 0.4);
  const a = W / 2;
  const b = H / 2;
  const r = Math.min(a, b);
  const sx = (a - r) * 2; // straight length, horizontal
  const sy = (b - r) * 2;
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pt = (x: number, y: number) => {
    // Arch warp: the middle moves by `bend`, the ends stay put.
    const t = x / a;
    const wy = y - bend * (1 - t * t);
    return `${f(cx + x * cos - wy * sin)} ${f(cy + x * sin + wy * cos)}`;
  };
  const k = r * K;
  const segs: [number, number, number, number, number, number][] = [
    // top edge (left → right), then corners and edges clockwise
    [-a + r + sx / 3, -b, a - r - sx / 3, -b, a - r, -b],
    [a - r + k, -b, a, -b + r - k, a, -b + r],
    [a, -b + r + sy / 3, a, b - r - sy / 3, a, b - r],
    [a, b - r + k, a - r + k, b, a - r, b],
    [a - r - sx / 3, b, -a + r + sx / 3, b, -a + r, b],
    [-a + r - k, b, -a, b - r + k, -a, b - r],
    [-a, b - r - sy / 3, -a, -b + r + sy / 3, -a, -b + r],
    [-a, -b + r - k, -a + r - k, -b, -a + r, -b],
  ];
  let d = `M${pt(-a + r, -b)}`;
  for (const [x1, y1, x2, y2, x, y] of segs) d += `C${pt(x1, y1)} ${pt(x2, y2)} ${pt(x, y)}`;
  return `${d}Z`;
}

export interface EyePlacement {
  x: number;
  y: number;
  /** Foreshortening of the eye's width and height (1 at the centre of the face). */
  sx: number;
  sy: number;
}

const clampUnit = (v: number) => Math.max(-0.95, Math.min(0.95, v));

/**
 * Places both eyes on the sphere. The gaze turns the face (longitude and
 * latitude), and each eye sits `gap` to either side of it: near the rim the
 * eyes draw together and narrow, like marks on a turning ball.
 */
export function placeEyes(gazeX: number, gazeY: number, gap: number): [EyePlacement, EyePlacement] {
  const { cx, r } = BODY;
  const lon = Math.asin(clampUnit(gazeX / r));
  const spread = Math.asin(clampUnit(gap / r));
  const lat = Math.asin(clampUnit((EYE_LINE - BODY.cy + gazeY) / r));
  const y = BODY.cy + r * Math.sin(lat);
  const sy = Math.cos(lat);
  const eye = (side: -1 | 1): EyePlacement => {
    const a = lon + side * spread;
    return { x: cx + r * Math.sin(a), y, sx: Math.cos(a) / Math.cos(spread), sy };
  };
  return [eye(-1), eye(1)];
}
