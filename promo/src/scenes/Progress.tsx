import type { CSSProperties } from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR, wordAt } from '../design';
import { Rumbi, type RumbiEvent } from '../Rumbi';
import { Eyebrow, Particles, clamp, drawn, prog } from '../ui';
import { GlobalBackdrop, MATCH_LINE, MICRO, VesselGlass, WordsB, frontWave, polyline, type Pt } from './HabitsShared';

/**
 * PROGRESS (global 240–420) — signature: the "Rumbo meter".
 * A 270° gauge assembles itself (ticks in sequence, track, accent sweep with a
 * glowing marker and live counter 90,0 → 85,1 kg), a glass trend card draws the
 * real weigh-in series, the goal line and the "A favor" chip land on
 * "objetivo", and on "claros de un vistazo" the layout settles under the
 * headline. Exit: the trend line flattens into a ripple that becomes the water
 * line of the Habits vessel (match cut at 420).
 */

const S = 240;
const EO = Easing.bezier(0.16, 1, 0.3, 1);
const IO = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_IN = Easing.bezier(0.55, 0, 0.8, 0.2);
const SWEEP_E = Easing.bezier(0.5, 0, 0.12, 1);
const LINE_E = Easing.bezier(0.42, 0, 0.22, 1);
const POP = Easing.bezier(0.34, 1.56, 0.64, 1);

// v3: Tu(0) peso(1) tu(2) tendencia(3) y(4) tu(5) objetivo(6) claros(7) de(8) un(9) vistazo(10)
const w3 = (i: number) => wordAt('v3', i, 'progress');
const T_PESO = w3(1); // 16
const T_TEND = w3(3); // 30
const T_OBJ = w3(6); // 55
const T_CLAROS = w3(7); // 74
const OUT = 146; // internal transition towards Habits starts

// ── Gauge geometry (local coordinates around the centre) ──────────────────
const R = 210;
const CX = 540;
const CY_A = 713; // hero position while it assembles
const CY_B = 826; // settled under the headline
const START = 225;
const SWEEP = 270;
const TICKS = 37;
const GOAL = 0.49; // (90 − 85,1) / (90 − 80)

const pt = (t: number, r = R) => {
  const a = ((START - SWEEP * t) * Math.PI) / 180;
  return { x: r * Math.cos(a), y: -r * Math.sin(a) };
};
const arcSeg = (t0: number, t1: number, r = R) => {
  const a = pt(t0, r);
  const b = pt(t1, r);
  const large = (t1 - t0) * SWEEP > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};
const ARC = arcSeg(0, 1);

// ── Trend card + chart (canvas coordinates) ───────────────────────────────
const CARD = { x: 96, y: 1068, w: 888, h: 408 };
const PAD = 48;
const ROW_Y = CARD.y + 44; // chip row
const CH = { x0: 168, x1: 912, top: 1216, bottom: 1432, lo: 79.5, hi: 90.5 };
const KG = [90, 89.6, 89.1, 88.9, 88.2, 87.9, 87.4, 87.2, 86.6, 86.3, 85.8, 85.5, 85.1];
const ky = (kg: number) => CH.bottom - ((kg - CH.lo) / (CH.hi - CH.lo)) * (CH.bottom - CH.top);

