import type { ReactNode } from 'react';
import { staticFile, useCurrentFrame } from 'remotion';
import { phonePose } from './film';
import { easeInOut, easeOut, hexA, keys, mix, phoneGeom, prog } from './kit';
import { useLayout, type Layout } from './layout';
import { V } from './theme';
import { BEAT_F, cue as c, cues, FRAMES, inPulse, SCENES } from './timing';

/*
 * The cinematic layer: a camera over the whole picture (slams, dives, whips,
 * punches, shake, handheld drift), and the light on top of it (flashes,
 * anamorphic flares, shockwaves, light leaks, letterbox, grade). Every beat is
 * a cue shared with the score, so picture and sound hit together.
 */

/** Screen changes get a small push, like a cut on the beat. */
const SCREEN_CHANGES = [
  'reveal.tap', 'evo.tab', 'evo.imc', 'evo.cal', 'evo.back', 'evo.list', 'train.hist', 'train.rut', 'train.marcas', 'train.ses',
  'hab.agua', 'hab.pasos', 'hab.racha', 'hab.cal', 'sty.sheet', 'sty.dark',
];
const IMPACTS_BIG = ['fx.drop1', 'fx.flash', 'fx.drop2'];
const IMPACTS = ['fx.surface', 'fx.punchOut'];

function noise(f: number, seed: number) {
  return Math.sin(f * 1.7 + seed) * 0.6 + Math.sin(f * 3.1 + seed * 2.3) * 0.3 + Math.sin(f * 7.3 + seed * 0.7) * 0.1;
}

export interface Cam {
  s: number;
  x: number;
  y: number;
  r: number;
  /** Focus of the zoom, in frame coordinates. */
  ox: number;
  oy: number;
  blur: number;
  whipBlur: number;
}

