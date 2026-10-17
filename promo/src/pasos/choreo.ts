/**
 * The two characters that cross every block: the phone (with the real
 * screens it shows) and Rumbi. Both are tracks over the absolute frame, so
 * neither jumps at a cut. Beats are tied to the narration with w(line, word).
 */
import type { MascotExpression } from '../../../src/features/mascot/expression';
import { CHART_FOCUS, CHIPS, column, HOY, onScreen, places, TAP, type PhonePlace } from './geo';
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
  'wake' | 'light' | 'logo' | 'imc' | 'kcal' | 'setDone' | 'records' | 'stats' | 'proud' | 'icons' | 'iconsWater' | 'iconsSteps' | 'water' | 'streak' | 'calendar' | 'sheetUp' | 'cyan' | 'sheetDown' | 'light' | 'backViolet' | 'saved' | 'cardA' | 'cardB' | 'cardC' | 'logoEnd' | 'tagline' | 'cta',
  number
> &
  Record<'trail' | 'outline' | 'phoneIn' | 'scroll1' | 'scroll2' | 'toProgress' | 'chartDraw' | 'zoomChart' | 'markers' | 'toTemplates' | 'cardIn' | 'toSession' | 'history' | 'toHoy' | 'toStyle' | 'fan' | 'chipsIn' | 'chipsHome' | 'phoneOut' | 'closeTrail', Span>;

/** Duration of the app's circular theme / accent reveal (620 ms). */
export const REVEAL = 19;

/* ── Phone ────────────────────────────────────────────────────────────── */
export interface PhoneState extends PhonePlace {
  rx: number;
  ry: number;
  rz: number;
  scale: number;
  opacity: number;
  layers: Layer[];
  outline?: number;
  glowColor: string;
}

function lerpPlace(f: number, pts: [number, PhonePlace][]): PhonePlace {
  const frames = pts.map((p) => p[0]);
  return {
    x: keys(f, pts.map((p, i) => [frames[i]!, p[1].x])),
    y: keys(f, pts.map((p, i) => [frames[i]!, p[1].y])),
    w: keys(f, pts.map((p, i) => [frames[i]!, p[1].w])),
  };
}

export function phonePlace(f: number, L: Layout): PhonePlace {
  const P = places(L);
  const out = { ...P.privacy, y: P.privacy.y + L.H * 0.75 };
  return lerpPlace(f, [
    [270, P.app],
    [586, P.app],
    [626, P.evolution],
    [1050, P.training],
    [1496, P.training],
    [1530, P.habits],
    [1912, P.habits],
    [1946, P.style],
    [2296, P.style],
    [2340, P.privacy],
    [BEAT.phoneOut[0], P.privacy],
    [BEAT.phoneOut[1], out],
  ]);
}

/** Circle that grows from a point of the screen (pt) to cover it, like the app's View Transition. */
function circle(f: number, at: number, p: PhonePlace, pt: { x: number; y: number }, grow = 1) {
  const g = phoneGeom(p.w);
  const px = pt.x * g.k;
  const py = (47 + pt.y) * g.k;
  const R = Math.hypot(Math.max(px, g.innerW - px), Math.max(py, g.screenH - py));
  const t = prog(f, at, at + REVEAL, easeInOut) * grow;
  return `circle(${(R * t).toFixed(1)}px at ${px.toFixed(1)}px ${py.toFixed(1)}px)`;
}

/** Page change inside the app: the new page rises in as it fades (riseVariants). */
function rise(f: number, a: number, b: number): Partial<Layer> {
  const t = prog(f, a, b);
  return { opacity: t, dy: (1 - t) * 26 };
}

/**
 * Camera push-in on the whole phone: the weight chart while each weigh-in
 * lights up, the Hoy cards while water is added. The focus stays in place.
 */
