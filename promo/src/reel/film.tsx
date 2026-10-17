import { getLength, getPointAtLength } from '@remotion/paths';
import { useMemo } from 'react';
import { Img, useCurrentFrame } from 'remotion';
import { Rumbi, type RumbiEvent } from '../Rumbi';
import chartline from './chartline.json';
import { hookGeo, finaleGeo } from './geo';
import {
  Glint,
  Phone,
  ScreenTrack,
  Scrolled,
  Shot,
  Spotlight,
  Tap,
  clamp,
  easeInOut,
  easeOut,
  keys,
  mix,
  phoneGeom,
  prog,
  ptToFrame,
  seqUrl,
  SCREEN_H,
  SCREEN_W,
  shotUrl,
  type Seg,
} from './kit';
import { useLayout, type Layout } from './layout';
import { ACCENT, V } from './theme';
import { cue as c, cues, SCENES } from './timing';

/* ── Interface state over time: accent and theme, as the app shows them ─── */
export function accentAt(f: number): string {
  const a = cues('sty.accents');
  const order = ['cian', 'fucsia', 'naranja', 'volt', 'rojo'];
  if (f >= c('sty.violet')) {
    const l = cues('sty.light');
    if (f >= l[0]! && f < l[1]!) return ACCENT.cian!;
    if (f >= l[1]! && f < l[2]!) return ACCENT.fucsia!;
    return ACCENT.violeta!;
  }
  for (let k = a.length - 1; k >= 0; k--) if (f >= a[k]!) return ACCENT[order[k]!]!;
  return ACCENT.violeta!;
}
export const isLight = (f: number) => f >= c('sty.theme') + 11 && f < c('sty.dark') + 10;
export const lightAmount = (f: number) => prog(f, c('sty.theme') + 2, c('sty.theme') + 24, easeInOut) * (1 - prog(f, c('sty.dark') + 2, c('sty.dark') + 22, easeInOut));

/* ── The phone's pose ───────────────────────────────────────────────────── */
export interface Pose {
  x: number;
  y: number;
  w: number;
  scale: number;
  rx: number;
  ry: number;
  rz: number;
  opacity: number;
}

const PHONE_FROM = SCENES.reveal[0];
const PHONE_TO = SCENES.finale[0] + 36;

/** Phone centre y that puts screen point `py` at frame height `target` for a zoom `z`. */
function focusY(L: Layout, z: number, py: number, target: number) {
  const g = phoneGeom(L.phone.w);
  return target - (-g.h / 2 + g.bezel + g.bar + py * g.k) * z;
}