export function cameraAt(f: number, L: Layout): Cam {
  const cx = L.W / 2;
  const cy = L.H / 2;
  let s = 1;
  let x = 0;
  let y = 0;
  let r = 0;
  let blur = 0;
  let whipBlur = 0;
  let ox = cx;
  let oy = cy;

  // Handheld drift: barely there, always alive.
  x += noise(f / 40, 1) * 5;
  y += noise(f / 46, 4) * 5;
  r += noise(f / 60, 9) * 0.25;

  // Hook: a slow push towards Rumbi and the path.
  if (f < SCENES.reveal[0]) s *= mix(1.06, 1, prog(f, 0, SCENES.reveal[0], easeInOut));

  // Drop: the phone slams in from close up.
  const d1 = c('fx.drop1');
  if (f >= d1 - 2 && f < d1 + 26) {
    const p = prog(f, d1, d1 + 22, easeOut);
    s *= mix(1.75, 1, p);
    blur += (1 - p) * 10;
  }

  // Dive into the screen, surface in Progreso.
  const dive = c('fx.dive');
  const surf = c('fx.surface');
  const pose = phonePose(Math.min(f, surf - 1), L);
  const g = phoneGeom(pose.w);
  if (f >= dive && f < surf) {
    const p = prog(f, dive, surf, Easing3);
    ox = pose.x;
    oy = pose.y + g.bar * pose.scale * 0.5;
    s *= mix(1, 3.6, p);
    blur += p * 12;
  }
  if (f >= surf && f < surf + 24) {
    const p = prog(f, surf, surf + 22, easeOut);
    s *= mix(2.2, 1, p);
    blur += (1 - p) * 9;
  }

  // Whip pan out and back in.
  const w = c('fx.whip');
  if (f >= w && f < w + 6) {
    const p = prog(f, w, w + 6, easeIn3);
    x -= p * L.W * 1.4;
    whipBlur = p * 40;
  } else if (f >= w + 6 && f < w + 18) {
    const p = prog(f, w + 6, w + 16, easeOut);
    x += (1 - p) * L.W * 1.4;
    whipBlur = (1 - p) * 40;
  }

  // Punch out at the habits scene.
  const po = c('fx.punchOut');
  if (f >= po - 6 && f < po + 22) {
    s *= keys(f, [[po - 6, 1], [po, 0.8], [po + 20, 1]], easeInOut);
    blur += win3(f, po - 6, po + 10) * 4;
  }

  // Flip: a lift of the camera while the phone turns.
  const fl = c('fx.flip');
  if (f >= fl - 4 && f < fl + 30) s *= keys(f, [[fl - 4, 1], [fl + 8, 1.12], [fl + 28, 1]], easeInOut);

  // Privacy: a slow, quiet dolly.
  if (f >= SCENES.privacy[0] && f < SCENES.finale[0]) s *= mix(1, 1.1, prog(f, SCENES.privacy[0], c('fx.dive2'), easeInOut));

  // Into the light.
  const d2 = c('fx.dive2');
  const flash = c('fx.flash');
  if (f >= d2 && f < flash) {
    const p = prog(f, d2, flash, Easing3);
    const pp = phonePose(f, L);
    ox = pp.x;
    oy = pp.y;
    s *= mix(1.1, 4.2, p);
    blur += p * 14;
  }

  // Finale: a slow push, and a slam when the logo lands.
  if (f >= SCENES.finale[0]) s *= mix(1.08, 1, prog(f, SCENES.finale[0], SCENES.finale[0] + 60, easeOut)) * mix(1, 1.04, prog(f, c('fx.drop2'), FRAMES, easeInOut));
  const d2b = c('fx.drop2');
  if (f >= d2b && f < d2b + 20) s *= mix(1.14, 1, prog(f, d2b, d2b + 18, easeOut));

  // Punches on the beats the story hangs on, and a small push on every screen change.
  for (const at of cues('fx.punches')) {
    if (f >= at && f < at + 16) s *= 1 + 0.06 * (1 - prog(f, at, at + 14, easeOut)) * prog(f, at, at + 2);
  }
  for (const k of SCREEN_CHANGES) {
    const at = c(k);
    if (f >= at && f < at + 14) s *= 1 + 0.025 * (1 - prog(f, at, at + 12, easeOut)) * prog(f, at, at + 2);
  }

  // The camera pulses with the kick where the music drives.
  if (inPulse(f)) {
    const phase = (f % BEAT_F) / BEAT_F;
    const down = Math.floor(f / BEAT_F) % 4 === 0;
    s *= 1 + (down ? 0.028 : 0.013) * Math.exp(-phase * 6);
  }
  // A punch on every cut of the beat montages.
  for (const k of ['evo.burst', 'train.burst', 'hab.burst']) {
    for (let i = 0; i < 4; i++) {
      const at = Math.round(c(k) + i * BEAT_F);
      if (f >= at && f < at + 10) s *= 1 + 0.05 * (1 - prog(f, at, at + 9, easeOut));
    }
  }
  // The build into the finale: the camera creeps in and starts to shake.
  const b0 = c('fx.build');
  const b1 = c('fx.dive2');
  if (f >= b0 && f < b1) {
    const p = prog(f, b0, b1, (q) => q * q);
    s *= 1 + 0.12 * p;
    x += noise(f * 2.5, 21) * 7 * p;
    y += noise(f * 2.5, 23) * 7 * p;
  }

  // Shake on impacts.
  for (const k of [...IMPACTS_BIG, ...IMPACTS]) {
    const at = c(k);
    if (f >= at && f < at + 18) {
      const a = (1 - (f - at) / 18) ** 2 * (IMPACTS_BIG.includes(k) ? 16 : 9);
      x += noise(f * 3, 3) * a;
      y += noise(f * 3, 7) * a;
      r += noise(f * 3, 11) * a * 0.04;
    }
  }
  for (const at of cues('fx.punches')) {
    if (f >= at && f < at + 10) {
      const a = (1 - (f - at) / 10) ** 2 * 6;
      x += noise(f * 3, 5) * a;
      y += noise(f * 3, 13) * a;
    }
  }

  return { s, x, y, r, ox, oy, blur, whipBlur };
}

const Easing3 = (t: number) => t * t * t;
const easeIn3 = (t: number) => t * t * t;
function win3(f: number, a: number, b: number) {
  const m = (a + b) / 2;
  return f < m ? prog(f, a, m) : 1 - prog(f, m, b);
}

