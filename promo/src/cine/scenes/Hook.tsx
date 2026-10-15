import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Rumbi, type RumbiEvent } from '../../Rumbi';
import { Particles, prog } from '../../ui';
import { C, clamp, KLine, keys, Stage, useSpr } from '../kit';
import { length, sceneWord } from '../timing';

const LEN = length('hook');
const w2 = (i: number) => sceneWord('hook', 'c2', i); // Pero para avanzar de verdad, necesitas algo más que motivación.

/** Heartbeat: lub (0) and dub (+9) every 38 frames, the first three only. */
const BEATS = [0, 38, 76];
const pulse = (f: number) =>
  BEATS.reduce((a, b) => a + Math.exp(-Math.max(0, f - b) / 7) * (f >= b ? 1 : 0) + 0.6 * Math.exp(-Math.max(0, f - b - 9) / 7) * (f >= b + 9 ? 1 : 0), 0);

const RUMBI: RumbiEvent[] = [
  { at: 0, expr: 'sleepy' },
  { at: 52, expr: 'neutral' },
  { at: 60, look: [0, 0] },
  { at: 150, look: [0, -0.8] },
  { at: 190, look: [0, 0] },
  { at: 200, expr: 'encouraging' },
  { at: 236, tap: true },
];

/**
 * 0–9 s · El gancho. Black screen, a heartbeat, a small red light that grows
 * into Rumbi, who looks at the viewer. «TU CAMBIO MERECE SER MEDIDO» rises;
 * on «motivación» a measuring rule draws under it and «MEDIDO» turns red.
 */
export function Hook() {
  const frame = useCurrentFrame();
  const p = pulse(frame);
  const light = prog(frame, 10, 22) * (1 - prog(frame, 44, 70));
  const born = useSpr(46, { damping: 15, stiffness: 70 });
  const glow = 0.05 + 0.2 * p * (1 - prog(frame, 80, 100)) + 0.55 * prog(frame, 50, 130);
  const rule = prog(frame, w2(8), w2(8) + 28);
  const push = keys(frame, [
    [0, 1.06],
    [LEN, 1],
  ]);
  const exit = prog(frame, LEN - 14, LEN);
  return (
    <AbsoluteFill>
      <Stage glow={glow} y={0.53} rays={prog(frame, 120, 220) * 0.6} />
      <Particles seed={3} count={20} opacity={0.35 * prog(frame, 60, 120)} />
      <AbsoluteFill style={{ transform: `scale(${push})`, opacity: 1 - exit * 0.6 }}>
        {/* the first light: a small red point that beats */}
        <div
          style={{
            position: 'absolute',
            left: 540 - 60,
            top: 1010 - 60,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(255,220,220,1), rgba(255,69,82,0.9) 35%, rgba(229,57,69,0.35) 65%, transparent)',
            opacity: light,
            transform: `scale(${0.25 + 0.5 * light + 0.35 * p})`,
            filter: 'blur(1px)',
          }}
        />
        {/* Rumbi is born from the light and looks at you */}
        <div
          style={{
            position: 'absolute',
            left: 540 - 160,
            top: 1010 - 160,
            opacity: clamp(born * 1.4),
            transform: `scale(${0.3 + 0.7 * born}) translateY(${Math.sin(frame / 26) * 6}px)`,
            filter: `blur(${(1 - clamp(born * 1.2)) * 12}px)`,
          }}
        >
          <Rumbi size={320} events={RUMBI} seed={201} />
        </div>
        <div style={{ position: 'absolute', left: 96, right: 96, top: 330 }}>
          <KLine text="TU CAMBIO" frames={[70, 80]} size={96} out={LEN - 16} />
          <KLine text="MERECE SER" frames={[92, 100]} size={96} out={LEN - 14} />
          <KLine text="MEDIDO" frames={[114]} size={96} accent={frame >= w2(8) ? [0] : []} out={LEN - 12} />
          {/* measuring rule */}
          <svg width={888} height={70} style={{ display: 'block', margin: '26px auto 0', overflow: 'visible', opacity: 1 - exit }}>
            <line x1={0} y1={20} x2={888 * rule} y2={20} stroke="rgba(255,255,255,0.55)" strokeWidth={3} strokeLinecap="round" />
            {Array.from({ length: 23 }, (_, i) => {
              const x = (888 / 22) * i;
              const on = rule > 0 && rule * 888 >= x;
              return <line key={i} x1={x} y1={20} x2={x} y2={i % 5 === 0 ? 50 : 36} stroke="rgba(255,255,255,0.5)" strokeWidth={2.5} opacity={on ? 1 : 0} />;
            })}
            <circle cx={888 * rule} cy={20} r={10} fill={C.redHi} opacity={rule > 0 && rule < 1 ? 1 : rule >= 1 ? 1 : 0} />
            <circle cx={888 * rule} cy={20} r={22} fill="none" stroke={C.redHi} strokeWidth={2} opacity={rule >= 1 ? 0.5 + 0.3 * Math.sin(frame / 6) : 0} />
          </svg>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