export function phonePose(f: number, L: Layout): Pose {
  const base = L.phone.y;
  const mid = (L.titleY + L.subBottom) / 2 + (L.format === '9x16' ? -20 : 0);
  // [frame, zoom, centre y] — push-ins frame the part of the screen the voice talks about.
  const Z: [number, number, number][] = [
    [PHONE_FROM, 0.9, base + 50],
    [PHONE_FROM + 30, 1, base],
    // Up a little so the tap on «Empezar» stays clear of the subtitles.
    [c('reveal.tap') - 20, 1, base - 150 * L.k],
    [c('reveal.tap') + 14, 1, base - 150 * L.k],
    [c('reveal.hl1') + 16, 1, base],
    [c('evo.scroll'), 1, base],
    [c('evo.scroll') + 24, 1.3, focusY(L, 1.3, 449, mid)],
    [c('evo.imc'), 1.3, focusY(L, 1.3, 449, mid)],
    [c('evo.imc') + 20, 1, base],
    [c('evo.back'), 1, base],
    [c('evo.back') + 20, 1.2, focusY(L, 1.2, 452, mid)],
    [c('evo.list') - 4, 1.2, focusY(L, 1.2, 452, mid)],
    [c('evo.list') + 16, 1, base],
    [SCENES.training[0] - 4, 1, base],
    [SCENES.training[0] + 14, 0.94, base + 24],
    [c('train.hist'), 0.94, base + 24],
    [c('train.hist') + 18, 1, base],
    [c('train.ses'), 1, base],
    [c('train.ses') + 22, 1.22, focusY(L, 1.22, 492, mid)],
    [c('train.title') - 6, 1.22, focusY(L, 1.22, 492, mid)],
    [c('train.title') + 16, 1, base],
    [SCENES.habits[0], 1, base],
    [SCENES.habits[0] + 16, 0.9, base + 70],
    [c('hab.agua') - 6, 0.9, base + 70],
    [c('hab.agua') + 14, 1, base],
    [c('hab.aguaTap') - 8, 1, base],
    [c('hab.aguaTap') + 10, 1.1, focusY(L, 1.1, 470, mid)],
    [c('hab.hito') - 4, 1.1, focusY(L, 1.1, 470, mid)],
    [c('hab.hito') + 14, 1, base],
    [c('hab.racha'), 1, base],
    [c('hab.racha') + 18, 1.12, focusY(L, 1.12, 380, mid)],
    [c('hab.cal') - 2, 1.12, focusY(L, 1.12, 380, mid)],
    [c('hab.cal') + 18, 1.04, focusY(L, 1.04, 470, mid)],
    [c('hab.title') + 10, 1, base],
    // The colour sheet: up so its rows stay clear of the subtitles.
    [c('sty.accentTap') - 2, 1, base],
    [c('sty.sheet') + 8, 1, base - 170 * L.k],
    [cues('sty.accents')[0]!, 1, base - 170 * L.k],
    [cues('sty.accents')[0]! + 16, 1, base],
    [SCENES.privacy[0], 1, base],
    [SCENES.privacy[0] + 40, 0.86, base + 30],
    [SCENES.finale[0], 0.86, base + 30],
    [SCENES.finale[0] + 30, 0.62, base - 20],
  ];
  // Cues move with the voice: keep the keyframes strictly in order.
  for (let i = 1; i < Z.length; i++) if (Z[i]![0] <= Z[i - 1]![0]) Z[i] = [Z[i - 1]![0] + 1, Z[i]![1], Z[i]![2]];
  const z = keys(f, Z.map((k) => [k[0], k[1]]), easeInOut);
  const y = keys(f, Z.map((k) => [k[0], k[2]]), easeInOut);
  const enter = prog(f, PHONE_FROM, PHONE_FROM + 44, easeOut);
  const t = f / 30;
  return {
    x: L.phone.x,
    y,
    w: L.phone.w,
    scale: z,
    rx: (1 - enter) * 12 + Math.cos(t * 0.6) * 1.2,
    ry: (1 - enter) * -16 + Math.sin(t * 0.45) * 2.2,
    rz: 0,
    opacity: 1 - prog(f, SCENES.finale[0] + 6, SCENES.finale[0] + 30, easeInOut),
  };
}

/** Frame position of a screen point (pt) on the phone at frame f. */
export function onScreen(f: number, L: Layout, px: number, py: number) {
  const p = phonePose(f, L);
  return ptToFrame(p, px, py);
}

/** Frame position of a point relative to the phone body (0..1 across width and height). */
export function onBody(f: number, L: Layout, ax: number, ay: number) {
  const p = phonePose(f, L);
  const g = phoneGeom(p.w);
  return { x: p.x + (ax - 0.5) * p.w * p.scale, y: p.y + (ay - 0.5) * g.h * p.scale };
}

/* ── Screens ────────────────────────────────────────────────────────────── */
function Seq({ name, from, n, f }: { name: string; from: number; n: number; f: number }) {
  const i = Math.max(0, Math.min(n - 1, f - from));
  return <Img src={seqUrl(name, i)} style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H }} />;
}

const LINE = chartline as [number, number][];
const CHART_X0 = LINE[0]![0];
const CHART_X1 = 345;

