import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { COLOR, sceneLength, SAFE, wordAt } from '../design';
import { Rumbi, type RumbiEvent } from '../Rumbi';
import { Backdrop, clamp, drawn, easeInOut, Eyebrow, fmt, Glass, Particles, prog, rng, useSpring, Words } from '../ui';
import { ICON, Icon, SceneWrap, Spark } from './LeadShared';

const LEN = sceneLength('training');
const W = (i: number) => wordAt('v5', i, 'training'); // Registra cada serie y supera tus marcas.

const SETS = [
  { n: 1, kg: 40, reps: 12, done: 30 },
  { n: 2, kg: 45, reps: 10, done: 44 },
  { n: 3, kg: 50, reps: 8, done: 58 },
];
const PR = W(6); // "marcas."

const RUMBI: RumbiEvent[] = [
  { at: 4, expr: 'thinking' },
  { at: 10, look: [-0.9, -0.5] },
  { at: 30, look: [-0.8, -0.3] },
  { at: 44, look: [-0.8, -0.1] },
  { at: 58, look: [-0.6, 0.1] },
  { at: PR - 14, expr: 'surprised' },
  { at: PR - 12, look: [-0.5, 0.4] },
  { at: PR - 6, tap: true },
  { at: PR + 4, expr: 'proud' },
  { at: PR + 20, look: [0, 0] },
];

function SetRow({ n, kg, reps, done, y }: { n: number; kg: number; reps: number; done: number; y: number }) {
  const frame = useCurrentFrame();
  const enter = useSpring(14 + n * 4, { damping: 18, stiffness: 140 });
  const check = prog(frame, done, done + 12);
  const fill = prog(frame, done - 2, done + 6);
  const sweep = prog(frame, done, done + 16, easeInOut);
  const isPr = n === 3;
  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top: y,
        height: 112,
        borderRadius: 28,
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        gap: 28,
        opacity: clamp(enter * 1.3),
        transform: `translateX(${(1 - enter) * 60}px)`,
        background: `linear-gradient(90deg, rgba(79,224,143,${0.16 * fill}) ${sweep * 100}%, rgba(255,255,255,0.045) ${sweep * 100}%)`,
        boxShadow: `inset 0 0 0 1.5px rgba(${fill > 0.5 ? '79,224,143' : '255,255,255'},${0.08 + 0.18 * fill})`,
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 700, color: COLOR.text2 }}>
        {n}
      </div>
      <div style={{ flex: 1, fontSize: 46, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {kg} kg <span style={{ color: COLOR.text3, fontWeight: 600 }}>×</span> {reps}
        {isPr && (
          <span
            style={{
              marginLeft: 20,
              fontSize: 26,
              fontWeight: 700,
              color: '#ffcf5c',
              letterSpacing: '0.04em',
              opacity: prog(frame, PR, PR + 8),
            }}
          >
            MARCA
          </span>
        )}
      </div>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: fill > 0 ? `rgba(79,224,143,${fill})` : 'transparent',
          boxShadow: `inset 0 0 0 2.5px rgba(255,255,255,${0.25 * (1 - fill)})`,
          transform: `scale(${1 + 0.18 * Math.sin(Math.PI * check)})`,
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#06150d" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" {...drawn(check)} />
        </svg>
      </div>
    </div>
  );
}

function RestTimer() {
  const frame = useCurrentFrame();
  const on = prog(frame, 32, 42);
  // Real rest timer: 1:30 after the first set, counting down live.
  const elapsed = Math.max(0, frame - 34) / 30;
  const left = Math.max(0, 90 - elapsed);
  const r = 34;
  const c = 2 * Math.PI * r;
  const p = left / 90;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: on, transform: `translateY(${(1 - on) * 10}px)` }}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={COLOR.redHi} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 42 42)" />
      </svg>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.14em', color: COLOR.text3 }}>DESCANSO</div>
        <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {Math.floor(left / 60)}:{String(Math.floor(left % 60)).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}

function RecordBurst({ x, y }: { x: number; y: number }) {
  const frame = useCurrentFrame();
  const t = prog(frame, PR, PR + 22);
  const r = rng(9);
  const rays = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + r() * 0.2, l: 70 + r() * 70 }));
  if (frame < PR || t >= 1) return null;
  return (
    <svg style={{ position: 'absolute', left: x - 260, top: y - 260, overflow: 'visible' }} width="520" height="520">
      {rays.map((ray, i) => {
        const r0 = 90 + t * 120;
        const r1 = r0 + ray.l * (1 - t);
        return (
          <line
            key={i}
            x1={260 + Math.cos(ray.a) * r0}
            y1={260 + Math.sin(ray.a) * r0}
            x2={260 + Math.cos(ray.a) * r1}
            y2={260 + Math.sin(ray.a) * r1}
            stroke={i % 2 ? '#ffcf5c' : COLOR.redHi}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={1 - t}
          />
        );
      })}
      <circle cx="260" cy="260" r={90 + t * 150} fill="none" stroke="#ffcf5c" strokeWidth={3} opacity={(1 - t) * 0.7} />
    </svg>
  );
}

