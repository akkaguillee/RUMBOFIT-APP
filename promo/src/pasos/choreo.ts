/**
 * The tracks that cross the whole piece: the beat, the camera, the phone (with
 * the real screens it shows), the accent colour and Rumbi. Everything sits on
 * a 120 BPM grid (a beat is 15 frames, a bar 60) and on the words of the
 * narration, w(line, word); audio/build_pasos.py plays the same grid.
 */
import type { MascotExpression } from '../../../src/features/mascot/expression';
import { CHART_FOCUS, HOY, onScreen, TAP, type PhonePlace } from './geo';
import { clamp, easeInOut, keys, phoneGeom, phonePt, prog, type Layer } from './kit';
import type { RumbiEvent } from './Rumbi';
import { C, type Layout } from './theme';
import beats from './beats.json';
import voice from './voice.json';

/** Frame of the i-th word of a narration line. */
export function w(line: string, i: number): number {
  const l = voice.find((v) => v.id === line);
  if (!l) throw new Error(`Unknown line ${line}`);
  return l.words[Math.min(i, l.words.length - 1)]!.f;
}

/* ── Beats shared by picture and sound (absolute frames; audio/pasos_takes.py writes them) ── */
type Span = readonly [number, number];
export const BEAT = beats as unknown as Record<
  | 'wake' | 'step' | 'camino' | 'rumbo' | 'drop1' | 'regis' | 'observa' | 'sigue' | 'imc' | 'kcal' | 'rutinas' | 'session' | 'setDone' | 'marcas'
  | 'stats' | 'proud' | 'agua' | 'tap250' | 'pasos' | 'racha' | 'constancia' | 'estilo' | 'light' | 'dark' | 'privacy' | 'saved' | 'build'
  | 'entrena' | 'registra' | 'celebra' | 'flash' | 'drop2' | 'tagline' | 'cta' | 'end',
  number
> &
  Record<'dash' | 'whip1' | 'chart' | 'markers' | 'whip2' | 'history' | 'wipe' | 'fan' | 'chipsHome', Span> &
  Record<'slam' | 'colours', number[]>;

export const BF = 15; // frames per beat
const v = <T,>(L: Layout, story: T, feed: T): T => (L.format === 'story' ? story : feed);

/* ── The kick drum, as audio/build_pasos.py plays it ──────────────────── */
const KICKS: [number, number, number, number][] = [
  // [from, to (exclusive), every, strength]
  [0, 120, 30, 0.55],
  [120, 233, 15, 0.75],
  [240, 1380, 15, 1],
  [1380, 1560, 60, 0.5],
  [1560, 1673, 15, 0.85],
  [1680, 1861, 15, 1.1],
];

/** 0–1 punch that decays after each kick. */
export function pulse(f: number) {
  for (const [a, b, every, g] of KICKS) {
    if (f >= a && f < b + every) {
      const k = a + Math.floor((f - a) / every) * every;
      if (k < b) return g * Math.exp(-(f - k) / 4.5);
    }
  }
  return 0;
}

/** How strongly the piece is playing at frame f (0 quiet – 1 full chorus). */
export function energy(f: number) {
  return keys(f, [
    [0, 0.15],
    [120, 0.35],
    [232, 0.7],
    [240, 1],
    [470, 0.85],
    [960, 1],
    [1370, 1],
    [1395, 0.35],
    [1555, 0.4],
    [1675, 1],
    [1690, 1],
    [1920, 0.9],
  ]);
}

/* ── Camera: a punch on every kick, a slam on the drops, shake on impacts ── */
const IMPACTS: [number, number][] = [
  [BEAT.drop1, 1],
  [BEAT.drop2, 1.2],
  [480, 0.4],
  [720, 0.4],
  [960, 0.5],
  [BEAT.estilo, 0.45],
  ...BEAT.slam.map((s) => [s, 0.25] as [number, number]),
  [BEAT.camino, 0.35],
  [BEAT.rumbo, 0.45],
  [BEAT.regis, 0.35],
  [BEAT.observa, 0.35],
  [BEAT.sigue, 0.35],
  [BEAT.agua, 0.35],
  [BEAT.pasos, 0.35],
  [BEAT.racha, 0.4],
  [BEAT.entrena, 0.35],
  [BEAT.registra, 0.4],
  [BEAT.celebra, 0.45],
];