export function camera(f: number, p: PhonePlace, L: Layout) {
  // The 4:5 frame has little room above the phone: a gentler push.
  const push = L.format === 'story' ? 0.2 : 0.07;
  const chart = keys(f, [
    [BEAT.zoomChart[0], 1],
    [BEAT.zoomChart[1], 1 + push],
    [1000, 1 + push],
    [1034, 1],
  ]);
  const hoy = keys(f, [
    [BEAT.toHoy[0], 1],
    [BEAT.toHoy[1] + 14, 1 + push * 0.9],
    [BEAT.calendar - 8, 1 + push * 0.9],
    [BEAT.calendar + 14, 1],
  ]);
  const s = f < 1300 ? chart : hoy;
  const focus = f < 1300 ? CHART_FOCUS : HOY.focus;
  const o = phonePt(p.w, focus.x, focus.y);
  return { s, x: p.x + (1 - s) * o.x, y: p.y + (1 - s) * o.y };
}

/** Where a screen point (pt) is on the frame at frame f, camera included. */
export function screenPoint(f: number, L: Layout, px: number, py: number) {
  const p = phonePlace(f, L);
  const c = camera(f, p, L);
  return onScreen({ ...p, x: c.x, y: c.y }, px, py, c.s);
}

function screen(f: number, p: PhonePlace): Layer[] {
  if (f < 600) {
    const scroll = keys(f, [
      [BEAT.scroll1[0], 0],
      [BEAT.scroll1[1], 560],
      [BEAT.scroll2[0], 560],
      [BEAT.scroll2[1], 1300],
    ]);
    return [{ src: 'inicio-full', scroll, chrome: 'inicio', chromeTop: scroll > 8 ? 'inicio-520' : 'inicio' }];
  }
  if (f < 1050) {
    const base: Layer[] = [{ src: 'inicio-full', scroll: 1300, chrome: 'inicio', chromeTop: 'inicio-520' }];
    return [...(f < BEAT.toProgress[1] ? base : []), { src: 'progreso-todo', ...rise(f, ...BEAT.toProgress) }];
  }
  if (f < 1500) {
    const layers: Layer[] = [{ src: 'progreso-todo' }, { src: 'plantillas', ...rise(f, ...BEAT.toTemplates) }];
    if (f >= BEAT.toSession[0]) layers.push({ src: 'sesion', opacity: prog(f, ...BEAT.toSession) });
    if (f >= BEAT.setDone) layers.push({ src: 'sesion-serie', opacity: prog(f, BEAT.setDone, BEAT.setDone + 3) });
    if (f >= BEAT.history[0]) {
      const scroll = keys(f, [
        [BEAT.history[0] + 10, 0],
        [BEAT.history[1] + 30, 1250],
      ]);
      layers.push({ src: 'historial-full', scroll, chrome: 'historial', chromeTop: scroll > 8 ? 'historial-480' : 'historial', ...rise(f, BEAT.history[0], BEAT.history[0] + 14) });
    }
    return layers.slice(-2);
  }
  if (f < 1920) {
    const layers: Layer[] = [{ src: 'historial-full', scroll: 1250, chrome: 'historial', chromeTop: 'historial-480' }, { src: 'hoy-antes', ...rise(f, ...BEAT.toHoy) }];
    if (f >= BEAT.water) layers.push({ src: 'hoy-despues', opacity: prog(f, BEAT.water, BEAT.water + 4) });
    if (f >= BEAT.calendar) {
      const t = prog(f, BEAT.calendar, BEAT.calendar + 16, easeInOut);
      layers.push({ src: 'calendario', clip: `inset(0 0 0 ${((1 - t) * 100).toFixed(2)}%)` });
    }
    return layers.slice(-2);
  }
  if (f < 2310) {
    if (f < BEAT.sheetUp) return [{ src: 'calendario' }, { src: 'inicio-violeta', ...rise(f, ...BEAT.toStyle) }];
    if (f < BEAT.cyan) {
      const t = prog(f, BEAT.sheetUp, BEAT.sheetUp + 12);
      return [{ src: 'inicio-violeta' }, { src: 'acentos', opacity: t, dy: (1 - t) * 120 }];
    }
    if (f < BEAT.sheetDown) return [{ src: 'acentos' }, { src: 'acentos-cian', clip: circle(f, BEAT.cyan, p, TAP.cyan) }];
    if (f < BEAT.light) {
      // The sheet slides away over the app, already cyan.
      const t = prog(f, BEAT.sheetDown, BEAT.sheetDown + 12, easeInOut);
      return [{ src: 'inicio-cian' }, { src: 'acentos-cian', opacity: 1 - t, dy: t * 140 }];
    }
    if (f < BEAT.backViolet) return [{ src: 'inicio-cian' }, { src: 'inicio-cian-claro', clip: circle(f, BEAT.light, p, TAP.theme), light: true }];
    return [{ src: 'inicio-cian-claro', light: true }, { src: 'inicio-violeta', clip: circle(f, BEAT.backViolet, p, TAP.theme) }];
  }
  return [{ src: 'inicio-violeta' }];
}