function chartY(x: number) {
  for (let i = 1; i < LINE.length; i++) {
    const [x1, y1] = LINE[i]!;
    const [x0, y0] = LINE[i - 1]!;
    if (x <= x1) return mix(y0, y1, (x - x0) / Math.max(1e-6, x1 - x0));
  }
  return LINE[LINE.length - 1]![1];
}

/** The weight chart drawing itself, as the app animates it on mount (1 s, strong ease-out). */
function ChartDraw({ f, at }: { f: number; at: number }) {
  const p = prog(f, at, at + 30, easeOut);
  const x = mix(CHART_X0 - 4, CHART_X1, p);
  const headX = Math.min(x, LINE[LINE.length - 1]![0]);
  const head = { x: headX, y: chartY(headX) };
  const headA = (1 - prog(f, at + 30, at + 44, easeInOut)) * prog(f, at, at + 3);
  return (
    <>
      <Shot src="progreso-grafica-base" />
      <Img src={shotUrl('progreso-grafica')} style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, clipPath: `inset(270px ${SCREEN_W - x}px ${SCREEN_H - 560}px 140px)` }} />
      <div style={{ position: 'absolute', left: head.x - 16, top: head.y - 16, width: 32, height: 32, borderRadius: 16, background: `radial-gradient(closest-side, rgba(255,255,255,0.95), ${V.lav}88 45%, transparent 75%)`, opacity: headA }} />
    </>
  );
}

function segments(): Seg[] {
  const S = (src: string) => () => <Shot src={src} />;
  const a = cues('sty.accents');
  const l = cues('sty.light');
  return [
    { from: PHONE_FROM, render: S('bienvenida'), trans: { kind: 'cut' } },
    { from: c('reveal.tap') + 4, render: S('inicio'), trans: { kind: 'lift', dur: 16 } },
    // Evolution
    { from: c('evo.tab') + 5, render: S('progreso'), trans: { kind: 'lift', dur: 16 } },
    {
      from: c('evo.scroll'),
      render: (f) => <Scrolled full="progreso-full" scroll={keys(f, [[c('evo.scroll'), 0], [c('evo.scroll') + 20, 330]], easeInOut)} top="progreso" topScrolled="progreso-grafica" tab="progreso" />,
      trans: { kind: 'cut' },
    },
    { from: c('evo.draw'), render: (f) => <ChartDraw f={f} at={c('evo.draw')} />, trans: { kind: 'cut' } },
    { from: c('evo.imc'), render: S('imc'), trans: { kind: 'slideL', dur: 12 } },
    { from: c('evo.cal'), render: S('calorias'), trans: { kind: 'slideL', dur: 12 } },
    { from: c('evo.back'), render: S('progreso-grafica'), trans: { kind: 'slideR', dur: 12 } },
    { from: c('evo.tip') + 3, render: S('progreso-tip'), trans: { kind: 'fade', dur: 8 } },
    { from: c('evo.list'), render: S('registros'), trans: { kind: 'slideL', dur: 12 } },
    // Training
    { from: c('train.hist'), render: S('historial'), trans: { kind: 'fade', dur: 12 } },
    { from: c('train.rut'), render: S('rutinas'), trans: { kind: 'slideL', dur: 12 } },
    { from: c('train.marcas'), render: S('stats-marcas'), trans: { kind: 'slideL', dur: 12 } },
    { from: c('train.ses'), render: S('sesion'), trans: { kind: 'lift', dur: 14 } },
    { from: c('train.check'), render: (f) => <Seq name="serie" from={c('train.check')} n={16} f={f} />, trans: { kind: 'cut' } },
    { from: c('train.check2') + 2, render: S('sesion-hecha2'), trans: { kind: 'fade', dur: 6 } },
    // Habits
    { from: SCENES.habits[0], render: S('inicio'), trans: { kind: 'lift', dur: 14 } },
    { from: c('hab.agua'), render: S('agua'), trans: { kind: 'lift', dur: 14 } },
    { from: c('hab.aguaTap'), render: (f) => <Seq name="agua" from={c('hab.aguaTap')} n={40} f={f} />, trans: { kind: 'cut' } },
    { from: c('hab.pasos'), render: S('pasos'), trans: { kind: 'slideL', dur: 12 } },
    { from: c('hab.pasosTap'), render: (f) => <Seq name="pasos" from={c('hab.pasosTap')} n={40} f={f} />, trans: { kind: 'cut' } },
    { from: c('hab.hito'), render: S('hito-celebracion'), trans: { kind: 'fade', dur: 12 } },
    { from: c('hab.racha'), render: S('inicio-racha'), trans: { kind: 'lift', dur: 14 } },
    { from: c('hab.cal'), render: S('calendario'), trans: { kind: 'page', dur: 18 } },
    // Style
    { from: SCENES.style[0], render: S('inicio'), trans: { kind: 'lift', dur: 14 } },
    { from: c('sty.sheet'), render: S('acento-selector'), trans: { kind: 'sheet', dur: 16, split: 330 } },
    { from: a[0]!, render: S('inicio-cian'), trans: { kind: 'fade', dur: 10 } },
    { from: a[1]!, render: S('inicio-fucsia'), trans: { kind: 'fade', dur: 6 } },
    { from: a[2]!, render: S('inicio-naranja'), trans: { kind: 'fade', dur: 6 } },
    { from: a[3]!, render: S('inicio-volt'), trans: { kind: 'fade', dur: 6 } },
    { from: a[4]!, render: S('inicio-rojo'), trans: { kind: 'fade', dur: 6 } },
    { from: c('sty.violet'), render: S('inicio'), trans: { kind: 'fade', dur: 6 } },
    { from: c('sty.theme') + 2, render: S('inicio-claro'), trans: { kind: 'circle', dur: 22, x: 301, y: 30 } },
    { from: l[0]!, render: S('inicio-claro-cian'), trans: { kind: 'fade', dur: 6 } },
    { from: l[1]!, render: S('inicio-claro-fucsia'), trans: { kind: 'fade', dur: 6 } },
    { from: l[2]!, render: S('inicio-claro'), trans: { kind: 'fade', dur: 6 } },
    { from: c('sty.dark') + 2, render: S('inicio'), trans: { kind: 'circle', dur: 20, x: 301, y: 30 } },
  ];
}

