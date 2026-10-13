import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR, wordAt } from '../design';
import { Rumbi, type RumbiEvent } from '../Rumbi';
import { Eyebrow, Particles, clamp, drawn, fmt, prog, rng } from '../ui';
import { GlobalBackdrop, MATCH_LINE, MICRO, VESSEL, VESSEL_IN, VesselGlass, WATER, WordsB, backWave, cavityHalf, fmtInt, frontWave, polyline, type Pt } from './HabitsShared';

/**
 * HABITS (global 420–585) — signature: physical liquid + a running track.
 * Left: the glass vessel (drawn around the flattened Progress trend line) fills
 * with JS-simulated water — two layered waves, a highlight line, rising bubbles,
 * slosh that grows with the pour and settles with a damped wobble — 0 → 70 %,
 * 0,00 → 1,75 L. Right: the athletics track (as the app's steps panel) whose
 * amber stroke draws to 80 % with a runner dot on the parametric oval,
 * 0 → 6.420 pasos. Rumbi watches the water, then the runner, and celebrates.
 * Exit: lift away in the last 8 frames (master light sweep 578–592).
 */

const S = 420;
const EO = Easing.bezier(0.16, 1, 0.3, 1);
const IO = Easing.bezier(0.65, 0, 0.35, 1);
const POUR = Easing.bezier(0.45, 0, 0.18, 1);
const RUN = Easing.bezier(0.42, 0, 0.2, 1);

// v4: Agua(0) y(1) pasos(2) día(3) a(4) día(5) sin(6) complicaciones(7)
const w4 = (i: number) => wordAt('v4', i, 'habits');

// ── Water (global frames) ─────────────────────────────────────────────────
const FILL_A = 433;
const FILL_B = 495; // lands on a beat
const LEVEL = 0.7; // 1,75 of 2,5 L
const fillP = (gf: number) => interpolate(gf, [FILL_A, FILL_B], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: POUR });
const IN_BOTTOM = VESSEL_IN.y + VESSEL_IN.h; // 1240
const levelY = (lv: number) => MATCH_LINE.y - lv * (VESSEL_IN.h - 8);

// ── Track (vertical stadium, canvas coordinates) ──────────────────────────
const TR = { cx: 744, r: 223, half: 60, stroke: 34, top: VESSEL.y, bottom: VESSEL.y + VESSEL.h };
const CY = (TR.top + TR.bottom) / 2; // 952
const CY_T = CY - TR.half;
const CY_B = CY + TR.half;
const PERIM = 2 * Math.PI * TR.r + 4 * TR.half;
const STEPS_P = 6420 / 8000; // 0,8025
const RUN_A = 450;
const RUN_B = 510;
const runP = (gf: number) => STEPS_P * interpolate(gf, [RUN_A, RUN_B], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: RUN });

/** Clockwise from the bottom centre (the start line), like the app's track. */
const TRACK_D = `M ${TR.cx} ${CY_B + TR.r} A ${TR.r} ${TR.r} 0 0 1 ${TR.cx - TR.r} ${CY_B} L ${TR.cx - TR.r} ${CY_T} A ${TR.r} ${TR.r} 0 0 1 ${TR.cx + TR.r} ${CY_T} L ${TR.cx + TR.r} ${CY_B} A ${TR.r} ${TR.r} 0 0 1 ${TR.cx} ${CY_B + TR.r}`;

/** Point (and tangent angle) on the track at fraction u of the lap. */
function trackAt(u: number): { x: number; y: number; a: number } {
  let s = (((u % 1) + 1) % 1) * PERIM;
  const q = (Math.PI * TR.r) / 2;
  const seg = 2 * TR.half;
  const arc = (cy: number, th: number) => ({ x: TR.cx + TR.r * Math.cos(th), y: cy + TR.r * Math.sin(th), a: th + Math.PI / 2 });
  if (s < q) return arc(CY_B, Math.PI / 2 + s / TR.r);
  s -= q;
  if (s < seg) return { x: TR.cx - TR.r, y: CY_B - s, a: -Math.PI / 2 };
  s -= seg;
  if (s < 2 * q) return arc(CY_T, Math.PI + s / TR.r);
  s -= 2 * q;
  if (s < seg) return { x: TR.cx + TR.r, y: CY_T + s, a: Math.PI / 2 };
  s -= seg;
  return arc(CY_B, s / TR.r);
}

// ── Rumbi ─────────────────────────────────────────────────────────────────
const RB = { size: 170, cx: 540, top: 1300, delay: 10 };
const RB_EYE = { x: RB.cx, y: RB.top + RB.size * 0.45 };
const lookAtPt = (p: { x: number; y: number }): [number, number] => [clamp((p.x - RB_EYE.x) / 300, -1, 1), clamp((p.y - RB_EYE.y) / 330, -1, 1)];