/** Everything that moves with the camera. */
export function Camera({ children }: { children: ReactNode }) {
  const f = useCurrentFrame();
  const L = useLayout();
  const cam = cameraAt(f, L);
  const filters: string[] = [];
  if (cam.blur > 0.3) filters.push(`blur(${cam.blur.toFixed(2)}px)`);
  if (cam.whipBlur > 0.5) filters.push(`url(#whip-${Math.round(cam.whipBlur)})`);
  return (
    <>
      {cam.whipBlur > 0.5 && (
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <filter id={`whip-${Math.round(cam.whipBlur)}`} x="-20%" y="0" width="140%" height="100%">
            <feGaussianBlur stdDeviation={`${Math.round(cam.whipBlur)} 0`} />
          </filter>
        </svg>
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: `${cam.ox}px ${cam.oy}px`,
          transform: `translate(${cam.x}px, ${cam.y}px) rotate(${cam.r}deg) scale(${cam.s})`,
          filter: filters.length ? filters.join(' ') : undefined,
        }}
      >
        {children}
      </div>
    </>
  );
}

/* ── Light ──────────────────────────────────────────────────────────────── */
function Flash({ at, peak = 0.9, len = 14, color = V.lav }: { at: number; peak?: number; len?: number; color?: string }) {
  const f = useCurrentFrame();
  if (f < at - 3 || f > at + len) return null;
  const a = (f < at ? prog(f, at - 3, at) : 1 - prog(f, at, at + len, easeOut)) * peak;
  return <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(70% 55% at 50% 45%, rgba(255,255,255,${a}), ${hexA(color, a * 0.8)} 45%, ${hexA(V.acc, a * 0.5)} 100%)`, mixBlendMode: 'screen' }} />;
}

function Flare({ at, y, len = 26, width = 1.0 }: { at: number; y: number; len?: number; width?: number }) {
  const f = useCurrentFrame();
  const L = useLayout();
  if (f < at || f > at + len) return null;
  const p = prog(f, at, at + len, easeOut);
  const a = (1 - p) * prog(f, at, at + 2);
  const w = L.W * (0.6 + 1.2 * p) * width;
  return (
    <div style={{ position: 'absolute', left: L.W / 2 - w / 2, top: y - 40, width: w, height: 80, opacity: a, mixBlendMode: 'screen' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 37, height: 6, borderRadius: 6, background: 'linear-gradient(90deg, transparent, rgba(201,184,255,0.9) 30%, #fff 50%, rgba(201,184,255,0.9) 70%, transparent)', filter: 'blur(1.5px)' }} />
      <div style={{ position: 'absolute', left: '15%', right: '15%', top: 20, height: 40, borderRadius: 40, background: `radial-gradient(closest-side, ${hexA(V.acc, 0.55)}, transparent)`, filter: 'blur(8px)' }} />
      <div style={{ position: 'absolute', left: '44%', width: '12%', top: 0, height: 80, borderRadius: 80, background: 'radial-gradient(closest-side, rgba(255,255,255,0.9), transparent)' }} />
    </div>
  );
}

function Shockwave({ at, x, y, len = 26, size = 900 }: { at: number; x: number; y: number; len?: number; size?: number }) {
  const f = useCurrentFrame();
  if (f < at || f > at + len) return null;
  const p = prog(f, at, at + len, easeOut);
  const r = size * (0.1 + 0.9 * p);
  return <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', border: `${3 + 8 * (1 - p)}px solid ${hexA(V.lav, 0.7 * (1 - p))}`, boxShadow: `0 0 40px ${hexA(V.acc, 0.6 * (1 - p))}, inset 0 0 40px ${hexA(V.acc, 0.4 * (1 - p))}` }} />;
}

/** Soft coloured light drifting across the frame; stronger around transitions. */
function LightLeaks() {
  const f = useCurrentFrame();
  const L = useLayout();
  const t = f / 30;
  const beats = ['fx.drop1', 'fx.surface', 'fx.whip', 'fx.punchOut', 'fx.flip', 'fx.flash', 'fx.drop2'].map(c);
  let boost = 0;
  for (const b of beats) boost = Math.max(boost, f >= b - 8 && f < b + 30 ? (f < b ? prog(f, b - 8, b) : 1 - prog(f, b, b + 30)) : 0);
  const calm = f >= SCENES.privacy[0] && f < SCENES.finale[0] ? 0.5 : 1;
  const a = (0.04 + 0.42 * boost) * calm;
  const x1 = L.W * (0.1 + 0.5 * ((Math.sin(t * 0.13) + 1) / 2));
  const x2 = L.W * (0.9 - 0.5 * ((Math.cos(t * 0.11) + 1) / 2));
  return (
    <>
      <div style={{ position: 'absolute', left: x1 - L.W * 0.7, top: -L.H * 0.25, width: L.W * 1.4, height: L.H * 0.7, borderRadius: '50%', background: `radial-gradient(closest-side, rgba(255,158,138,${a * 0.55}), rgba(255,120,170,${a * 0.25}) 50%, transparent 75%)`, mixBlendMode: 'screen' }} />
      <div style={{ position: 'absolute', left: x2 - L.W * 0.6, top: L.H * 0.55, width: L.W * 1.2, height: L.H * 0.7, borderRadius: '50%', background: `radial-gradient(closest-side, ${hexA(V.accHi, a * 0.6)}, ${hexA(V.acc, a * 0.25)} 50%, transparent 75%)`, mixBlendMode: 'screen' }} />
    </>
  );
}

/** The logo's speed lines, streaking across the frame on the fast cuts. */
const STREAKS = Array.from({ length: 6 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 33.1 + n * 7.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return { y: 0.18 + r(1) * 0.64, len: 0.35 + r(2) * 0.45, h: 10 + r(3) * 18, delay: Math.floor(r(4) * 4) };
});

function SpeedLines({ at }: { at: number }) {
  const f = useCurrentFrame();
  const L = useLayout();
  if (f < at - 2 || f > at + 16) return null;
  return (
    <>
      {STREAKS.map((st, i) => {
        const p = prog(f, at - 2 + st.delay, at + 10 + st.delay, (q) => q);
        if (p <= 0 || p >= 1) return null;
        const len = L.W * st.len;
        const x = -len + (L.W + 2 * len) * p;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - len / 2,
              top: L.H * st.y,
              width: len,
              height: st.h * L.k,
              borderRadius: 999,
              background: `linear-gradient(90deg, transparent, ${hexA(V.lav, 0.55)} 40%, #ffffff 92%, transparent)`,
              filter: 'blur(1px)',
              mixBlendMode: 'screen',
            }}
          />
        );
      })}
    </>
  );
}