/** Records of the «Registros» tab, lit one by one. */
const ROWS = [364, 430, 496, 562, 628];

function InScreen({ f }: { f: number }) {
  const t = c('reveal.title');
  const light = isLight(f);
  return (
    <>
      <Tap x={195} y={703} at={c('reveal.tap')} />
      <Spotlight x={14} y={202} w={362} h={90} opacity={Math.max(win(f, c('reveal.hl1'), c('reveal.hl1') + 34), win(f, t, t + 18, 6, 6))} />
      <Spotlight x={14} y={354} w={362} h={208} opacity={Math.max(win(f, c('reveal.hl2'), c('reveal.hl2') + 40), win(f, t + 16, t + 34, 6, 6))} />
      <Spotlight x={14} y={570} w={356} h={124} opacity={win(f, t + 32, t + 80, 6, 12)} />
      <Tap x={122} y={756} at={c('evo.tab')} />
      <Tap x={233} y={411} at={c('evo.tip')} />
      {ROWS.map((y, i) => (
        <Spotlight key={y} x={20} y={y} w={350} h={60} r={16} opacity={win(f, c('evo.list') + 14 + i * 9, c('evo.list') + 30 + i * 9, 4, 8)} />
      ))}
      <Tap x={334} y={439} at={c('train.check')} />
      <Glint x={334} y={439} at={c('train.check') + 3} size={40} />
      <Tap x={334} y={491} at={c('train.check2')} />
      <Tap x={103} y={446} at={c('hab.agua') - 4} />
      <Tap x={259} y={670} at={c('hab.aguaTap')} />
      <Tap x={181} y={230} at={c('hab.pasos') - 2} />
      <Tap x={242} y={652} at={c('hab.pasosTap')} />
      <Glint x={194} y={248} at={c('hab.hito') + 8} size={46} />
      <Spotlight x={262} y={370} w={44} h={44} r={22} color="#ffb347" opacity={win(f, c('hab.flame') - 2, c('hab.flame') + 26, 4, 10)} />
      <Spotlight x={26} y={645} w={340} h={52} r={14} opacity={win(f, c('hab.legend'), c('hab.legend') + 44, 6, 12)} />
      <Tap x={251} y={30} at={c('sty.accentTap')} />
      <Tap x={195} y={685} at={c('sty.pick')} />
      <Tap x={301} y={30} at={c('sty.theme')} />
      <Tap x={301} y={30} at={c('sty.dark')} light={light} />
    </>
  );
}