export function cameraFx(f: number) {
  let slam = 0;
  let shake = 0;
  for (const [at, g] of IMPACTS) {
    if (f >= at && f < at + 24) {
      const d = f - at;
      slam = Math.max(slam, g * Math.exp(-d / 6));
      shake = Math.max(shake, g * Math.exp(-d / 5));
    }
  }
  // The build pushes in and trembles more and more.
  const build = prog(f, BEAT.registra, BEAT.flash, (t) => t * t);
  const scale = 1 + 0.014 * pulse(f) * energy(f) + 0.05 * slam + 0.12 * build + keys(f, [[180, 0], [236, 0.08], [240, 0]], (t) => t * t);
  const amp = 16 * shake + 7 * build;
  const x = amp * (Math.sin(f * 2.7) * 0.6 + Math.sin(f * 5.3 + 1) * 0.4);
  const y = amp * (Math.cos(f * 3.1) * 0.6 + Math.sin(f * 4.4 + 2) * 0.4);
  const rot = 0.6 * shake * Math.sin(f * 1.9);
  return { scale, x, y, rot };
}

/* ── Phone: where it is in each block ─────────────────────────────────── */
export function places(L: Layout) {
  return {
    app: v(L, { x: 540, y: 1010, w: 540 }, { x: 540, y: 700, w: 400 }),
    appSmall: v(L, { x: 540, y: 1080, w: 470 }, { x: 540, y: 745, w: 350 }),
    evo: v(L, { x: 330, y: 1040, w: 460 }, { x: 330, y: 735, w: 350 }),
    train: v(L, { x: 750, y: 1040, w: 460 }, { x: 750, y: 735, w: 350 }),
    habits: v(L, { x: 540, y: 1090, w: 500 }, { x: 540, y: 750, w: 360 }),
    style: v(L, { x: 540, y: 1080, w: 500 }, { x: 540, y: 750, w: 360 }),
    privacy: v(L, { x: 540, y: 1140, w: 450 }, { x: 540, y: 790, w: 320 }),
    build: v(L, { x: 540, y: 1060, w: 500 }, { x: 540, y: 740, w: 370 }),
  } satisfies Record<string, PhonePlace>;
}

/** Right / left columns for lifted cards. */
export function column(L: Layout, side: 'right' | 'left') {
  const right = side === 'right';
  return L.format === 'story' ? { x: right ? 790 : 290, w: 440 } : { x: right ? 800 : 280, w: 370 };
}

export interface PhoneState extends PhonePlace {
  rx: number;
  ry: number;
  rz: number;
  scale: number;
  opacity: number;
  blur: number;
  layers: Layer[];
  glowColor: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mixPlace(a: PhonePlace, b: PhonePlace, t: number): PhonePlace {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t) };
}

/** Spring-like overshoot curve for slams (0 → 1, peaking a little above 1). */
export function overshoot(t: number) {
  const c = clamp(t);
  return 1 - Math.exp(-6 * c) * Math.cos(9 * c);
}

/** Camera push on part of the screen (chart, Hoy cards), as a scale about a point of the screen. */
function push(f: number, L: Layout) {
  const big = v(L, 0.2, 0.1);
  const chart = keys(f, [
    [BEAT.markers[0] - 12, 0],
    [BEAT.markers[0] + 6, big],
    [BEAT.markers[1] - 6, big],
    [BEAT.whip2[0], 0],
  ]);
  const hoy = keys(f, [
    [968, 0],
    [990, big * 1.3],
    [1130, big * 1.3],
    [BEAT.constancia + 8, 0],
  ]);
  if (f < 720) return { s: 1 + chart, focus: CHART_FOCUS };
  if (f > 950 && f < 1200) return { s: 1 + hoy, focus: HOY.focus };
  return { s: 1, focus: CHART_FOCUS };
}