export function Training() {
  const frame = useCurrentFrame();
  const card = useSpring(6, { damping: 19, stiffness: 110 });
  const chip = useSpring(22, { damping: 16, stiffness: 120 });
  const pr = useSpring(PR, { damping: 12, stiffness: 160 });
  const rumbi = useSpring(16, { damping: 14, stiffness: 120 });
  const dim = prog(frame, W(4), W(4) + 10);
  // Match cut: the record's light condenses into a spark that travels to where the flame ignites.
  const sparkT = prog(frame, LEN - 16, LEN, easeInOut);
  const sparkX = interpolate(sparkT, [0, 1], [300, 540]);
  const sparkY = interpolate(sparkT, [0, 1], [1360, 900]);
  const cardTop = 620;
  return (
    <AbsoluteFill>
      <Backdrop glow={0.72} glowY={0.58} />
      <Particles seed={51} count={18} opacity={0.35} />
      <SceneWrap length={LEN} exit={10}>
        <div style={{ position: 'absolute', left: SAFE.left, top: SAFE.top + 20, right: SAFE.left }}>
          <Eyebrow text="Entrenamiento" at={2} />
          <div style={{ marginTop: 28, opacity: 1 - 0.62 * dim }}>
            <Words text="Cada serie." frames={[W(1), W(2)]} size={110} />
          </div>
          <Words text="Cada marca." frames={[W(5), W(6)]} size={110} accent={[1]} />
        </div>

        <Glass
          radius={52}
          style={{
            left: SAFE.left,
            top: cardTop,
            width: SAFE.right - SAFE.left,
            height: 620,
            opacity: clamp(card * 1.3),
            transform: `translateY(${(1 - card) * 120}px) scale(${0.95 + 0.05 * card})`,
          }}
        >
          <div style={{ position: 'absolute', left: 44, top: 40, right: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <div style={{ width: 76, height: 76, borderRadius: 24, background: 'rgba(229,57,69,0.18)', display: 'grid', placeItems: 'center' }}>
                <Icon d={ICON.dumbbell} size={42} color={COLOR.redSoft} />
              </div>
              <div>
                <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.05 }}>Press banca</div>
                <div style={{ fontSize: 28, color: COLOR.text3, marginTop: 4 }}>Barra · Peso y repeticiones</div>
              </div>
            </div>
            <RestTimer />
          </div>
          {SETS.map((s, i) => (
            <SetRow key={s.n} {...s} y={190 + i * 132} />
          ))}
        </Glass>

        <div
          style={{
            position: 'absolute',
            right: SAFE.left + 24,
            top: cardTop - 76,
            padding: '14px 26px',
            borderRadius: 999,
            background: 'rgba(20,20,26,0.82)',
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.14), 0 20px 40px -18px rgba(0,0,0,0.9)',
            fontSize: 28,
            fontWeight: 700,
            opacity: clamp(chip * 1.4),
            transform: `translateY(${(1 - chip) * 30 + Math.sin(frame / 20) * 4}px)`,
          }}
        >
          86 ejercicios base
        </div>

        <RecordBurst x={SAFE.left + 130} y={1372} />
        <Glass
          radius={40}
          style={{
            left: SAFE.left,
            top: 1290,
            width: 640,
            height: 168,
            padding: '0 36px',
            display: 'flex',
            alignItems: 'center',
            gap: 26,
            opacity: clamp(pr * 1.4),
            transform: `scale(${0.7 + 0.3 * pr})`,
            transformOrigin: '20% 50%',
            background: 'linear-gradient(120deg, rgba(255,207,92,0.22), rgba(255,255,255,0.06))',
          }}
        >
          <div style={{ width: 92, height: 92, borderRadius: '50%', background: 'linear-gradient(160deg, #ffe08a, #f2a51d)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Icon d={ICON.trophy} size={50} color="#3a2400" strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }}>Nueva marca personal</div>
            <div style={{ fontSize: 30, color: COLOR.text2, marginTop: 4 }}>
              Press banca · <span style={{ color: '#ffcf5c', fontWeight: 700 }}>{fmt(50)} kg</span>
            </div>
          </div>
        </Glass>

        <div style={{ position: 'absolute', left: 790, top: 1300 + (1 - rumbi) * 260, opacity: clamp(rumbi * 1.5) }}>
          <Rumbi size={170} events={RUMBI} seed={71} />
        </div>
      </SceneWrap>
      {sparkT > 0 && <Spark x={sparkX} y={sparkY} size={60 + 140 * sparkT} opacity={Math.sin(Math.PI * Math.min(1, sparkT * 1.2)) * 0.9 + sparkT * 0.1} />}
    </AbsoluteFill>
  );
}
