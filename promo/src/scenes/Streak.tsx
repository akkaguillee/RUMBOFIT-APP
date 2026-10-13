import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR, sceneLength, SAFE, wordAt } from '../design';
import { Rumbi, type RumbiEvent } from '../Rumbi';
import { Backdrop, clamp, Eyebrow, Flame, Glass, prog, rng, useSpring, Words } from '../ui';
import { ICON, Icon, SceneWrap, Spark } from './LeadShared';

const LEN = sceneLength('streak');
const W = (i: number) => wordAt('v6', i, 'streak'); // Cada día suma. Enciende tu racha y desbloquea hitos.
const IGNITE = W(3); // "Enciende"
const UNLOCK = W(7); // "desbloquea"
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const RUMBI: RumbiEvent[] = [
  { at: 2, expr: 'encouraging' },
  { at: 6, look: [0.9, -0.2] },
  { at: IGNITE - 2, expr: 'surprised' },
  { at: IGNITE + 6, expr: 'proud' },
  { at: IGNITE + 22, tap: true },
  { at: UNLOCK, look: [0.4, 0.9] },
  { at: UNLOCK + 30, look: [0, 0] },
  { at: UNLOCK + 32, expr: 'happy' },
];

function Embers({ frame, from }: { frame: number; from: number }) {
  const r = rng(77);
  const parts = Array.from({ length: 26 }, () => ({ x: (r() - 0.5) * 260, d: 28 + r() * 30, s: 4 + r() * 8, o: r() * 40 }));
  const on = prog(frame, from, from + 10);
  if (on <= 0) return null;
  return (
    <>
      {parts.map((p, i) => {
        const t = ((frame - from + p.o) % p.d) / p.d;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 540 + p.x + Math.sin(t * 6.28 + i) * 14,
              top: 960 - t * 460,
              width: p.s,
              height: p.s,
              borderRadius: '50%',
              background: i % 3 ? '#ffb347' : '#ff6b3d',
              boxShadow: '0 0 12px 3px rgba(255,140,60,0.55)',
              opacity: on * Math.sin(t * Math.PI) * 0.8,
            }}
          />
        );
      })}
    </>
  );
}

export function Streak() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lit = spring({ frame: frame - IGNITE, fps, config: { damping: 10, stiffness: 110 } });
  const before = frame < IGNITE;
  const count = Math.round(interpolate(frame, [IGNITE + 4, IGNITE + 44], [1, 14], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => 1 - Math.pow(1 - t, 2.2) }));
  const counterIn = prog(frame, IGNITE + 2, IGNITE + 12);
  const card = useSpring(UNLOCK, { damping: 15, stiffness: 130 });
  const rumbi = useSpring(8, { damping: 14, stiffness: 120 });
  const burst = prog(frame, IGNITE, IGNITE + 20);
  const ember = prog(frame, 0, 10);
  const flameScale = before ? 0.42 : 0.42 + 0.58 * lit;
  return (
    <AbsoluteFill>
      <Backdrop glow={0.45 + 0.55 * clamp(lit)} glowY={0.45} hue={12} />
      <SceneWrap length={LEN} enter={0} exit={10}>
        <div style={{ position: 'absolute', left: SAFE.left, top: SAFE.top + 20, right: SAFE.left }}>
          <Eyebrow text="Constancia" at={2} />
          <div style={{ position: 'relative', marginTop: 28, height: 240 }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <Words text="Cada día suma." frames={[W(0), W(1), W(2)]} size={110} out={IGNITE - 8} />
            </div>
            <div style={{ position: 'absolute', inset: 0 }}>
              <Words text="Enciende" frames={[W(3)]} size={110} />
              <Words text="tu racha." frames={[W(4), W(5)]} size={110} accent={[1]} />
            </div>
          </div>
        </div>

        <Embers frame={frame} from={IGNITE} />
        {/* ignition ring */}
        {burst > 0 && burst < 1 && (
          <div
            style={{
              position: 'absolute',
              left: 540 - 200 - burst * 220,
              top: 860 - 200 - burst * 220,
              width: 400 + burst * 440,
              height: 400 + burst * 440,
              borderRadius: '50%',
              boxShadow: `inset 0 0 0 ${4 * (1 - burst)}px rgba(255,190,90,${0.8 * (1 - burst)})`,
            }}
          />
        )}
        <div style={{ position: 'absolute', left: 540 - 140, top: 640, width: 280, height: 325, display: 'grid', placeItems: 'end center' }}>
          <div
            style={{
              transform: `scale(${flameScale})`,
              transformOrigin: '50% 100%',
              filter: before ? 'grayscale(1) brightness(0.55)' : `grayscale(${1 - clamp(lit * 1.5)})`,
              opacity: before ? 0.5 + 0.5 * ember : 1,
            }}
          >
            <Flame size={280} frame={frame} />
          </div>
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, top: 958, textAlign: 'center', opacity: counterIn, transform: `translateY(${(1 - counterIn) * 30}px)` }}>
          <div style={{ fontSize: 160, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 0.92, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: COLOR.text2, marginTop: 6 }}>días de racha</div>
        </div>

        <div style={{ position: 'absolute', left: SAFE.left, right: SAFE.left, top: 1190, display: 'flex', justifyContent: 'space-between' }}>
          {DAYS.map((d, i) => {
            const at = IGNITE + 10 + i * 4;
            const s = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 160 } });
            return (
              <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: prog(frame, 6 + i * 2, 16 + i * 2) }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: s > 0.5 ? '#fff' : COLOR.text3 }}>{d}</span>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: `rgba(255,138,31,${0.16 * clamp(s)})`,
                    boxShadow: `inset 0 0 0 2px rgba(255,${Math.round(138 + 90 * (1 - clamp(s)))},${Math.round(31 + 200 * (1 - clamp(s)))},${0.2 + 0.3 * clamp(s)})`,
                  }}
                >
                  <div style={{ transform: `scale(${Math.max(0, s)})` }}>
                    <Flame size={42} frame={frame} seed={i + 4} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Glass
          radius={40}
          style={{
            left: SAFE.left,
            right: SAFE.left,
            top: 1352,
            height: 136,
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            opacity: clamp(card * 1.4),
            transform: `translateY(${(1 - card) * 60}px) scale(${0.92 + 0.08 * card})`,
          }}
        >
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'linear-gradient(160deg, #ffe08a, #f2a51d)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Icon d={ICON.medal} size={44} color="#3a2400" strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Dos Semanas de Rumbo</div>
            <div style={{ fontSize: 26, color: COLOR.text3, marginTop: 2 }}>Constancia · 20 de 85 hitos</div>
          </div>
          <div style={{ padding: '10px 18px', borderRadius: 999, background: 'rgba(79,224,143,0.16)', color: COLOR.good, fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon d={ICON.check} size={24} color={COLOR.good} strokeWidth={3} />
            Desbloqueado
          </div>
        </Glass>

        <div style={{ position: 'absolute', left: 130, top: 800 + (1 - rumbi) * 240, opacity: clamp(rumbi * 1.5) }}>
          <Rumbi size={170} events={RUMBI} seed={81} />
        </div>
      </SceneWrap>
      {/* the spark from the previous scene lands and becomes the ember */}
      {frame < 10 && <Spark x={540} y={900} size={200 - 120 * ember} opacity={1 - ember} />}
    </AbsoluteFill>
  );
}