export function phonePlace(f: number, L: Layout): PhonePlace {
  const P = places(L);
  if (f < 382) return P.app;
  if (f < BEAT.whip1[0]) return mixPlace(P.app, P.appSmall, easeInOut(prog(f, 380, 392)));
  if (f < 711) return P.evo;
  if (f < 952) return P.train;
  if (f < 1190) return P.habits;
  if (f < 1370) return P.style;
  if (f < 1555) return mixPlace(P.style, P.privacy, easeInOut(prog(f, 1370, 1392)));
  return mixPlace(P.privacy, P.build, easeInOut(prog(f, 1552, 1568)));
}

/** Where a screen point (pt) is on the frame at frame f, camera push included (not the global camera). */
export function screenPoint(f: number, L: Layout, px: number, py: number) {
  const p = phonePlace(f, L);
  const c = push(f, L);
  const o = phonePt(p.w, c.focus.x, c.focus.y);
  const q = phonePt(p.w, px, py);
  return { x: p.x + o.x + (q.x - o.x) * c.s, y: p.y + o.y + (q.y - o.y) * c.s };
}

/** Circle that grows from a point of the screen (pt) to cover it, like the app's View Transition. */
function circle(f: number, at: number, p: PhonePlace, pt: { x: number; y: number }, dur: number) {
  const g = phoneGeom(p.w);
  const px = pt.x * g.k;
  const py = (47 + pt.y) * g.k;
  const R = Math.hypot(Math.max(px, g.innerW - px), Math.max(py, g.screenH - py));
  const t = prog(f, at, at + dur, easeInOut);
  return `circle(${(R * t).toFixed(1)}px at ${px.toFixed(1)}px ${py.toFixed(1)}px)`;
}

/** The five accent colours captured in the app, in the order the style block shows them. */
export const SWATCH: Record<string, string> = {
  violeta: '#9f7aff',
  naranja: '#ff8a3d',
  fucsia: '#ff4b90',
  volt: '#d6ff5c',
  cian: '#5ce3fb',
};
const COLOUR_RUN: [number, string][] = [
  [0, 'violeta'],
  [BEAT.colours[0]!, 'naranja'],
  [BEAT.colours[1]!, 'fucsia'],
  [BEAT.colours[2]!, 'volt'],
  [BEAT.colours[3]!, 'violeta'],
  [BEAT.colours[4]!, 'cian'],
];
const COLOUR_REVEAL = 8;

/** Screens of the build: the app at full speed (all dark, no light theme, so no flashing). */
const MONTAGE = ['inicio-violeta', 'progreso-todo', 'plantillas', 'sesion-serie', 'historial', 'hoy-despues', 'calendario', 'marcas', 'stats', 'imc', 'inicio-naranja', 'calorias', 'inicio-fucsia', 'sesion', 'inicio-volt', 'inicio-cian', 'progreso-todo', 'inicio-violeta'];
export function montageCuts() {
  const cuts: number[] = [];
  for (let t = BEAT.entrena; t < BEAT.celebra; t += BF) cuts.push(t);
  for (let t = BEAT.celebra; t < 1650; t += BF / 2) cuts.push(t);
  for (let t = 1650; t < BEAT.flash - 2; t += BF / 4) cuts.push(t);
  return cuts;
}