export function phoneAt(f: number, L: Layout): PhoneState | null {
  if (f < BEAT.outline[0] || f > BEAT.phoneOut[1]) return null;
  const p = phonePlace(f, L);
  const cam = camera(f, p, L);
  const ry = keys(f, [
    [590, 0],
    [630, 6],
    [1040, 6],
    [1070, 0],
  ]);
  const scale = cam.s * (1 + 0.015 * Math.sin(f / 90));
  return {
    ...p,
    x: cam.x,
    y: cam.y,
    rx: 0,
    ry,
    rz: keys(f, [
      [BEAT.phoneOut[0], 0],
      [BEAT.phoneOut[1], 8],
    ]),
    scale,
    opacity: f < BEAT.phoneIn[0] ? 0 : prog(f, ...BEAT.phoneIn) * (1 - prog(f, BEAT.phoneOut[0] + 10, BEAT.phoneOut[1])),
    outline: f < BEAT.phoneIn[1] + 6 ? prog(f, ...BEAT.outline, easeInOut) : undefined,
    layers: screen(f, p),
    glowColor: accentAt(f),
  };
}

/* ── Accent: violet, cyan while the user tries it, violet again ───────── */
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * clamp(t)).toString(16).padStart(2, '0')).join('')}`;
}

export function accentAt(f: number) {
  const toCyan = prog(f, BEAT.cyan, BEAT.cyan + REVEAL, easeInOut);
  const back = prog(f, BEAT.backViolet, BEAT.backViolet + REVEAL, easeInOut);
  return mix(C.violet, C.cyan, toCyan * (1 - back));
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
  const st = L.format === 'story';
  const P = places(L);
  const col = column(L);
  const v = (a: number, b: number) => (st ? a : b);
  const big = v(300, 236);
  const mid = v(150, 124);
  const small = v(84, 70);
  const hero = { x: 540, y: v(900, 610) };
  const appEdge = P.app.x + P.app.w / 2 + mid / 2 - 6;
  const top = (p: PhonePlace) => p.y - phoneGeom(p.w).height / 2;
  const tap = (p: PhonePlace, pt: { x: number; y: number }) => {
    const q = onScreen(p, pt.x, pt.y);
    return { x: q.x, y: q.y - small * 0.42 };
  };
  const set1 = tap(P.training, TAP.set1);
  const add = (() => {
    const q = screenPoint(BEAT.water, L, TAP.add250.x, TAP.add250.y);
    return { x: q.x, y: q.y - small * 0.42 };
  })();
  const acc = tap(P.style, TAP.accent);
  const theme = tap(P.style, TAP.theme);
  const rest = { x: col.x, y: v(1150, 860) };
  const styleRest = { x: P.style.x + P.style.w / 2 + mid / 2 + v(26, 30), y: v(900, 640) };
  const privRest = { x: P.privacy.x + P.privacy.w / 2 + mid / 2 + v(30, 40), y: v(1120, 840) };
  const logo = { x: v(884, 846), y: v(811, 474) };
  return [
    { f: 0, ...hero, s: big },
    { f: 256, ...hero, s: big },
    // Along the edge of the phone the path became.
    { f: 300, x: appEdge, y: top(P.app) + v(90, 70), s: mid },
    { f: 360, x: appEdge, y: top(P.app) + v(240, 180), s: mid, jump: 40 },
    { f: 430, x: appEdge, y: top(P.app) + v(470, 350), s: mid, jump: 40 },
    { f: 500, x: appEdge, y: top(P.app) + v(330, 250), s: mid, jump: 50 },
    { f: 590, x: appEdge, y: top(P.app) + v(330, 250), s: mid },
    // Evolution: beside the chart, then under the lifted cards.
    { f: 640, x: col.x, y: v(900, 660), s: mid * 0.9 },
    { f: 744, x: col.x, y: v(900, 660), s: mid * 0.9 },
    { f: 772, ...rest, s: mid * 0.9, jump: 60 },
    { f: 890, ...rest, s: mid * 0.9 },
    { f: 915, x: col.x, y: v(930, 680), s: mid * 0.9, jump: 50 },
    { f: 1040, x: col.x, y: v(930, 680), s: mid * 0.9 },
    // Training: tap the first set, celebrate, watch the history.
    { f: 1080, ...rest, s: mid * 0.9 },
    { f: BEAT.setDone - 16, ...rest, s: mid * 0.9 },
    { f: BEAT.setDone - 2, ...set1, s: small, jump: v(160, 120) },
    { f: BEAT.setDone + 6, ...set1, s: small },
    { f: BEAT.setDone + 20, ...rest, s: mid * 0.9, jump: v(140, 100) },
    { f: 1490, ...rest, s: mid * 0.9 },
    // Habits: «+ 250», then the streak.
    { f: BEAT.water - 16, ...rest, s: mid * 0.9 },
    { f: BEAT.water - 2, ...add, s: small, jump: v(160, 120) },
    { f: BEAT.water + 6, ...add, s: small },
    { f: BEAT.water + 20, ...rest, s: mid * 0.9, jump: v(140, 100) },
    { f: 1905, ...rest, s: mid * 0.9 },
    // Style: accent button, theme toggle.
    { f: 1950, ...styleRest, s: mid },
    { f: BEAT.sheetUp - 18, ...styleRest, s: mid },
    { f: BEAT.sheetUp - 4, ...acc, s: small, jump: v(170, 120) },
    { f: BEAT.sheetUp + 4, ...acc, s: small },
    { f: BEAT.sheetUp + 18, ...styleRest, s: mid, jump: v(120, 90) },
    { f: BEAT.light - 18, ...styleRest, s: mid },
    { f: BEAT.light - 4, ...theme, s: small, jump: v(170, 120) },
    { f: BEAT.light + 4, ...theme, s: small },
    { f: BEAT.light + 18, ...styleRest, s: mid, jump: v(120, 90) },
    { f: BEAT.fan[0], ...styleRest, s: mid },
    { f: BEAT.fan[0] + 20, x: styleRest.x, y: v(640, 470), s: mid },
    { f: BEAT.fan[1], x: styleRest.x, y: v(640, 470), s: mid },
    { f: BEAT.fan[1] + 20, ...styleRest, s: mid },
    // Privacy: next to the phone.
    { f: 2300, ...styleRest, s: mid },
    { f: 2346, ...privRest, s: mid },
    { f: 2640, ...privRest, s: mid },
    // Close: hop along the three cards, then next to the name.
    { f: BEAT.cardA + 4, x: v(560, 600), y: v(640, 330), s: mid * 0.9, jump: 80 },
    { f: BEAT.cardB + 6, x: v(470, 400), y: v(880, 600), s: mid * 0.9, jump: 70 },
    { f: BEAT.cardC + 6, x: v(700, 720), y: v(1070, 820), s: mid * 0.9, jump: 70 },
    { f: BEAT.closeTrail[0], x: v(700, 720), y: v(1070, 820), s: mid * 0.9 },
    { f: BEAT.logoEnd + 22, ...logo, s: v(128, 108), jump: 90 },
    { f: 3135, ...logo, s: v(128, 108) },
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
  return {
    x: a.x + (b.x - a.x) * e,
    y: a.y + (b.y - a.y) * e + arc,
    size: a.s + (b.s - a.s) * e,
    opacity: prog(f, 0, 24),
    accent: accentAt(f),
  };
}

/* ── Rumbi's performance: faces, presses and where it looks ───────────── */
export function rumbiEvents(L: Layout): RumbiEvent[] {
  const ev: RumbiEvent[] = [];
  const expr = (at: number, e: MascotExpression) => ev.push({ at, expr: e });
  const press = (at: number) => {
    ev.push({ at, press: true });
    ev.push({ at: at + 5, release: true });
  };
  // Look at a point (absolute px) for a while: the rig holds a glance ~2 s, so renew it.
  const lookAt = (from: number, to: number, target: (f: number) => { x: number; y: number }, every = 8) => {
    for (let f = from; f < to; f += every) {
      const r = rumbiAt(f, L);
      const t = target(f);
      ev.push({ at: f, look: [clamp((t.x - r.x) / 260, -1, 1), clamp((t.y - r.y) / 260, -1, 1)] });
    }
  };
  const st = L.format === 'story';
  const P = places(L);
  const screenAt = (p: PhonePlace, x: number, y: number) => () => onScreen(p, x, y);

  // Hook: wakes up, notices the light, follows the path it draws.
  lookAt(30, 62, () => ({ x: 540, y: st ? 960 : 660 }), 10);
  expr(BEAT.light + 8, 'surprised');
  lookAt(BEAT.light + 8, BEAT.trail[0], () => hookLight(L), 8);
  expr(BEAT.trail[0], 'happy');
  lookAt(BEAT.trail[0], BEAT.logo + 8, (f) => hookHead(L, f), 4);
  expr(w('l1', 15), 'proud');
  expr(w('l1', 15) + 34, 'happy');
  // App: looks at the screen as it scrolls; meets itself in «Tu consejo de hoy».
  expr(296, 'neutral');
  expr(w('l2', 0), 'encouraging');
  expr(w('l2', 10), 'neutral');
  lookAt(300, 600, (f) => onScreen(P.app, 160, f < BEAT.scroll2[1] ? 300 : 160), 10);
  expr(w('l2', 15), 'happy');
  // Evolution.
  expr(640, 'neutral');
  expr(BEAT.chartDraw[0], 'thinking');
  lookAt(640, 1040, (f) => (f < BEAT.imc + 10 ? onScreen(P.evolution, 78 + 270 * prog(f, ...BEAT.chartDraw), 330) : f < 890 ? { x: column(L).x, y: st ? 760 : 520 } : onScreen(P.evolution, 213, 330)), 8);
  expr(BEAT.imc, 'happy');
  expr(w('l3', 23), 'happy');
  // Training.
  expr(1090, 'encouraging');
  lookAt(1080, BEAT.setDone - 16, screenAt(P.training, 200, 200), 10);
  press(BEAT.setDone - 2);
  expr(BEAT.setDone + 8, 'proud');
  lookAt(BEAT.setDone + 22, 1500, (f) => (f < BEAT.history[0] ? { x: column(L).x, y: st ? 700 : 480 } : onScreen(P.training, 200, 300)), 10);
  expr(BEAT.history[0], 'neutral');
  expr(BEAT.proud, 'proud');
  expr(BEAT.proud + 40, 'happy');
  // Habits.
  expr(1537, 'encouraging');
  lookAt(1500, BEAT.water - 16, (f) => (f < BEAT.iconsWater ? { x: column(L).x, y: st ? 760 : 520 } : onScreen(P.habits, 195, 200)), 10);
  press(BEAT.water - 2);
  expr(BEAT.water + 8, 'happy');
  expr(BEAT.water + 30, 'neutral');
  expr(w('l5', 14), 'proud');
  expr(w('l5', 14) + 40, 'happy');
  lookAt(BEAT.water + 22, 1910, (f) => (f < BEAT.calendar ? { x: column(L).x, y: st ? 700 : 480 } : onScreen(P.habits, 195, 420)), 10);
  expr(w('l5', 18), 'encouraging');
  // Style.
  expr(1950, 'happy');
  lookAt(1950, BEAT.sheetUp - 18, screenAt(P.style, 195, 120), 10);
  press(BEAT.sheetUp - 4);
  lookAt(BEAT.sheetUp + 18, BEAT.light - 18, screenAt(P.style, 120, 600), 10);
  expr(BEAT.cyan, 'surprised');
  expr(BEAT.cyan + 22, 'happy');
  press(BEAT.light - 4);
  expr(BEAT.light + 6, 'surprised');
  expr(BEAT.light + 26, 'happy');
  expr(BEAT.fan[0] + 30, 'neutral');
  expr(BEAT.fan[1], 'happy');
  lookAt(BEAT.light + 18, 2300, (f) => (f > BEAT.fan[0] && f < BEAT.fan[1] ? { x: 300, y: st ? 1000 : 720 } : onScreen(P.style, 195, 300)), 12);
  // Privacy.
  expr(2350, 'neutral');
  expr(w('l7', 3), 'encouraging');
  lookAt(2346, 2640, screenAt(P.privacy, 195, 300), 12);
  expr(BEAT.saved, 'happy');
  // Close.
  expr(BEAT.cardA, 'happy');
  expr(w('l8', 7), 'proud');
  expr(w('l8', 7) + 40, 'happy');
  lookAt(BEAT.logoEnd + 24, 3135, () => ({ x: 540, y: st ? 640 : 330 }), 14);
  expr(BEAT.cta + 2, 'proud');
  expr(BEAT.cta + 44, 'happy');
  return ev.sort((a, b) => a.at - b.at);
}

/* ── Hook geometry, shared with the hook scene ────────────────────────── */
export function hookLight(L: Layout) {
  return L.format === 'story' ? { x: 806, y: 640 } : { x: 822, y: 372 };
}

export function hookPath(L: Layout) {
  return L.format === 'story'
    ? 'M 806 640 C 990 720, 1010 1060, 780 1170 C 560 1270, 230 1210, 175 990 C 120 770, 300 560, 470 470 C 560 425, 560 390, 540 360'
    : 'M 822 372 C 990 440, 1000 760, 760 860 C 540 950, 230 900, 190 700 C 150 500, 330 330, 470 250 C 520 222, 545 190, 540 150';
}

/** The light's head along the hook path (sampled analytically from the same cubic segments). */
export function hookHead(L: Layout, f: number) {
  const t = prog(f, ...BEAT.trail, easeInOut);
  return cubicPath(hookPath(L), t);
}

/** Point at parameter t (0–1, equal share per segment) of an «M … C … C …» path. */
export function cubicPath(d: string, t: number) {
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const segs: number[][] = [];
  let x0 = nums[0]!;
  let y0 = nums[1]!;
  for (let i = 2; i + 5 < nums.length + 1; i += 6) {
    const s = [x0, y0, ...nums.slice(i, i + 6)];
    if (s.length < 8) break;
    segs.push(s);
    x0 = s[6]!;
    y0 = s[7]!;
  }
  const n = segs.length;
  const k = Math.min(n - 1, Math.floor(clamp(t) * n));
  const u = clamp(t) * n - k;
  const [ax, ay, bx, by, cx, cy, dx, dy] = segs[k]!;
  const m = 1 - u;
  return {
    x: m * m * m * ax! + 3 * m * m * u * bx! + 3 * m * u * u * cx! + u * u * u * dx!,
    y: m * m * m * ay! + 3 * m * m * u * by! + 3 * m * u * u * cy! + u * u * u * dy!,
  };
}

export { CHIPS };