const RUMBI_EVENTS: RumbiEvent[] = (() => {
  const at = (local: number) => local - RB.delay;
  const ev: RumbiEvent[] = [];
  // follows the water surface as it rises
  for (let l = 16; l <= 34; l += 3) ev.push({ at: at(l), look: lookAtPt({ x: VESSEL.x + VESSEL.w / 2 + 40, y: levelY(LEVEL * fillP(l + S)) }) });
  ev.push({ at: at(26), expr: 'surprised' });
  // then the runner on the track
  for (let l = 37; l <= 88; l += 3) ev.push({ at: at(l), look: lookAtPt(trackAt(runP(l + S))) });
  ev.push({ at: at(40), expr: 'encouraging' });
  ev.push({ at: at(90), expr: 'happy' }); // both values landed (global 510, beat)
  ev.push({ at: at(90), tap: true });
  ev.push({ at: at(104), look: [-0.55, -0.75] }); // glance back at the water
  ev.push({ at: at(116), look: [0, 0] }); // to camera
  ev.push({ at: at(120), tap: true }); // hop on the bar (global 540)
  ev.push({ at: at(146), look: [0.25, -0.5] });
  return ev;
})();

// Deterministic bubbles inside the vessel.
const BUBBLES = (() => {
  const r = rng(47);
  return Array.from({ length: 16 }, () => ({ x: VESSEL_IN.x + 34 + r() * (VESSEL_IN.w - 68), v: 2.2 + r() * 2.6, ph: r() * 560, s: 2.5 + r() * 4.5, wob: r() * 6.28 }));
})();