/** Monotone cubic (Fritsch–Carlson) through evenly spaced values: smooth, no overshoot. */
function monotone(ys: number[]) {
  const n = ys.length;
  const d = ys.slice(1).map((y, i) => y - ys[i]!);
  const m = ys.map((_, i) => (i === 0 ? d[0]! : i === n - 1 ? d[n - 2]! : d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const h = a * a + b * b;
    if (h > 9) {
      const tau = 3 / Math.sqrt(h);
      m[i] = tau * a * d[i]!;
      m[i + 1] = tau * b * d[i]!;
    }
  }
  return (s: number) => {
    const k = Math.min(n - 2, Math.max(0, Math.floor(s)));
    const t = s - k;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[k]! + (t3 - 2 * t2 + t) * m[k]! + (-2 * t3 + 3 * t2) * ys[k + 1]! + (t3 - t2) * m[k + 1]!;
  };
}

const SAMPLES = 121; // 10 per interval → data point i sits on sample 10·i
const kgAt = monotone(KG);
const U = Array.from({ length: SAMPLES }, (_, j) => j / (SAMPLES - 1));
const CHART_PTS: Pt[] = U.map((u) => ({ x: CH.x0 + u * (CH.x1 - CH.x0), y: ky(kgAt(u * (KG.length - 1))) }));
const CUM = CHART_PTS.reduce<number[]>((acc, p, j) => {
  acc.push(j === 0 ? 0 : acc[j - 1]! + Math.hypot(p.x - CHART_PTS[j - 1]!.x, p.y - CHART_PTS[j - 1]!.y));
  return acc;
}, []);
const LEN = CUM[CUM.length - 1]!;
const DOT_FRAC = KG.map((_, i) => CUM[i * 10]! / LEN);

function pointAtFrac(fr: number): Pt {
  const target = clamp(fr) * LEN;
  let j = 1;
  while (j < SAMPLES - 1 && CUM[j]! < target) j++;
  const a = CHART_PTS[j - 1]!;
  const b = CHART_PTS[j]!;
  const seg = CUM[j]! - CUM[j - 1]! || 1;
  const k = clamp((target - CUM[j - 1]!) / seg);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

const lineAt = (f: number) => interpolate(f, [T_TEND, T_TEND + 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: LINE_E });
const arcAt = (f: number) => GOAL * interpolate(f, [T_PESO, T_PESO + 32], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SWEEP_E });

// ── Rumbi: peeks over the card's top-left edge and follows the line ───────
const RUMBI = { size: 140, x: 150, delay: 20, visible: 92 };
const RUMBI_EYE = { x: RUMBI.x + RUMBI.size / 2, y: CARD.y - RUMBI.visible + RUMBI.size / 2 };

const RUMBI_EVENTS: RumbiEvent[] = (() => {
  const at = (rel: number) => rel - RUMBI.delay;
  const ev: RumbiEvent[] = [];
  for (let r = 36; r <= 66; r += 3) {
    const h = pointAtFrac(lineAt(r));
    ev.push({ at: at(r), look: [clamp((h.x - RUMBI_EYE.x) / 420, -1, 1), clamp((h.y - RUMBI_EYE.y) / 240, -1, 1)] });
  }
  ev.push({ at: at(T_OBJ + 3), look: [1, 0.35] }); // the chip pops
  ev.push({ at: at(T_OBJ + 11), look: [0.95, 1] }); // the goal line lands
  ev.push({ at: at(T_CLAROS + 4), look: [0.2, -1] }); // the headline arrives above
  ev.push({ at: at(88), expr: 'happy' });
  ev.push({ at: at(90), tap: true }); // beat (global 330)
  ev.push({ at: at(104), look: [0, 0] }); // to camera
  ev.push({ at: at(120), tap: true }); // hop on the bar (global 360)
  ev.push({ at: at(136), look: [0.55, 0.9] }); // watches the line turn into water
  return ev;
})();

export function Progress() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gf = f + S;

  // Entrance (master light sweep 233–247): content rises in over 10 frames.
  const enter = prog(f, 0, 10, EO);

  // Layout settle on "claros de un vistazo".
  const settle = prog(f, T_CLAROS - 4, T_CLAROS + 22, IO);
  const cy = CY_A + (CY_B - CY_A) * settle - f * 0.04; // + a slow parallax drift

  // Gauge assembly.
  const trackP = prog(f, 3, 26, IO);
  const arcP = arcAt(f);
  const vel = (arcAt(f) - arcAt(f - 1)) / GOAL;
  const kg = 90 - 10 * arcP;
  const arrive = prog(f, T_PESO + 30, T_PESO + 54, EO);
  const goalPulse = prog(f, T_OBJ, T_OBJ + 22, EO);
  const gaugeOut = prog(f, OUT, OUT + 12, IO);

  // Trend card.
  const cardS = spring({ frame: f - (T_TEND - 8), fps, config: { damping: 18, stiffness: 120, mass: 1 } });
  const cardY = (1 - cardS) * 70;
  const glassOut = prog(f, 150, 166, IO);
  const lineT = lineAt(f);
  const head = pointAtFrac(lineT);
  const goalP = prog(f, T_OBJ, T_OBJ + 18, EO);
  const goalLabel = prog(f, T_OBJ + 6, T_OBJ + 20, EO);
  const chipS = spring({ frame: f - T_OBJ, fps, config: { damping: 16, stiffness: 170, mass: 0.8 } });
  const chipCheck = prog(f, T_OBJ + 5, T_OBJ + 17, EO);
  const sheen = prog(f, 100, 124, IO);
  const uiOut = prog(f, OUT - 2, OUT + 8, IO);

  // Match transition: line flattens, turns to water, ripples and contracts into the vessel.
  const flat = prog(f, 150, 166, IO);
  const colorT = prog(f, 150, 162, IO);
  const contract = prog(f, 156, 179, IO);
  const amp = MATCH_LINE.amp * prog(f, 156, 176, IO);
  const dotsOut = prog(f, OUT, OUT + 10, IO);

  const linePts: Pt[] = CHART_PTS.map((p, j) => {
    const x = p.x + (MATCH_LINE.x0 + U[j]! * (MATCH_LINE.x1 - MATCH_LINE.x0) - p.x) * contract;
    const y = p.y + cardY + (MATCH_LINE.y - (p.y + cardY)) * flat + amp * frontWave(x, gf);
    return { x, y };
  });
  const lineD = polyline(linePts);
  const lineW = 6 + (MATCH_LINE.width - 6) * flat;
  const areaD = `${polyline(CHART_PTS)} L ${CH.x1} ${CH.bottom} L ${CH.x0} ${CH.bottom} Z`;

  // Rumbi.
  const peek = spring({ frame: f - 26, fps, config: { damping: 15, stiffness: 120, mass: 0.9 } });
  const duck = prog(f, 146, 158, EASE_IN);
  const rumbiY = (1 - peek) * 110 + duck * 120;

  const y80 = ky(80);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <GlobalBackdrop gf={gf} glow={0.55} glowY={0.42} />

      <AbsoluteFill
        style={{
          transform: `translateY(${(1 - enter) * 60}px)`,
          opacity: enter,
          filter: enter < 1 ? `blur(${(1 - enter) * 10}px)` : undefined,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - prog(f, 146, 166, IO) }}>
          <Particles seed={23} count={14} opacity={0.3} area={{ x: 60, y: 300, w: 960, h: 1200 }} />
        </div>

        {/* Light behind the meter: warms up as the arc sweeps */}
        <div
          style={{
            position: 'absolute',
            left: CX - 420,
            top: cy - 420,
            width: 840,
            height: 840,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(229,57,69,0.32), rgba(229,57,69,0.08) 55%, transparent)',
            opacity: (0.35 + 0.65 * (arcP / GOAL)) * (1 - gaugeOut),
          }}
        />

        {/* ── Rumbo meter ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translateY(${-60 * gaugeOut}px)`,
            opacity: 1 - gaugeOut,
            filter: gaugeOut > 0 ? `blur(${8 * gaugeOut}px)` : undefined,
          }}
        >
          <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id="pg-arc" gradientUnits="userSpaceOnUse" x1={-R} y1={R} x2={R} y2={-R}>
                <stop offset="0" stopColor="#8f182b" />
                <stop offset="0.55" stopColor="#e53945" />
                <stop offset="1" stopColor="#ff9aa0" />
              </linearGradient>
              <radialGradient id="pg-halo">
                <stop offset="0" stopColor="#ffd0d3" stopOpacity="0.95" />
                <stop offset="0.35" stopColor="#ff5a63" stopOpacity="0.55" />
                <stop offset="1" stopColor="#ff5a63" stopOpacity="0" />
              </radialGradient>
              <filter id="pg-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="9" />
              </filter>
            </defs>
            <g transform={`translate(${CX} ${cy})`}>
              {/* ticks draw in sequence, then light up as the marker passes them */}
              {Array.from({ length: TICKS }, (_, i) => {
                const t = i / (TICKS - 1);
                const major = i % 9 === 0;
                const grow = prog(f, 2 + i * 0.55, 9 + i * 0.55, EO);
                if (grow <= 0) return null;
                const lit = clamp((arcP - t) * 40 + 1);
                const a = pt(t, R + 22);
                const b = pt(t, R + 22 + (major ? 22 : 12) * grow);
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={lit > 0 ? `rgba(255,${Math.round(255 - 117 * lit)},${Math.round(255 - 112 * lit)},${0.22 + 0.68 * lit})` : 'rgba(255,255,255,0.22)'}
                    strokeWidth={major ? 4 : 2.5}
                    strokeLinecap="round"
                    opacity={grow}
                  />
                );
              })}
              {trackP > 0.002 && <path d={ARC} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={18} strokeLinecap="round" {...drawn(trackP)} />}
              {arcP > 0.002 && (
                <>
                  <path d={arcSeg(0, arcP)} fill="none" stroke="url(#pg-arc)" strokeWidth={30} strokeLinecap="round" filter="url(#pg-blur)" opacity={0.55} />
                  <path d={arcSeg(0, arcP)} fill="none" stroke="url(#pg-arc)" strokeWidth={18} strokeLinecap="round" />
                  {/* comet tail while travelling */}
                  {vel > 0.002 && (
                    <path d={arcSeg(Math.max(0, arcP - 0.08), arcP)} fill="none" stroke="#ffb3b8" strokeWidth={22} strokeLinecap="round" filter="url(#pg-blur)" opacity={clamp(vel * 28)} />
                  )}
                </>
              )}
              {/* goal end acknowledges "objetivo" */}
              {goalPulse > 0 && goalPulse < 1 && (
                <circle cx={pt(1).x} cy={pt(1).y} r={10 + 34 * goalPulse} fill="none" stroke="#ffffff" strokeWidth={2} opacity={0.5 * (1 - goalPulse)} />
              )}
              {arcP > 0.002 && (
                <g transform={`translate(${pt(arcP).x} ${pt(arcP).y})`}>
                  <circle r={34 * (1 + 0.35 * Math.sin(Math.PI * arrive))} fill="url(#pg-halo)" />
                  {arrive > 0 && arrive < 1 && <circle r={14 + 50 * arrive} fill="none" stroke="#ff8a8f" strokeWidth={2.5} opacity={0.7 * (1 - arrive)} />}
                  <circle r={11} fill="#fff" />
                </g>
              )}
            </g>
          </svg>

          {/* gauge typography */}
          <div style={{ position: 'absolute', left: CX, top: cy, width: 0, height: 0 }}>
            <div style={{ ...MICRO, position: 'absolute', left: -200, width: 400, top: -104, textAlign: 'center', opacity: prog(f, 8, 20, EO) }}>Peso actual</div>
            <div
              style={{
                position: 'absolute',
                left: -220,
                width: 440,
                top: -68,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'baseline',
                gap: 10,
                opacity: prog(f, 10, 22, EO),
                transform: `translateY(${(1 - prog(f, 10, 24, EO)) * 18}px)`,
              }}
            >
              <span style={{ fontSize: 104, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {kg.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              <span style={{ fontSize: 40, fontWeight: 600, color: COLOR.text2, letterSpacing: '-0.01em' }}>kg</span>
            </div>
            <div
              style={{
                position: 'absolute',
                left: -220,
                width: 440,
                top: 48,
                textAlign: 'center',
                fontSize: 40,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: COLOR.text2,
                opacity: prog(f, T_PESO + 4, T_PESO + 16, EO),
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(arcP * 100)} % del camino
            </div>
            <div style={{ ...MICRO, position: 'absolute', left: -96 - 100, width: 200, top: 163, textAlign: 'center', opacity: prog(f, 5, 15, EO) }}>90 kg</div>
            <div
              style={{
                ...MICRO,
                position: 'absolute',
                left: 96 - 100,
                width: 200,
                top: 163,
                textAlign: 'center',
                opacity: prog(f, 22, 32, EO),
                color: `rgba(255,255,255,${0.5 + 0.5 * prog(f, T_OBJ, T_OBJ + 8, EO)})`,
              }}
            >
              80 kg
            </div>
          </div>
        </div>

        {/* ── Trend card ── */}
        <Glass3
          style={{
            left: CARD.x,
            top: CARD.y + cardY,
            width: CARD.w,
            height: CARD.h,
            opacity: clamp(cardS * 1.4) * (1 - glassOut),
          }}
          sheen={sheen}
        />

        {/* the Habits vessel starts drawing around the flattened line (match cut at 420) */}
        {gf >= 402 && <VesselGlass gf={gf} />}

        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: clamp(cardS * 1.4) }}>
          <defs>
            <linearGradient id="pg-line" gradientUnits="userSpaceOnUse" x1={CH.x0} y1="0" x2={CH.x1} y2="0">
              <stop offset="0" stopColor="#ff8a7a" />
              <stop offset="0.5" stopColor="#ff4552" />
              <stop offset="1" stopColor="#ff6b74" />
            </linearGradient>
            <linearGradient id="pg-area" gradientUnits="userSpaceOnUse" x1="0" y1={CH.top} x2="0" y2={CH.bottom}>
              <stop offset="0" stopColor="#ff4552" stopOpacity="0.32" />
              <stop offset="1" stopColor="#ff4552" stopOpacity="0" />
            </linearGradient>
            <clipPath id="pg-reveal">
              <rect x={CH.x0 - 20} y={0} width={Math.max(0, head.x - CH.x0 + 20)} height={1920} />
            </clipPath>
            <clipPath id="pg-goal">
              <rect x={CH.x1 - goalP * (CH.x1 - CH.x0)} y={0} width={goalP * (CH.x1 - CH.x0)} height={1920} />
            </clipPath>
            <filter id="pg-lglow" x="-10%" y="-50%" width="120%" height="200%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>
          <g transform={`translate(0 ${cardY})`}>
            {/* area */}
            <path d={areaD} fill="url(#pg-area)" clipPath="url(#pg-reveal)" opacity={1 - prog(f, OUT, OUT + 12, IO)} />
            {/* dashed goal line, slides in from the right */}
            {goalP > 0 && (
              <g clipPath="url(#pg-goal)" opacity={1 - prog(f, OUT - 2, OUT + 8, IO)}>
                <line x1={CH.x0} x2={CH.x1} y1={y80} y2={y80} stroke="rgba(255,255,255,0.5)" strokeWidth={3} strokeDasharray="14 12" strokeDashoffset={(1 - goalP) * 130} strokeLinecap="round" />
              </g>
            )}
          </g>
          {/* the line (canvas space: it leaves the card during the match) */}
          {lineT > 0.002 && (
            <>
              <path d={lineD} fill="none" stroke={colorT < 1 ? '#ff4552' : MATCH_LINE.color} strokeWidth={lineW + 10} strokeLinecap="round" strokeLinejoin="round" filter="url(#pg-lglow)" opacity={0.45 * (1 - colorT)} {...drawn(lineT)} />
              <path d={lineD} fill="none" stroke={MATCH_LINE.color} strokeWidth={lineW + 10} strokeLinecap="round" strokeLinejoin="round" filter="url(#pg-lglow)" opacity={0.5 * colorT} {...drawn(lineT)} />
              <path d={lineD} fill="none" stroke="url(#pg-line)" strokeWidth={lineW} strokeLinecap="round" strokeLinejoin="round" opacity={1 - colorT} {...drawn(lineT)} />
              {colorT > 0 && <path d={lineD} fill="none" stroke={MATCH_LINE.color} strokeWidth={lineW} strokeLinecap="round" strokeLinejoin="round" opacity={colorT} {...drawn(lineT)} />}
            </>
          )}
          {/* data points pop as the line reaches them */}
          <g transform={`translate(0 ${cardY})`}>
            {KG.map((k, i) => {
              const s = interpolate((lineT - DOT_FRAC[i]!) / 0.06, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: POP });
              const sc = s * (1 - dotsOut);
              if (sc <= 0.001) return null;
              const last = i === KG.length - 1;
              const p = CHART_PTS[i * 10]!;
              const ring = last ? prog(f, 98, 124, EO) : 0;
              return (
                <g key={i} transform={`translate(${p.x} ${ky(k)}) scale(${sc})`}>
                  {last && ring > 0 && ring < 1 && <circle r={12 + 30 * ring} fill="none" stroke="#ff8a8f" strokeWidth={2} opacity={0.7 * (1 - ring)} />}
                  {last ? <circle r={11} fill="#fff" stroke="#ff4552" strokeWidth={4} /> : <circle r={7} fill="#0b0b10" stroke="#ff6b74" strokeWidth={3} />}
                </g>
              );
            })}
            {/* drawing head */}
            {lineT > 0.002 && lineT < 0.999 && <circle cx={head.x} cy={head.y} r={9} fill="#fff" opacity={0.95} />}
          </g>
        </svg>

        {/* card typography */}
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${cardY}px)`, opacity: 1 - uiOut }}>
          <div style={{ ...MICRO, position: 'absolute', left: CARD.x + PAD, top: ROW_Y + 25, opacity: prog(f, T_TEND - 2, T_TEND + 10, EO) * clamp(cardS * 1.4) }}>
            Tendencia
          </div>
          <div
            style={{
              ...MICRO,
              position: 'absolute',
              right: 1080 - (CARD.x + CARD.w - PAD),
              top: y80 - 44,
              color: 'rgba(255,255,255,0.62)',
              opacity: goalLabel,
              transform: `translateX(${(1 - goalLabel) * 24}px)`,
            }}
          >
            Objetivo · 80 kg
          </div>
          {/* "A favor de tu objetivo" chip */}
          <div
            style={{
              position: 'absolute',
              right: 1080 - (CARD.x + CARD.w - PAD),
              top: ROW_Y,
              height: 76,
              padding: '0 28px 0 22px',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'rgba(79,224,143,0.12)',
              boxShadow: 'inset 0 0 0 2px rgba(79,224,143,0.32), 0 0 40px -12px rgba(79,224,143,0.5)',
              color: COLOR.good,
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              opacity: clamp(chipS * 1.3),
              transform: `translateY(${(1 - chipS) * 18}px) scale(${0.94 + 0.06 * chipS})`,
              transformOrigin: '100% 50%',
            }}
          >
            <svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke={COLOR.good} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" {...drawn(chipCheck)} />
              <path d="M7.5 12.4l3 3 6-6.4" {...drawn(prog(f, T_OBJ + 10, T_OBJ + 20, EO))} />
            </svg>
            A favor de tu objetivo
          </div>
        </div>

        {/* Rumbi peeking over the card's top-left edge */}
        <div
          style={{
            position: 'absolute',
            left: RUMBI.x,
            top: CARD.y - RUMBI.visible + cardY,
            width: RUMBI.size,
            height: RUMBI.visible,
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: rumbiY }}>
            <Rumbi size={RUMBI.size} delay={RUMBI.delay} events={RUMBI_EVENTS} seed={31} />
          </div>
        </div>

        {/* ── Headline ── */}
        <div style={{ position: 'absolute', left: 96, top: 262, opacity: 1 - prog(f, OUT - 4, OUT + 6, IO), transform: `translateY(${-24 * prog(f, OUT - 4, OUT + 6, IO)}px)` }}>
          <Eyebrow text="Progreso" at={3} />
        </div>
        <div style={{ position: 'absolute', left: 96, top: 312, width: 888 }}>
          <WordsB text="Tu progreso," frames={[T_CLAROS, T_CLAROS + 5]} size={104} lineHeight={0.98} out={OUT - 2} />
        </div>
        <div style={{ position: 'absolute', left: 96, top: 414, width: 888 }}>
          <WordsB text="de un vistazo." frames={[w3(8), w3(9), w3(10)]} size={104} lineHeight={0.98} accent={[0, 1, 2]} out={OUT} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Liquid Glass card (as ui.tsx Glass) with a one-off specular sheen. */
function Glass3({ style, sheen }: { style: CSSProperties; sheen: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: 52,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.045))',
        backdropFilter: 'blur(28px) saturate(170%)',
        WebkitBackdropFilter: 'blur(28px) saturate(170%)',
        boxShadow:
          'inset 0 1.5px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(255,255,255,0.05), inset 0 0 0 1.5px rgba(255,255,255,0.08), 0 40px 80px -30px rgba(0,0,0,0.85)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {sheen > 0 && sheen < 1 && (
        <div
          style={{
            position: 'absolute',
            top: -200,
            bottom: -200,
            left: -400 + sheen * 1700,
            width: 260,
            transform: 'rotate(20deg)',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)',
          }}
        />
      )}
    </div>
  );
}
