import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { COLOR, sceneLength, SAFE, wordAt } from '../design';
import { Rumbi, type RumbiEvent } from '../Rumbi';
import { Backdrop, clamp, easeInOut, Glass, Particles, prog, useSpring, Words } from '../ui';
import { SceneWrap } from './LeadShared';

const LEN = sceneLength('rumbi');
const W = (i: number) => wordAt('v7', i, 'rumbi'); // Y Rumbi, tu compañero, te da un consejo pensado para ti cada día.
const TIP_TITLE = 'Vas cogiendo ritmo';
const TIP_BODY = 'Llevas 5 días seguidos registrando algo. Asocia el registro a algo que ya haces, como el café de la mañana, y saldrá casi solo.';

const RUMBI: RumbiEvent[] = [
  { at: 2, expr: 'encouraging' },
  { at: 16, look: [-0.7, -0.85] },
  { at: 40, look: [0, 0] },
  { at: W(4) - 2, expr: 'thinking' },
  { at: W(7), look: [0, 0.95] },
  { at: W(8), expr: 'happy' },
  { at: W(8) + 2, look: [0, 0] },
  { at: W(11) - 4, tap: true },
  { at: W(12), expr: 'proud' },
  { at: LEN - 22, tap: true },
];

export function RumbiScene() {
  const frame = useCurrentFrame();
  const enter = useSpring(4, { damping: 13, stiffness: 90, mass: 1 });
  const card = useSpring(W(4) - 2, { damping: 17, stiffness: 120 });
  const title = prog(frame, W(6), W(6) + 14);
  const words = TIP_BODY.split(' ');
  const bob = Math.sin(frame / 14) * 8;
  // Match cut to the end card: Rumbi's light opens up and fills the frame.
  const bloom = prog(frame, LEN - 16, LEN, easeInOut);
  const rumbiY = 560;
  return (
    <AbsoluteFill>
      <Backdrop glow={0.7} glowY={0.36} />
      <Particles seed={91} count={20} opacity={0.4} />
      <SceneWrap length={LEN} exit={12}>
        <div style={{ position: 'absolute', left: SAFE.left, right: SAFE.left, top: SAFE.top + 20 }}>
          <Words text="Rumbi," frames={[W(1)]} size={112} accent={[0]} />
          <Words text="tu compañero." frames={[W(2), W(3)]} size={112} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 540 - 180,
            top: rumbiY + bob,
            transform: `translateX(${(1 - enter) * 620}px) rotate(${(1 - enter) * 25}deg) scale(${0.7 + 0.3 * enter})`,
          }}
        >
          <Rumbi size={360} events={RUMBI} seed={95} delay={2} />
        </div>

        <Glass
          radius={52}
          style={{
            left: SAFE.left,
            right: SAFE.left,
            top: 1000,
            height: 480,
            padding: '44px 48px',
            opacity: clamp(card * 1.3),
            transform: `translateY(${(1 - card) * 140}px) scale(${0.94 + 0.06 * card})`,
            transformOrigin: '50% 0%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 34, fontWeight: 800 }}>Tu consejo de hoy</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: COLOR.redSoft }}>
              Rumbi <span style={{ color: COLOR.text3, fontWeight: 600 }}>· Constancia</span>
            </div>
          </div>
          <div style={{ height: 1.5, background: COLOR.hairline, margin: '26px 0 30px', transformOrigin: 'left', transform: `scaleX(${prog(frame, W(4) + 4, W(4) + 20)})` }} />
          <div style={{ overflow: 'hidden', paddingBottom: 6 }}>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em', transform: `translateY(${(1 - title) * 110}%)` }}>{TIP_TITLE}</div>
          </div>
          <div style={{ marginTop: 18, fontSize: 38, lineHeight: 1.4, color: COLOR.text2 }}>
            {words.map((w, i) => {
              const p = prog(frame, W(7) + 4 + i * 1.6, W(7) + 12 + i * 1.6);
              return (
                <span key={i} style={{ display: 'inline-block', marginRight: 11, opacity: p, transform: `translateY(${(1 - p) * 10}px)`, filter: `blur(${(1 - p) * 3}px)` }}>
                  {w}
                </span>
              );
            })}
          </div>
        </Glass>
        {/* speech tail pointing at Rumbi */}
        <div
          style={{
            position: 'absolute',
            left: 540 - 24,
            top: 976,
            width: 48,
            height: 48,
            transform: `rotate(45deg) scale(${clamp(card)})`,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))',
            borderTop: '1.5px solid rgba(255,255,255,0.32)',
            borderLeft: '1.5px solid rgba(255,255,255,0.32)',
            borderRadius: 8,
            backdropFilter: 'blur(28px)',
            opacity: clamp(card * 1.3),
          }}
        />
      </SceneWrap>
      {bloom > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 540 - 200,
            top: rumbiY + 180 - 200,
            width: 400,
            height: 400,
            borderRadius: '50%',
            transform: `scale(${interpolate(bloom, [0, 1], [0.3, 7])})`,
            background: 'radial-gradient(closest-side, rgba(255,235,235,0.95), rgba(255,90,99,0.55) 45%, rgba(229,57,69,0) 75%)',
            opacity: Math.sin(Math.PI * Math.min(1, bloom * 0.9 + 0.1)) * 0.9 + bloom * 0.1,
          }}
        />
      )}
    </AbsoluteFill>
  );
}