function screen(f: number, p: PhonePlace): Layer[] {
  if (f < 390) {
    // The Inicio feed, scrolled on the beat.
    const scroll = keys(f, [
      [272, 0],
      [282, 300],
      [302, 300],
      [312, 620],
      [332, 620],
      [342, 940],
      [362, 940],
      [372, 1300],
    ]);
    return [{ src: 'inicio-full', scroll, chrome: 'inicio', chromeTop: scroll > 8 ? 'inicio-520' : 'inicio' }];
  }
  if (f < 472) return [{ src: f < BEAT.observa ? 'inicio-violeta' : f < BEAT.sigue ? 'progreso-todo' : 'plantillas' }];
  if (f < 710) return [{ src: 'progreso-todo' }];
  if (f < 952) {
    if (f < BEAT.session) return [{ src: 'plantillas' }];
    if (f < BEAT.setDone) return [{ src: 'plantillas' }, { src: 'sesion', opacity: prog(f, BEAT.session, BEAT.session + 3) }];
    if (f < BEAT.history[0]) return [{ src: 'sesion' }, { src: 'sesion-serie', opacity: prog(f, BEAT.setDone, BEAT.setDone + 2) }];
    const scroll = keys(f, [
      [BEAT.history[0] + 4, 0],
      [BEAT.history[1] + 6, 1250],
    ]);
    const t = prog(f, BEAT.history[0], BEAT.history[0] + 6);
    return [{ src: 'sesion-serie' }, { src: 'historial-full', scroll, chrome: 'historial', chromeTop: scroll > 8 ? 'historial-480' : 'historial', opacity: t, dy: (1 - t) * 40 }];
  }
  if (f < 1190) {
    const layers: Layer[] = [{ src: 'hoy-antes' }];
    if (f >= BEAT.tap250) layers.push({ src: 'hoy-despues', opacity: prog(f, BEAT.tap250, BEAT.tap250 + 3) });
    if (f >= BEAT.constancia) layers.push({ src: 'calendario', clip: `inset(0 0 0 ${((1 - prog(f, BEAT.constancia, BEAT.constancia + 10, easeInOut)) * 100).toFixed(2)}%)` });
    return layers.slice(-2);
  }
  if (f < 1380) {
    if (f < BEAT.light) {
      let i = 0;
      while (i + 1 < COLOUR_RUN.length && COLOUR_RUN[i + 1]![0] <= f) i++;
      const cur = COLOUR_RUN[i]!;
      if (i === 0) return [{ src: 'inicio-violeta' }];
      const prev = COLOUR_RUN[i - 1]!;
      return [{ src: `inicio-${prev[1]}` }, { src: `inicio-${cur[1]}`, clip: circle(f, cur[0], p, TAP.accent, COLOUR_REVEAL) }];
    }
    if (f < BEAT.dark) return [{ src: 'inicio-cian' }, { src: 'inicio-cian-claro', clip: circle(f, BEAT.light, p, TAP.theme, 12), light: true }];
    return [{ src: 'inicio-cian-claro', light: true }, { src: 'inicio-violeta', clip: circle(f, BEAT.dark, p, TAP.theme, 12) }];
  }
  if (f < BEAT.entrena) return [{ src: 'inicio-violeta' }];
  const cuts = montageCuts();
  let i = 0;
  while (i + 1 < cuts.length && cuts[i + 1]! <= f) i++;
  return [{ src: MONTAGE[i % MONTAGE.length]! }];
}