/** Bars that frame the opening and the end card like a film. */
function Letterbox() {
  const f = useCurrentFrame();
  const L = useLayout();
  const full = L.format === '9x16' ? 150 : 70;
  const open = 1 - prog(f, c('fx.drop1') - 2, c('fx.drop1') + 12, easeOut);
  const close = prog(f, c('fin.word'), c('fin.word') + 30, easeInOut) * 0.7;
  const h = full * Math.max(open, close);
  if (h < 0.5) return null;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h, background: '#000' }} />
    </>
  );
}

/** Colour grade, vignette and film grain over everything. */
function Grade() {
  const f = useCurrentFrame();
  const light = f >= c('sty.theme') + 11 && f < c('sty.dark') + 10;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.4))', mixBlendMode: 'multiply' }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(2,1,6,${light ? 0.28 : 0.6}) 100%)` }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${staticFile('fx/grain.png')})`,
          backgroundPosition: `${(f * 137) % 256}px ${(f * 71) % 256}px`,
          opacity: light ? 0.05 : 0.07,
          mixBlendMode: light ? 'multiply' : 'screen',
        }}
      />
    </>
  );
}

/** Out-of-focus motes behind the phone; they drift with depth. */
const MOTES = Array.from({ length: 26 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: r(1), y: r(2), size: 6 + r(3) * 26, speed: 0.2 + r(4) * 0.8, a: 0.05 + r(5) * 0.14, hue: r(6) > 0.7 };
});