function win(f: number, a: number, b: number, fi = 8, fo = 10) {
  return prog(f, a, a + fi) * (1 - prog(f, b - fo, b, easeInOut));
}

/** The light that becomes the phone's edge, as the phone appears. */
function EdgeTrace({ f, w, h }: { f: number; w: number; h: number }) {
  const p = prog(f, PHONE_FROM - 4, PHONE_FROM + 26, easeInOut);
  const fade = 1 - prog(f, PHONE_FROM + 24, PHONE_FROM + 44, easeInOut);
  if (fade <= 0) return null;
  const r = w * 0.155;
  const d = `M ${r} ${h} L ${w - r} ${h} A ${r} ${r} 0 0 0 ${w} ${h - r} L ${w} ${r} A ${r} ${r} 0 0 0 ${w - r} 0 L ${r} 0 A ${r} ${r} 0 0 0 0 ${r} L 0 ${h - r} A ${r} ${r} 0 0 0 ${r} ${h} Z`;
  const len = 2 * (w + h) - 8 * r + 2 * Math.PI * r;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: fade }}>
      <path d={d} fill="none" stroke={V.acc} strokeOpacity={0.5} strokeWidth={14} strokeDasharray={`${len * p} ${len}`} style={{ filter: 'blur(8px)' }} />
      <path d={d} fill="none" stroke={V.lav} strokeWidth={4} strokeDasharray={`${len * p} ${len}`} strokeLinecap="round" />
    </svg>
  );
}

export function PhoneTrack() {
  const f = useCurrentFrame();
  const L = useLayout();
  const segs = useMemo(() => segments(), []);
  if (f < PHONE_FROM - 4 || f > PHONE_TO) return null;
  const pose = phonePose(f, L);
  const g = phoneGeom(pose.w);
  const body = prog(f, PHONE_FROM + 8, PHONE_FROM + 26, easeOut);
  const screen = prog(f, PHONE_FROM + 18, PHONE_FROM + 34, easeOut);
  // The screen dims while the training card comes in front of it.
  const dim = win(f, SCENES.training[0] - 2, c('train.hist') + 6, 10, 8) * 0.55;
  return (
    <Phone {...pose} light={isLight(f)} glow={accentAt(f)} bodyOpacity={body} frameOverlay={<EdgeTrace f={f} w={pose.w} h={g.h} />}>
      <div style={{ position: 'absolute', inset: 0, opacity: screen }}>
        <ScreenTrack segs={segs} />
        <InScreen f={f} />
        <div style={{ position: 'absolute', inset: 0, background: '#07060c', opacity: dim }} />
      </div>
    </Phone>
  );
}

/* ── Rumbi, the whole way through ───────────────────────────────────────── */
interface RPos {
  x: number;
  y: number;
  s: number;
}
interface Move {
  at: number;
  dur: number;
  to: (f: number) => RPos;
  hop?: number;
}

