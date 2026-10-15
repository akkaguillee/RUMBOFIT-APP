import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Rumbi, type RumbiEvent } from '../../Rumbi';
import { easeInOut, Particles, Words } from '../../ui';
import { AppCrop, C, clamp, prog, Stage } from '../kit';
import { length, sceneWord } from '../timing';

const LEN = length('effort');
const w7 = (i: number) => sceneWord('effort', 'c7', i);
// Controla(0) aquello(1) que(2) importa,(3) reconoce(4) tus(5) avances(6) y(7) descubre(8) cómo(9) pequeños(10) pasos,(11) repetidos(12) cada(13) día,(14) pueden(15) acercarte(16) a(17) tu(18) objetivo.(19)

/** Real pieces of the app, laid out on a wide strip the camera travels along. */
const ITEMS = [
  { src: 'entreno-stats', crop: { x: 16, y: 301, w: 358, h: 280 }, width: 760, at: w7(0) },
  { src: 'habitos-agua', crop: { x: 16, y: 291, w: 358, h: 418 }, width: 600, at: w7(2) },
  { src: 'habitos-pasos', crop: { x: 16, y: 291, w: 358, h: 418 }, width: 600, at: w7(3) },
  { src: 'hitos', crop: { x: 16, y: 267, w: 358, h: 352 }, width: 660, at: w7(4) },
  { src: 'inicio-streak', crop: { x: 16, y: 90, w: 358, h: 240 }, width: 820, at: w7(6) },
  { src: 'inicio-body', crop: { x: 16, y: 357, w: 358, h: 151 }, width: 840, at: w7(10) },
  { src: 'inicio-top', crop: { x: 16, y: 393, w: 358, h: 318 }, width: 760, at: w7(16) },
];
const GAP = 900;
const X = ITEMS.map((_, i) => 540 + i * GAP);

const RUMBI: RumbiEvent[] = [
  { at: 0, expr: 'happy' },
  { at: 6, look: [0.8, -0.3] },
  { at: w7(6) - 2, expr: 'surprised' },
  { at: w7(6) + 4, tap: true },
  { at: w7(6) + 8, expr: 'proud' },
  { at: w7(10), expr: 'encouraging' },
  { at: w7(16), look: [0.7, -0.5] },
  { at: w7(19), expr: 'proud' },
  { at: w7(19) + 6, tap: true },
];

const LINES = [
  { text: 'Controla lo que importa.', f: [w7(0), w7(1), w7(2), w7(3)], accent: [3], from: w7(0), to: w7(4) },
  { text: 'Reconoce tus avances.', f: [w7(4), w7(5), w7(6)], accent: [2], from: w7(4), to: w7(10) },
  { text: 'Pequeños pasos, cada día.', f: [w7(10), w7(11), w7(13), w7(14)], accent: [2, 3], from: w7(10), to: w7(16) },
  { text: 'Más cerca de tu objetivo.', f: [w7(16), w7(16) + 4, w7(17), w7(18), w7(19)], accent: [4], from: w7(16), to: LEN + 20 },
];

/**
 * 31,5–42 s · Todo tu esfuerzo cuenta. The camera travels along a strip of
 * real screens (training stats, water, steps, milestones, streak, week,
 * goal gauge) joined by a red line; each lands on its word.
 */
export function Effort() {
  const frame = useCurrentFrame();
  // Camera: each item centred when its word is spoken.
  const pan = interpolate(
    frame,
    [0, ...ITEMS.map((it) => it.at + 6), LEN],
    [X[0]! - 540 - 300, ...X.map((x) => x - 540), X[X.length - 1]! - 540 + 80],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeInOut },
  );
  const out = prog(frame, LEN - 14, LEN, easeInOut);
  const rumbiIn = prog(frame, 6, 30);
  const flame = prog(frame, w7(6) + 2, w7(6) + 18);

  return (
    <AbsoluteFill>
      <Stage glow={0.6} y={0.56} rays={0.3} />
      <Particles seed={21} count={24} opacity={0.35} />
      <AbsoluteFill style={{ opacity: 1 - out }}>
        {/* the thread that joins every piece */}
        <svg style={{ position: 'absolute', left: 0, top: 0 }} width={1080} height={1920}>
          <line x1={X[0]! - pan - 400} y1={960} x2={X[X.length - 1]! - pan + 400} y2={960} stroke="rgba(255,90,99,0.35)" strokeWidth={3} strokeDasharray="4 14" />
          {ITEMS.map((it, i) => {
            const on = prog(frame, it.at - 4, it.at + 8);
            return <circle key={i} cx={X[i]! - pan} cy={960} r={8 + 6 * on} fill={on > 0.5 ? '#ff5a63' : 'rgba(255,90,99,0.4)'} />;
          })}
        </svg>

        {ITEMS.map((it, i) => {
          const sx = X[i]! - pan;
          const dx = (sx - 540) / 540;
          const appear = prog(frame, it.at - 12, it.at + 6);
          const k = it.width / it.crop.w;
          const h = it.crop.h * k;
          return (
            <div
              key={it.src + i}
              style={{
                position: 'absolute',
                left: sx - it.width / 2,
                top: 960 - h / 2,
                width: it.width,
                height: h,
                opacity: clamp(appear * 1.5) * clamp(1.6 - Math.abs(dx)),
                transform: `perspective(1800px) rotateY(${-dx * 28}deg) scale(${(0.8 + 0.2 * appear) * (1 - Math.min(0.25, Math.abs(dx) * 0.18))}) translateY(${(1 - appear) * 80}px)`,
                filter: `blur(${Math.min(6, Math.abs(dx) * 5)}px)`,
              }}
            >
              <AppCrop src={it.src} crop={it.crop} width={it.width} style={{ left: 0, top: 0 }} radius={34} />
            </div>
          );
        })}

        {/* streak: a warm glow when the streak lands */}
        {flame > 0 && (
          <div
            style={{
              position: 'absolute',
              left: X[4]! - pan - 520,
              top: 960 - 420,
              width: 1040,
              height: 840,
              borderRadius: '50%',
              background: 'radial-gradient(closest-side, rgba(255,140,60,0.32), transparent 70%)',
              opacity: flame * (1 - prog(frame, w7(8), w7(10))),
              mixBlendMode: 'screen',
            }}
          />
        )}

        <div style={{ position: 'absolute', left: 96, right: 96, top: 300 }}>
          {LINES.map((l) => {
            const vis = prog(frame, l.from - 2, l.from + 6) * (1 - prog(frame, l.to - 8, l.to, easeInOut));
            if (vis <= 0) return null;
            return (
              <div key={l.text} style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: vis }}>
                <Words text={l.text} frames={l.f} size={70} weight={800} accent={l.accent} />
              </div>
            );
          })}
        </div>

        <div style={{ position: 'absolute', left: 120, top: 1330 + (1 - rumbiIn) * 200, opacity: rumbiIn, transform: `translateY(${Math.sin(frame / 20) * 6}px)` }}>
          <Rumbi size={170} events={RUMBI} seed={204} />
        </div>
        <div style={{ position: 'absolute', left: 96, top: 1488, fontSize: 22, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>Pantallas reales de RUMBO con datos de ejemplo</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const _c = C;