export function phoneAt(f: number, L: Layout): PhoneState | null {
  if (f < BEAT.drop1 - 1 || f >= BEAT.drop2) return null;
  const P = places(L);
  let p = phonePlace(f, L);
  const c = push(f, L);
  let rx = 0;
  let ry = 0;
  let rz = 0;
  let scale = c.s;
  let opacity = 1;
  let blur = 0;
  let dx = 0;
  let dy = 0;

  // Drop 1: the phone slams in from below.
  if (f < BEAT.drop1 + 24) {
    const t = prog(f, BEAT.drop1, BEAT.drop1 + 22);
    const o = overshoot(t);
    dy = (1 - o) * L.H * 0.7;
    rx = (1 - o) * 38;
    scale *= 1 + (1 - o) * 0.25;
    blur = (1 - t) * 10;
  }
  // Flip cuts on «registra / observa / sigue adelante».
  for (const at of [BEAT.regis, BEAT.observa, BEAT.sigue]) {
    if (f >= at - 4 && f < at + 8) ry += 22 * Math.sin(Math.PI * prog(f, at - 4, at + 8)) * (f < at ? -1 : 1);
  }
  // Whip 1: out to the left, in from the right.
  if (f >= BEAT.whip1[0] && f < BEAT.whip1[1]) {
    const mid = (BEAT.whip1[0] + BEAT.whip1[1]) / 2;
    if (f < mid) {
      const t = prog(f, BEAT.whip1[0], mid, (x) => x * x);
      p = P.appSmall;
      dx = -t * L.W * 1.1;
      ry = t * 35;
      blur = t * 14;
    } else {
      const t = prog(f, mid, BEAT.whip1[1], (x) => 1 - (1 - x) ** 2);
      dx = (1 - t) * L.W * 1.1;
      ry = -(1 - t) * 35;
      blur = (1 - t) * 14;
    }
  }
  // Whip 2: a zoom through the screen into training.
  if (f >= BEAT.whip2[0] && f < BEAT.whip2[1]) {
    const mid = 711;
    if (f < mid) {
      const t = prog(f, BEAT.whip2[0], mid, (x) => x * x);
      p = P.evo;
      scale = (1 + t * 1.6) * c.s;
      opacity = 1 - t;
      blur = t * 12;
    } else {
      const t = prog(f, mid, BEAT.whip2[1], (x) => 1 - (1 - x) ** 2);
      scale = 0.55 + 0.45 * overshoot(t);
      opacity = t;
      blur = (1 - t) * 8;
    }
  }
  // The wipe into habits hides the swap; the phone rises into place behind it.
  if (f >= 952 && f < 975) {
    const t = prog(f, 952, 975);
    dy = (1 - overshoot(t)) * 220;
  }
  // «A tu estilo»: a quick spin.
  if (f >= 1188 && f < 1212) {
    const t = prog(f, 1188, 1212, easeInOut);
    rz = 360 * t;
    scale *= 1 - 0.18 * Math.sin(Math.PI * t);
  }
  // The build: the phone flies at the camera into the flash.
  if (f >= BEAT.flash - 8) {
    const t = prog(f, BEAT.flash - 8, BEAT.drop2, (x) => x * x);
    scale *= 1 + t * 2.4;
    opacity = 1 - t;
    blur = t * 16;
  }
  // A little bounce with the kick.
  const beat = pulse(f) * (f > BEAT.drop1 + 24 ? 1 : 0);
  return {
    ...p,
    x: p.x + dx + (1 - c.s) * phonePt(p.w, c.focus.x, c.focus.y).x,
    y: p.y + dy + (1 - c.s) * phonePt(p.w, c.focus.x, c.focus.y).y - beat * 6,
    rx,
    ry,
    rz,
    scale: scale * (1 + beat * 0.012),
    opacity,
    blur,
    layers: screen(f, p),
    glowColor: accentAt(f),
  };
}