function rumbiMoves(L: Layout): Move[] {
  const H = hookGeo(L);
  const F = finaleGeo(L);
  const k = L.k;
  const side = (ay: number, s = 150 * k) => (f: number): RPos => {
    const p = onBody(f, L, 1, ay);
    return { x: Math.min(p.x + s * 0.2, L.W - s * 0.62), y: p.y, s };
  };
  const left = (ay: number, s = 150 * k) => (f: number): RPos => {
    const p = onBody(f, L, 0, ay);
    return { x: Math.max(p.x - s * 0.2, s * 0.62), y: p.y, s };
  };
  const top = (ax: number, s = 140 * k) => (f: number): RPos => {
    const p = onBody(f, L, ax, 0);
    return { x: p.x, y: p.y - s * 0.4, s };
  };
  const fixed = (x: number, y: number, s: number) => (): RPos => ({ x, y, s });
  const phoneTop = L.phone.y - (phoneGeom(L.phone.w).h / 2) * 0.9 + 70;
  return [
    { at: 0, dur: 1, to: fixed(H.rumbiBig.x, H.rumbiBig.y, H.rumbiBig.s * k) },
    { at: 64, dur: 80, to: fixed(H.rumbiRest.x, H.rumbiRest.y, H.rumbiRest.s * k) },
    // Onto the phone's edge as it appears, along the top, then resting on the right edge.
    { at: SCENES.reveal[0] - 6, dur: 26, to: top(0.14), hop: 80 * k },
    { at: SCENES.reveal[0] + 24, dur: 26, to: top(0.86) },
    { at: SCENES.reveal[0] + 52, dur: 22, to: side(0.36), hop: 40 * k },
    { at: SCENES.evolution[0], dur: 20, to: side(0.62) },
    // Training: steps aside to the left to watch the card arrive.
    { at: SCENES.training[0] - 10, dur: 26, to: left(0.4), hop: 70 * k },
    { at: c('train.check'), dur: 20, to: left(0.4), hop: 90 * k },
    // Habits: above the phone where water and steps appear, then the streak's day.
    { at: SCENES.habits[0] - 10, dur: 24, to: fixed(L.W * 0.22, phoneTop - 10, 150 * k), hop: 60 * k },
    { at: c('hab.agua') - 4, dur: 22, to: side(0.5), hop: 50 * k },
    {
      at: c('hab.racha') + 8,
      dur: 18,
      to: (f) => {
        const p = onScreen(f, L, 284, 392);
        return { x: p.x, y: p.y - 40 * k, s: 86 * k };
      },
      hop: 140 * k,
    },
    { at: c('hab.cal') - 2, dur: 20, to: side(0.5), hop: 90 * k },
    { at: SCENES.style[0], dur: 20, to: side(0.42) },
    { at: SCENES.privacy[0] + 4, dur: 30, to: left(0.5, 140 * k), hop: 50 * k },
    // Finale: next to RUMBO.
    { at: c('fin.word') - 16, dur: 24, to: fixed(F.rumbi.x, F.rumbi.y, F.rumbi.s * k), hop: 110 * k },
  ];
}

function rumbiAt(f: number, moves: Move[]): RPos {
  let pos = moves[0]!.to(f);
  for (const m of moves.slice(1)) {
    if (f < m.at) break;
    const p = prog(f, m.at, m.at + m.dur, easeInOut);
    const to = m.to(f);
    pos = { x: mix(pos.x, to.x, p), y: mix(pos.y, to.y, p) - (m.hop ?? 0) * Math.sin(Math.PI * p), s: mix(pos.s, to.s, p) };
  }
  return pos;
}