export function Habits() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gf = f + S;

  // Exit (last 8 frames): lift away under the master light sweep.
  const out = prog(f, 157, 165, Easing.bezier(0.55, 0, 0.8, 0.2));
  const drift = -f * 0.05; // mid-layer parallax drift

  // ── Water state ──
  const fp = fillP(gf);
  const settle = gf > FILL_B ? 0.018 * Math.sin((gf - FILL_B) * 0.42) * Math.exp(-(gf - FILL_B) / 11) : 0;
  const lv = LEVEL * fp + settle;
  const sy = levelY(lv);
  const lin = clamp((gf - FILL_A) / (FILL_B - FILL_A));
  const amp = MATCH_LINE.amp + 2.5 * clamp((gf - FILL_A) / 30) + 11 * Math.sin(Math.PI * lin) * (gf < FILL_B ? 1 : 0) + 30 * Math.abs(settle);
  const half = cavityHalf(sy) - 2;
  const vcx = VESSEL_IN.x + VESSEL_IN.w / 2;
  const surf = (x: number) => sy + amp * frontWave(x, gf);
  const xs = Array.from({ length: 47 }, (_, i) => VESSEL_IN.x - 4 + i * 7.5);
  const frontD = `${polyline(xs.map((x) => ({ x, y: surf(x) })))} L ${VESSEL_IN.x + VESSEL_IN.w + 6} ${IN_BOTTOM + 20} L ${VESSEL_IN.x - 6} ${IN_BOTTOM + 20} Z`;
  const backD = `${polyline(xs.map((x) => ({ x, y: sy - 7 * clamp(lv * 6) + amp * 0.9 * backWave(x, gf) })))} L ${VESSEL_IN.x + VESSEL_IN.w + 6} ${IN_BOTTOM + 20} L ${VESSEL_IN.x - 6} ${IN_BOTTOM + 20} Z`;
  const hiPts: Pt[] = [];
  for (let x = vcx - half + 6; x <= vcx + half - 6; x += 6) hiPts.push({ x, y: surf(x) });
  const hiD = hiPts.length > 1 ? polyline(hiPts) : '';
  const matchFade = prog(gf, 420, 446, IO); // the Progress line style melts into a surface highlight
  const liters = 1.75 * fp;
  const waterPill = spring({ frame: gf - FILL_B, fps, config: { damping: 15, stiffness: 170, mass: 0.7 } });

  // ── Track state ──
  const laneP = prog(gf, 424, 452, IO);
  const rp = runP(gf);
  const runner = trackAt(rp);
  const runVel = (rp - runP(gf - 1)) * 60;
  const steps = 8000 * rp;
  const stepPill = spring({ frame: gf - RUN_B, fps, config: { damping: 15, stiffness: 170, mass: 0.7 } });
  const arrive = prog(gf, RUN_B, RUN_B + 24, EO);
  const fieldIn = prog(gf, 432, 456, EO);

  // Typography inside the visuals.
  const labelsIn = prog(gf, 436, 452, EO);
  const numIn = prog(gf, 434, 450, EO);
  const numInT = prog(gf, 446, 462, EO);

  // Rumbi pops up from below the visuals.
  const rIn = spring({ frame: f - 8, fps, config: { damping: 14, stiffness: 150, mass: 0.8 } });

  // Shimmer across both visuals once the values land.
  const sheen = prog(gf, 522, 548, IO);

  const ticks = [0.25, 0.5, 0.75].map((u) => ({ u, p: trackAt(u) }));

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <GlobalBackdrop gf={gf} glow={0.55} glowY={0.42} />

      <AbsoluteFill style={{ transform: `translateY(${-60 * out}px)`, opacity: 1 - out, filter: out > 0 ? `blur(${10 * out}px)` : undefined }}>
        <Particles seed={57} count={12} opacity={0.26} area={{ x: 60, y: 300, w: 960, h: 1200 }} />

        {/* coloured light behind each visual, warming up with its value */}
        <div
          style={{
            position: 'absolute',
            left: VESSEL.x + VESSEL.w / 2 - 380,
            top: CY - 380,
            width: 760,
            height: 760,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(59,140,255,0.32), rgba(59,140,255,0.08) 55%, transparent)',
            opacity: 0.15 + 0.85 * fp,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: TR.cx - 420,
            top: CY - 420,
            width: 840,
            height: 840,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(242,176,30,0.24), rgba(242,176,30,0.06) 55%, transparent)',
            opacity: rp / STEPS_P,
          }}
        />

        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${drift}px)` }}>
          {/* ── Vessel ── */}
          <VesselGlass gf={gf} />
          <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <clipPath id="hb-cav">
                <rect x={VESSEL_IN.x} y={VESSEL_IN.y} width={VESSEL_IN.w} height={VESSEL_IN.h} rx={VESSEL_IN.r} />
              </clipPath>
              <linearGradient id="hb-water" gradientUnits="userSpaceOnUse" x1="0" y1={sy - 20} x2="0" y2={IN_BOTTOM}>
                <stop offset="0" stopColor={WATER.hi} />
                <stop offset="0.35" stopColor={WATER.mid} />
                <stop offset="1" stopColor={WATER.deep} />
              </linearGradient>
              <linearGradient id="hb-vol" gradientUnits="userSpaceOnUse" x1={VESSEL_IN.x} y1="0" x2={VESSEL_IN.x + VESSEL_IN.w} y2="0">
                <stop offset="0" stopColor="#000" stopOpacity="0.28" />
                <stop offset="0.3" stopColor="#000" stopOpacity="0" />
                <stop offset="0.75" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity="0.32" />
              </linearGradient>
              <filter id="hb-glow" x="-20%" y="-200%" width="140%" height="500%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            <g clipPath="url(#hb-cav)">
              <path d={backD} fill={WATER.deep} opacity={0.75} />
              <path d={frontD} fill="url(#hb-water)" />
              <path d={frontD} fill="url(#hb-vol)" />
              {/* bubbles rise only under the surface */}
              {gf > FILL_A + 4 &&
                BUBBLES.map((b, i) => {
                  const by = IN_BOTTOM - 10 - (((gf - FILL_A) * b.v + b.ph) % 560);
                  const bx = b.x + Math.sin(gf / 9 + b.wob) * 4;
                  const depth = by - surf(bx);
                  if (depth < 6) return null;
                  const a = clamp(depth / 40) * clamp((gf - FILL_A - 4) / 10);
                  return <circle key={i} cx={bx} cy={by} r={b.s} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} opacity={0.75 * a} />;
                })}
            </g>
            {/* surface highlight: starts as the Progress trend line, ends as a thin specular rim */}
            {hiD && (
              <>
                <path d={hiD} fill="none" stroke={MATCH_LINE.color} strokeWidth={MATCH_LINE.width + 10} strokeLinecap="round" filter="url(#hb-glow)" opacity={0.5 * (1 - matchFade)} />
                <path
                  d={hiD}
                  fill="none"
                  stroke={matchFade < 1 ? MATCH_LINE.color : '#d6e9ff'}
                  strokeWidth={MATCH_LINE.width - 2.2 * matchFade}
                  strokeLinecap="round"
                  opacity={1 - 0.35 * matchFade}
                />
              </>
            )}
          </svg>

          {/* water typography (sits in the water once it fills) */}
          <div style={{ position: 'absolute', left: VESSEL.x, width: VESSEL.w, top: CY - 176, textAlign: 'center' }}>
            <div style={{ ...MICRO, color: 'rgba(255,255,255,0.72)', opacity: labelsIn, transform: `translateY(${(1 - labelsIn) * 12}px)` }}>Agua</div>
          </div>
          <div
            style={{
              position: 'absolute',
              left: VESSEL.x,
              width: VESSEL.w,
              top: CY - 68,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: 8,
              opacity: numIn,
              transform: `translateY(${(1 - numIn) * 18}px)`,
              textShadow: '0 4px 24px rgba(5,20,60,0.35)',
            }}
          >
            <span style={{ fontSize: 104, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fmt(liters, 2)}</span>
            <span style={{ fontSize: 40, fontWeight: 700, color: COLOR.text2 }}>L</span>
          </div>
          <div style={{ position: 'absolute', left: VESSEL.x, width: VESSEL.w, top: CY + 48, textAlign: 'center', fontSize: 40, fontWeight: 600, letterSpacing: '-0.01em', color: COLOR.text2, opacity: labelsIn }}>
            de 2,5 L
          </div>
          <Pill x={VESSEL.x + VESSEL.w / 2} y={CY + 128} s={waterPill} color="#cfe3ff" bg="rgba(255,255,255,0.16)">
            70 %
          </Pill>

          {/* ── Track ── */}
          <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <defs>
              <linearGradient id="hb-run" gradientUnits="userSpaceOnUse" x1="0" y1={TR.bottom} x2="0" y2={TR.top}>
                <stop offset="0" stopColor="#ffc94a" />
                <stop offset="1" stopColor="#f2a01e" />
              </linearGradient>
              <filter id="hb-tglow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="10" />
              </filter>
              <radialGradient id="hb-dot">
                <stop offset="0" stopColor="#fff3cf" stopOpacity="0.95" />
                <stop offset="0.4" stopColor="#f2b01e" stopOpacity="0.5" />
                <stop offset="1" stopColor="#f2b01e" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* inner field */}
            <rect
              x={TR.cx - TR.r + TR.stroke / 2 + 26}
              y={CY_T - TR.r + TR.stroke / 2 + 26}
              width={2 * (TR.r - TR.stroke / 2 - 26)}
              height={2 * (TR.r - TR.stroke / 2 - 26) + 2 * TR.half}
              rx={TR.r - TR.stroke / 2 - 26}
              fill="rgba(255,255,255,0.035)"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1.5}
              opacity={fieldIn}
              transform={`translate(${TR.cx} ${CY}) scale(${0.94 + 0.06 * fieldIn}) translate(${-TR.cx} ${-CY})`}
            />
            {/* lane */}
            <path d={TRACK_D} fill="none" stroke="rgba(242,176,30,0.16)" strokeWidth={TR.stroke} strokeLinecap="round" {...drawn(laneP)} />
            <path d={TRACK_D} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={2} strokeDasharray="3 13" opacity={laneP * (1 - 0.6 * (rp / STEPS_P))} />
            {/* quarter marks crossing the lane */}
            {ticks.map(({ u, p }, i) => {
              const t = prog(gf, 430 + i * 4, 446 + i * 4, EO);
              const lit = clamp((rp - u) * 30);
              const nx = Math.cos(p.a - Math.PI / 2);
              const ny = Math.sin(p.a - Math.PI / 2);
              const len = (TR.stroke / 2 + 16) * t;
              return (
                <line
                  key={i}
                  x1={p.x - nx * len}
                  y1={p.y - ny * len}
                  x2={p.x + nx * len}
                  y2={p.y + ny * len}
                  stroke={lit > 0 ? `rgba(255,${Math.round(255 - 60 * lit)},${Math.round(255 - 200 * lit)},${0.35 + 0.5 * lit})` : 'rgba(255,255,255,0.35)'}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
            {/* start line */}
            <line x1={TR.cx} x2={TR.cx} y1={CY_B + TR.r - (TR.stroke / 2 + 10) * laneP} y2={CY_B + TR.r + (TR.stroke / 2 + 10) * laneP} stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={laneP} />
            {/* progress */}
            {rp > 0.001 && (
              <>
                <path d={TRACK_D} fill="none" stroke="#f2b01e" strokeWidth={TR.stroke + 8} strokeLinecap="round" filter="url(#hb-tglow)" opacity={0.45} {...drawn(rp)} />
                <path d={TRACK_D} fill="none" stroke="url(#hb-run)" strokeWidth={TR.stroke} strokeLinecap="round" {...drawn(rp)} />
                {/* speed streak behind the runner */}
                {runVel > 0.05 && (
                  <path d={TRACK_D} fill="none" stroke="#fff1c4" strokeWidth={TR.stroke - 14} strokeLinecap="round" opacity={clamp(runVel * 0.6) * 0.8} pathLength={1} strokeDasharray={`${Math.min(0.06, rp)} 1`} strokeDashoffset={-(rp - Math.min(0.06, rp))} />
                )}
                <g transform={`translate(${runner.x} ${runner.y})`}>
                  <circle r={40 * (1 + 0.4 * Math.sin(Math.PI * arrive))} fill="url(#hb-dot)" />
                  {arrive > 0 && arrive < 1 && <circle r={16 + 46 * arrive} fill="none" stroke="#ffd47a" strokeWidth={2.5} opacity={0.7 * (1 - arrive)} />}
                  <circle r={15} fill="#fff" stroke="#f2b01e" strokeWidth={6} />
                </g>
              </>
            )}
          </svg>

          {/* steps typography */}
          <div style={{ position: 'absolute', left: TR.cx - 200, width: 400, top: CY - 176, textAlign: 'center' }}>
            <div style={{ ...MICRO, color: 'rgba(255,255,255,0.72)', opacity: prog(gf, 442, 458, EO), transform: `translateY(${(1 - prog(gf, 442, 458, EO)) * 12}px)` }}>Pasos</div>
          </div>
          <div
            style={{
              position: 'absolute',
              left: TR.cx - 200,
              width: 400,
              top: CY - 68,
              textAlign: 'center',
              fontSize: 104,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              opacity: numInT,
              transform: `translateY(${(1 - numInT) * 18}px)`,
            }}
          >
            {fmtInt(steps)}
          </div>
          <div style={{ position: 'absolute', left: TR.cx - 200, width: 400, top: CY + 48, textAlign: 'center', fontSize: 40, fontWeight: 600, letterSpacing: '-0.01em', color: COLOR.text2, opacity: prog(gf, 450, 466, EO) }}>
            de 8.000
          </div>
          <Pill x={TR.cx} y={CY + 128} s={stepPill} color="#ffd47a" bg="rgba(242,176,30,0.18)">
            80 %
          </Pill>

          {/* one shimmer across both visuals when the values land */}
          {sheen > 0 && sheen < 1 && (
            <div style={{ position: 'absolute', left: VESSEL.x, top: VESSEL.y, width: 888, height: VESSEL.h, overflow: 'hidden', borderRadius: VESSEL.r, mixBlendMode: 'screen' }}>
              <div
                style={{
                  position: 'absolute',
                  top: -300,
                  bottom: -300,
                  left: -320 + sheen * 1500,
                  width: 220,
                  transform: 'rotate(18deg)',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                }}
              />
            </div>
          )}
        </div>

        {/* Rumbi */}
        <div
          style={{
            position: 'absolute',
            left: RB.cx - RB.size / 2,
            top: RB.top + (1 - rIn) * 90,
            opacity: clamp(rIn * 1.6),
            transform: `scale(${0.8 + 0.2 * rIn})`,
            transformOrigin: '50% 100%',
          }}
        >
          <Rumbi size={RB.size} delay={RB.delay} events={RUMBI_EVENTS} seed={53} />
        </div>

        {/* ── Headline ── */}
        <div style={{ position: 'absolute', left: 96, top: 262 }}>
          <Eyebrow text="Hábitos" at={2} />
        </div>
        <div style={{ position: 'absolute', left: 96, top: 312, width: 888 }}>
          <WordsB text="Agua y pasos," frames={[w4(0), w4(1), w4(2)]} size={104} lineHeight={0.98} />
        </div>
        <div style={{ position: 'absolute', left: 96, top: 414, width: 888 }}>
          <WordsB text="día a día." frames={[w4(3), w4(4), w4(5)]} size={104} lineHeight={0.98} accent={[0, 1, 2]} />
        </div>
        <div style={{ position: 'absolute', left: 96, top: 552, width: 888 }}>
          <WordsB text="sin complicaciones." frames={[w4(6), w4(7)]} size={40} weight={600} lineHeight={1.1} tracking="-0.01em" color="rgba(255,255,255,0.7)" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Pill({ x, y, s, color, bg, children }: { x: number; y: number; s: number; color: string; bg: string; children: string }) {
  if (s <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 70,
        width: 140,
        top: y,
        height: 48,
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        boxShadow: `inset 0 0 0 1.5px ${color}44`,
        color,
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: '0.04em',
        fontVariantNumeric: 'tabular-nums',
        opacity: clamp(s * 1.4),
        transform: `translateY(${(1 - s) * 14}px) scale(${0.85 + 0.15 * s})`,
      }}
    >
      {children}
    </div>
  );
}