/* ── Accent: violet, the five colours on the beat, cyan, violet again ──── */
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * clamp(t)).toString(16).padStart(2, '0')).join('')}`;
}

export function accentAt(f: number) {
  if (f < BEAT.colours[0]! || f >= BEAT.dark + 12) return C.violet;
  if (f >= BEAT.dark) return mix(SWATCH.cian!, C.violet, prog(f, BEAT.dark, BEAT.dark + 12));
  let i = 0;
  while (i + 1 < COLOUR_RUN.length && COLOUR_RUN[i + 1]![0] <= f) i++;
  const cur = COLOUR_RUN[i]!;
  const prev = COLOUR_RUN[Math.max(0, i - 1)]!;
  return mix(SWATCH[prev[1]]!, SWATCH[cur[1]]!, prog(f, cur[0], cur[0] + COLOUR_REVEAL));
}

/* ── Rumbi ────────────────────────────────────────────────────────────── */
interface Key {
  f: number;
  x: number;
  y: number;
  s: number;
  /** Arrive with a jump of this height (px). */
  jump?: number;
}

export function rumbiKeys(L: Layout): Key[] {
  const P = places(L);
  const big = v(L, 300, 220);
  const mid = v(L, 150, 120);
  const small = v(L, 90, 74);
  const top = (p: PhonePlace) => p.y - phoneGeom(p.w).height / 2;
  const edge = (p: PhonePlace, side: 1 | -1, dy: number) => ({ x: p.x + side * (p.w / 2 + mid * 0.42), y: top(p) + dy });
  const tapAt = (f: number, pt: { x: number; y: number }) => {
    const q = screenPoint(f, L, pt.x, pt.y);
    return { x: q.x, y: q.y - small * 0.42 };
  };
  const hero = { x: 540, y: v(L, 1250, 1010) };
  const low = { x: 540, y: v(L, 1250, 1000) };
  const appR = edge(P.app, 1, v(L, 300, 220));
  const appS = edge(P.appSmall, 1, v(L, 260, 190));
  const evoR = { x: column(L, 'right').x + v(L, 30, 40), y: v(L, 1290, 950) };
  const trainL = { x: column(L, 'left').x - v(L, 40, 50), y: v(L, 1290, 950) };
  const set1 = tapAt(BEAT.setDone, TAP.set1);
  const habR = edge(P.habits, 1, v(L, 150, 110));
  const add = tapAt(BEAT.tap250, TAP.add250);
  const styR = edge(P.style, 1, v(L, 330, 240));
  const acc = tapAt(BEAT.colours[0]!, TAP.accent);
  const theme = tapAt(BEAT.light, TAP.theme);
  const priR = edge(P.privacy, 1, v(L, 560, 400));
  const buildTop = edge(P.build, 1, v(L, 300, 220));
  const logo = { x: v(L, 884, 846), y: v(L, 780, 474) };
  return [
    { f: 0, ...hero, s: big },
    { f: BEAT.slam[5]! - 4, ...hero, s: big },
    // «el siguiente paso»: a step to the side, then a dash of light.
    { f: BEAT.step + 6, x: hero.x + v(L, 170, 150), y: hero.y + 20, s: big * 0.9, jump: 80 },
    { f: BEAT.dash[0], x: hero.x + v(L, 170, 150), y: hero.y + 20, s: big * 0.9 },
    { f: BEAT.dash[1], ...low, s: v(L, 230, 180), jump: v(L, 260, 200) },
    { f: 232, ...low, s: v(L, 230, 180) },
    // The drop: onto the edge of the phone.
    { f: BEAT.drop1 + 14, ...appR, s: mid, jump: v(L, 220, 160) },
    { f: 380, ...appR, s: mid },
    { f: 392, ...appS, s: mid },
    { f: BEAT.whip1[0], ...appS, s: mid },
    { f: BEAT.whip1[1] + 6, ...evoR, s: mid, jump: v(L, 200, 150) },
    { f: BEAT.imc - 6, ...evoR, s: mid },
    { f: BEAT.imc + 8, x: evoR.x, y: evoR.y - 30, s: mid, jump: 90 },
    { f: BEAT.kcal + 8, ...evoR, s: mid, jump: 70 },
    { f: BEAT.whip2[0], ...evoR, s: mid },
    { f: BEAT.whip2[1] + 4, ...trainL, s: mid, jump: v(L, 200, 150) },
    { f: BEAT.setDone - 12, ...trainL, s: mid },
    { f: BEAT.setDone - 1, ...set1, s: small, jump: v(L, 180, 130) },
    { f: BEAT.setDone + 5, ...set1, s: small },
    { f: BEAT.setDone + 18, ...trainL, s: mid, jump: v(L, 160, 120) },
    { f: BEAT.wipe[0], ...trainL, s: mid },
    { f: 975, ...habR, s: mid, jump: v(L, 240, 180) },
    { f: BEAT.tap250 - 12, ...habR, s: mid },
    { f: BEAT.tap250 - 1, ...add, s: small, jump: v(L, 180, 130) },
    { f: BEAT.tap250 + 5, ...add, s: small },
    { f: BEAT.tap250 + 18, ...habR, s: mid, jump: v(L, 160, 120) },
    { f: 1186, ...habR, s: mid },
    { f: 1200, ...styR, s: mid, jump: 80 },
    { f: BEAT.colours[0]! - 9, ...styR, s: mid },
    { f: BEAT.colours[0]! - 1, ...acc, s: small, jump: v(L, 150, 110) },
    { f: BEAT.colours[0]! + 4, ...acc, s: small },
    { f: BEAT.colours[0]! + 14, ...styR, s: mid, jump: 100 },
    { f: BEAT.light - 10, ...styR, s: mid },
    { f: BEAT.light - 1, ...theme, s: small, jump: v(L, 150, 110) },
    { f: BEAT.light + 4, ...theme, s: small },
    { f: BEAT.light + 14, ...styR, s: mid, jump: 100 },
    { f: BEAT.dark - 10, ...styR, s: mid },
    { f: BEAT.dark - 1, ...theme, s: small, jump: v(L, 150, 110) },
    { f: BEAT.dark + 4, ...theme, s: small },
    { f: BEAT.dark + 16, ...styR, s: mid, jump: 100 },
    { f: 1372, ...styR, s: mid },
    { f: 1400, ...priR, s: mid, jump: 60 },
    { f: 1552, ...priR, s: mid },
    { f: BEAT.entrena + 8, ...buildTop, s: mid, jump: v(L, 220, 160) },
    { f: BEAT.flash - 4, ...buildTop, s: mid },
    { f: BEAT.drop2 + 16, ...logo, s: v(L, 130, 108), jump: v(L, 260, 180) },
    { f: BEAT.end, ...logo, s: v(L, 130, 108) },
  ];
}

export function rumbiAt(f: number, L: Layout) {
  const ks = rumbiKeys(L);
  let i = ks.findIndex((k) => k.f > f);
  if (i === -1) i = ks.length - 1;
  const b = ks[i]!;
  const a = ks[Math.max(0, i - 1)]!;
  const u = b.f === a.f ? 1 : clamp((f - a.f) / (b.f - a.f));
  const e = easeInOut(u);
  const arc = b.jump ? -b.jump * 4 * u * (1 - u) : 0;
  // Rumbi dances: a hop and a squash on every kick while the music is full.
  const p = pulse(f) * clamp(energy(f) * 1.3 - 0.2);
  const resting = b.jump === undefined || u >= 1;
  return {
    x: a.x + (b.x - a.x) * e,
    y: a.y + (b.y - a.y) * e + arc - (resting ? p * 18 : 0),
    size: a.s + (b.s - a.s) * e,
    squash: resting ? p : 0,
    opacity: prog(f, BEAT.wake - 6, BEAT.wake + 4),
    accent: accentAt(f),
    hidden: f >= BEAT.flash - 2 && f < BEAT.drop2 + 2,
  };
}

/* ── Rumbi's performance: faces, presses and where it looks ───────────── */
export function rumbiEvents(L: Layout): RumbiEvent[] {
  const ev: RumbiEvent[] = [];
  const expr = (at: number, e: MascotExpression) => ev.push({ at: Math.round(at), expr: e });
  const press = (at: number) => {
    ev.push({ at: Math.round(at), press: true });
    ev.push({ at: Math.round(at) + 4, release: true });
  };
  const lookAt = (from: number, to: number, target: (f: number) => { x: number; y: number }, every = 8) => {
    for (let f = Math.round(from); f < to; f += every) {
      const r = rumbiAt(f, L);
      const t = target(f);
      ev.push({ at: f, look: [clamp((t.x - r.x) / 240, -1, 1), clamp((t.y - r.y) / 240, -1, 1)] });
    }
  };
  const P = places(L);
  const st = L.format === 'story';
  const screenAt = (p: PhonePlace, x: number, y: number) => () => onScreen(p, x, y);
  const words = (y: number) => () => ({ x: 540, y });

  // Hook: wakes, reads the words as they land, shakes off «cambiarlo todo», takes the step.
  lookAt(10, 96, words(st ? 640 : 380), 8);
  expr(BEAT.slam[2]!, 'surprised');
  expr(BEAT.slam[4]! + 4, 'thinking');
  expr(BEAT.slam[5]!, 'encouraging');
  lookAt(96, BEAT.step, words(st ? 700 : 420), 8);
  expr(BEAT.step, 'proud');
  expr(BEAT.dash[0], 'happy');
  lookAt(BEAT.camino, 236, words(st ? 700 : 380), 8);
  expr(BEAT.rumbo, 'proud');
  // App.
  expr(BEAT.drop1 + 14, 'happy');
  lookAt(BEAT.drop1 + 16, BEAT.whip1[0], screenAt(P.app, 160, 300), 10);
  expr(BEAT.regis, 'surprised');
  expr(BEAT.regis + 14, 'happy');
  // Evolution.
  expr(BEAT.whip1[1], 'neutral');
  lookAt(BEAT.whip1[1] + 6, BEAT.whip2[0], screenAt(P.evo, 213, 330), 10);
  expr(BEAT.imc, 'surprised');
  expr(BEAT.imc + 14, 'happy');
  expr(BEAT.markers[0], 'thinking');
  expr(BEAT.markers[1] - 10, 'proud');
  // Training.
  expr(BEAT.whip2[1], 'encouraging');
  lookAt(BEAT.whip2[1] + 6, BEAT.setDone - 12, screenAt(P.train, 200, 300), 10);
  press(BEAT.setDone - 1);
  expr(BEAT.setDone + 4, 'proud');
  expr(BEAT.setDone + 40, 'happy');
  lookAt(BEAT.setDone + 20, BEAT.wipe[0], screenAt(P.train, 200, 360), 10);
  expr(BEAT.proud, 'proud');
  // Habits.
  expr(975, 'happy');
  lookAt(975, BEAT.tap250 - 12, () => screenPoint(980, L, HOY.water.x, HOY.water.y), 10);
  press(BEAT.tap250 - 1);
  expr(BEAT.tap250 + 4, 'surprised');
  expr(BEAT.tap250 + 20, 'happy');
  lookAt(BEAT.tap250 + 20, 1186, () => screenPoint(1050, L, HOY.steps.x, HOY.steps.y), 10);
  expr(BEAT.racha, 'proud');
  expr(BEAT.constancia, 'encouraging');
  // Style.
  expr(1200, 'happy');
  press(BEAT.colours[0]! - 1);
  for (const at of BEAT.colours.slice(1)) expr(at, at % 30 === 0 ? 'surprised' : 'happy');
  press(BEAT.light - 1);
  expr(BEAT.light + 2, 'surprised');
  expr(BEAT.light + 18, 'happy');
  press(BEAT.dark - 1);
  lookAt(1200, 1372, screenAt(P.style, 195, 300), 12);
  // Privacy.
  expr(1400, 'neutral');
  expr(1420, 'encouraging');
  lookAt(1400, 1552, screenAt(P.privacy, 195, 300), 12);
  expr(BEAT.saved, 'happy');
  // Build and close.
  expr(BEAT.entrena, 'encouraging');
  expr(BEAT.celebra, 'proud');
  lookAt(BEAT.entrena + 10, BEAT.flash - 4, screenAt(P.build, 195, 400), 10);
  expr(BEAT.drop2 + 16, 'happy');
  lookAt(BEAT.drop2 + 18, BEAT.end, () => ({ x: 540, y: st ? 760 : 400 }), 14);
  expr(BEAT.cta, 'proud');
  expr(BEAT.cta + 50, 'happy');
  return ev.sort((a, b) => a.at - b.at);
}

/* ── Hook geometry: the dash of light ─────────────────────────────────── */
export function dashPath(L: Layout) {
  return L.format === 'story'
    ? 'M 700 1250 C 1000 1120, 1010 720, 760 620 C 520 520, 160 700, 190 980 C 220 1240, 420 1310, 540 1260'
    : 'M 690 1010 C 960 940, 990 600, 760 520 C 540 450, 170 560, 200 760 C 230 960, 420 1040, 540 1000';
}

/** Distance travelled by the particles (integral of their speed). */
export function travel(f: number) {
  let d = 0;
  for (let t = 0; t < f; t += 2) d += 2 * (1.2 + 9 * energy(t) + 22 * prog(t, BEAT.registra, BEAT.flash, (x) => x * x));
  return d;
}