function rumbiEvents(L: Layout): RumbiEvent[] {
  const H = hookGeo(L);
  const len = getLength(H.path);
  const ev: RumbiEvent[] = [
    { at: 14, look: [0, 0] },
    { at: 24, expr: 'happy' },
    { at: c('hook.spark') - 4, look: [-0.7, 0.8] },
    { at: c('hook.dot'), tap: true },
  ];
  // Eyes follow the dot along the path.
  const p0 = c('hook.path');
  const p1 = c('hook.pathEnd');
  for (let f = p0; f < p1; f += 10) {
    const q = getPointAtLength(H.path, len * clamp((f - p0) / (p1 - p0))) ?? H.dot;
    ev.push({ at: f, look: [clamp((q.x - H.rumbiRest.x) / 400, -1, 1), clamp((q.y - H.rumbiRest.y) / 400, -1, 1)] });
  }
  ev.push(
    { at: c('hook.title'), look: [0, -0.6] },
    { at: c('hook.title') + 30, look: [0, 0] },
    { at: SCENES.reveal[0], expr: 'encouraging' },
    { at: c('reveal.hl1'), look: [-1, 0.1] },
    { at: c('reveal.title'), expr: 'happy' },
    { at: c('reveal.title') + 6, look: [-0.4, -0.8] },
    { at: SCENES.evolution[0], expr: 'neutral' },
    { at: c('evo.draw'), expr: 'thinking' },
    { at: c('evo.draw') + 2, look: [-1, -0.2] },
    { at: c('evo.imc'), tap: true },
    { at: c('evo.cal'), look: [-1, 0.2] },
    { at: c('evo.tip'), expr: 'happy' },
    { at: c('evo.title'), look: [-0.5, -0.9] },
    { at: SCENES.training[0], look: [1, 0] },
    { at: c('train.hist'), look: [0.8, 0.3] },
    { at: c('train.ses'), expr: 'encouraging' },
    { at: c('train.check'), expr: 'proud' },
    { at: c('train.check') + 2, tap: true },
    { at: c('train.check2'), tap: true },
    { at: c('train.title'), expr: 'happy' },
    { at: SCENES.habits[0], look: [1, 0] },
    { at: c('hab.cards'), look: [0.6, 1] },
    { at: c('hab.agua'), look: [-1, 0.3] },
    { at: c('hab.aguaTap') + 6, tap: true },
    { at: c('hab.hito'), expr: 'proud' },
    { at: c('hab.racha'), press: true },
    { at: c('hab.flame'), tap: true },
    { at: c('hab.flame') + 2, expr: 'happy' },
    { at: c('hab.legend'), expr: 'encouraging' },
    { at: c('hab.title'), look: [0, 0] },
    { at: SCENES.style[0], expr: 'happy' },
    { at: c('sty.accentTap') - 6, look: [-0.6, -1] },
    { at: cues('sty.accents')[0]!, tap: true },
    { at: cues('sty.accents')[3]!, tap: true },
    { at: c('sty.theme'), expr: 'surprised' },
    { at: c('sty.theme') + 18, expr: 'happy' },
    { at: SCENES.privacy[0], expr: 'neutral' },
    { at: SCENES.privacy[0] + 20, look: [0.7, -0.4] },
    { at: c('priv.halo'), expr: 'happy' },
    { at: c('priv.title'), look: [0.3, -1] },
    { at: SCENES.finale[0], expr: 'encouraging' },
    { at: c('fin.word'), expr: 'proud' },
    { at: c('fin.word') + 10, tap: true },
    { at: c('fin.slogan'), look: [0, 0] },
    { at: c('fin.cta'), expr: 'happy' },
    { at: c('fin.cta') + 4, tap: true },
  );
  return ev.sort((a, b) => a.at - b.at);
}

export function RumbiActor() {
  const f = useCurrentFrame();
  const L = useLayout();
  const moves = useMemo(() => rumbiMoves(L), [L]);
  const events = useMemo(() => rumbiEvents(L), [L]);
  const pos = rumbiAt(f, moves);
  const appear = prog(f, 0, 10, easeOut);
  const lean = keys(f, [[c('hook.spark') - 6, 0], [c('hook.spark') + 4, -9], [c('hook.path') + 30, -4], [c('hook.title'), 0]], easeInOut);
  const size = Math.round(pos.s);
  return (
    <div style={{ position: 'absolute', left: pos.x - size / 2, top: pos.y - size / 2, width: size, height: size, opacity: appear, transform: `rotate(${lean}deg)` }}>
      <Rumbi size={size} events={events} seed={7} accent={accentAt(f)} light={isLight(f)} />
    </div>
  );
}