export function Motes() {
  const f = useCurrentFrame();
  const L = useLayout();
  const calm = f >= SCENES.privacy[0] && f < SCENES.finale[0] ? 0.6 : 1;
  return (
    <>
      {MOTES.map((m, i) => {
        const y = ((m.y * L.H - f * m.speed * 1.4) % L.H + L.H) % L.H;
        const x = m.x * L.W + Math.sin(f / 50 + i) * 20;
        return <div key={i} style={{ position: 'absolute', left: x - m.size / 2, top: y - m.size / 2, width: m.size, height: m.size, borderRadius: '50%', background: `radial-gradient(closest-side, ${m.hue ? 'rgba(255,190,170,0.9)' : 'rgba(201,184,255,0.9)'}, transparent)`, opacity: m.a * calm }} />;
      })}
    </>
  );
}

/** Volumetric rays behind the phone. */
export function Rays() {
  const f = useCurrentFrame();
  const L = useLayout();
  if (f < SCENES.reveal[0] - 10 || f > SCENES.finale[0] + 10) return null;
  const pose = phonePose(f, L);
  const t = f / 30;
  const calm = f >= SCENES.privacy[0] ? 0.6 : 1;
  const a = prog(f, SCENES.reveal[0] - 10, SCENES.reveal[0] + 20) * (1 - prog(f, SCENES.finale[0] - 6, SCENES.finale[0] + 10)) * calm;
  const size = L.H * 1.3;
  return (
    <div
      style={{
        position: 'absolute',
        left: pose.x - size / 2,
        top: pose.y - size / 2,
        width: size,
        height: size,
        opacity: a,
        background: `conic-gradient(from ${t * 6}deg, transparent 0deg, ${hexA(V.lav, 0.12)} 8deg, transparent 18deg, transparent 40deg, ${hexA(V.accHi, 0.1)} 50deg, transparent 62deg, transparent 100deg, ${hexA(V.lav, 0.1)} 110deg, transparent 122deg, transparent 170deg, ${hexA(V.accHi, 0.12)} 182deg, transparent 196deg, transparent 240deg, ${hexA(V.lav, 0.1)} 252deg, transparent 266deg, transparent 300deg, ${hexA(V.accHi, 0.1)} 312deg, transparent 326deg)`,
        maskImage: 'radial-gradient(closest-side, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage: 'radial-gradient(closest-side, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 100%)',
        filter: 'blur(6px)',
      }}
    />
  );
}

/** The light on top of the camera. */
export function Optics() {
  const L = useLayout();
  const f = useCurrentFrame();
  const mid = L.H * 0.46;
  const pose = phonePose(Math.max(f, SCENES.reveal[0]), L);
  return (
    <>
      <LightLeaks />
      <Flash at={c('fx.drop1')} peak={0.85} len={16} />
      <Flare at={c('fx.drop1')} y={mid} len={30} width={1.2} />
      <Shockwave at={c('fx.drop1')} x={L.W / 2} y={L.phone.y} size={L.W} />
      <Flash at={c('fx.surface') - 1} peak={0.55} len={12} />
      <Flare at={c('fx.whip') + 10} y={L.H * 0.42} len={22} />
      <Flash at={c('fx.punchOut')} peak={0.35} len={10} />
      <Flare at={c('fx.punchOut')} y={L.H * 0.5} len={24} />
      <Flare at={c('fx.flip') + 8} y={L.H * 0.45} len={24} />
      <Flash at={c('fx.flip') + 8} peak={0.3} len={10} />
      <Flash at={c('fx.flash')} peak={1} len={22} color="#ffffff" />
      <Flare at={c('fx.drop2')} y={finaleFlareY(L)} len={34} width={1.3} />
      <Shockwave at={c('fx.drop2')} x={L.W / 2} y={finaleFlareY(L)} size={L.W * 0.9} />
      <Flash at={c('fx.drop2')} peak={0.5} len={14} />
      <Flare at={c('fin.cta')} y={finaleCtaY(L)} len={26} width={0.8} />
      {cues('fx.punches').map((at) => (
        <Flare key={at} at={at} y={pose.y} len={18} width={0.7} />
      ))}
      {cues('fx.speed').map((at) => (
        <SpeedLines key={`s${at}`} at={at} />
      ))}
      <Letterbox />
      <Grade />
    </>
  );
}

function finaleFlareY(L: Layout) {
  return L.format === '9x16' ? 600 : 330;
}
function finaleCtaY(L: Layout) {
  return L.format === '9x16' ? 1150 : 830;
}

