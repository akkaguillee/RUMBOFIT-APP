import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Rumbi, type RumbiEvent } from '../../Rumbi';
import { Counter, easeInOut, Particles, Words } from '../../ui';
import { C, Card, clamp, Ico, IC, keys, Label, Phone3D, prog, Stage, useSpr, windowed } from '../kit';
import { length, sceneWord } from '../timing';

const LEN = length('evolution');
const w5 = (i: number) => sceneWord('evolution', 'c5', i); // Registra tus datos, sigue tus objetivos y observa cómo evoluciona tu esfuerzo.
const w6 = (i: number) => sceneWord('evolution', 'c6', i); // Tanto si quieres perder grasa como ganar masa muscular, convierte cada registro…

/** The example data loaded for the captures: 90 → 85,4 kg over 60 days. */
const NOISE = [0.3, -0.2, 0.4, 0.1, -0.3, 0.2, 0.5, -0.1, 0.2, -0.4, 0.3, 0.1, -0.2, 0.2];
const SERIES: { day: number; kg: number }[] = [
  { day: 60, kg: 90 },
  ...Array.from({ length: 19 }, (_, k) => {
    const day = 57 - 3 * k;
    return { day, kg: Math.round((90 - (4.6 * (60 - day)) / 60 + NOISE[k % NOISE.length]!) * 10) / 10 };
  }),
  { day: 0, kg: 85.4 },
];
const LOGS = [
  { date: '15 oct', kg: '85,4' },
  { date: '12 oct', kg: '85,3' },
  { date: '9 oct', kg: '86,0' },
  { date: '6 oct', kg: '86,5' },
];

const RUMBI: RumbiEvent[] = [
  { at: 0, expr: 'happy' },
  { at: 20, look: [0.6, -0.4] },
  { at: 150, look: [-0.5, 0.6] },
  { at: w6(3), expr: 'encouraging' },
  { at: w6(3), look: [-0.4, -0.7] },
  { at: w6(6), look: [-0.4, -0.4] },
  { at: w6(16), expr: 'proud' },
];

function Chart({ frame }: { frame: number }) {
  const w = 440;
  const h = 200;
  const draw = prog(frame, 30, 190, easeInOut);
  const pts = SERIES.map((p) => ({ x: ((60 - p.day) / 60) * w, y: ((90.6 - p.kg) / 6.4) * h }));
  const n = Math.max(2, Math.ceil(draw * pts.length));
  const shown = pts.slice(0, n);
  const d = shown.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const last = shown[shown.length - 1]!;
  const goalY = ((90.6 - 78) / 6.4) * h;
  return (
    <svg width={w} height={h + 20} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="evo-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(229,57,69,0.35)" />
          <stop offset="1" stopColor="rgba(229,57,69,0)" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={0} x2={w} y1={(h / 3) * i} y2={(h / 3) * i} stroke="rgba(255,255,255,0.07)" strokeWidth={2} />
      ))}
      <line x1={0} x2={w} y1={Math.min(goalY, h + 10)} y2={Math.min(goalY, h + 10)} stroke="rgba(184,240,85,0.6)" strokeWidth={2} strokeDasharray="8 10" />
      <path d={`${d} L ${last.x} ${h} L 0 ${h} Z`} fill="url(#evo-fill)" />
      <path d={d} fill="none" stroke="#ff5a63" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      {shown.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === shown.length - 1 ? 9 : 4} fill={i === shown.length - 1 ? '#fff' : '#ff8a8f'} />
      ))}
      <circle cx={last.x} cy={last.y} r={22} fill="none" stroke="#ff5a63" strokeWidth={3} opacity={0.4 + 0.3 * Math.sin(frame / 5)} />
    </svg>
  );
}

function GoalChip({ label, icon, color, at, frame }: { label: string; icon: string[]; color: string; at: number; frame: number }) {
  const s = useSpr(at, { damping: 16, stiffness: 140 });
  const line = prog(frame, at + 6, at + 30, easeInOut);
  const up = icon === IC.trendUp;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        padding: '22px 34px 22px 22px',
        borderRadius: 999,
        background: 'rgba(24,25,24,0.9)',
        boxShadow: `inset 0 0 0 2px ${color}55, 0 30px 60px -30px rgba(0,0,0,0.9), 0 0 60px -20px ${color}66`,
        opacity: clamp(s * 1.4),
        transform: `translateX(${(1 - s) * -80}px) scale(${0.9 + 0.1 * s})`,
        width: 'fit-content',
      }}
    >
      <div style={{ width: 76, height: 76, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `${color}22` }}>
        <Ico d={icon} size={42} color={color} stroke={2.4} />
      </div>
      <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.025em' }}>{label}</div>
      <svg width={120} height={60} style={{ marginLeft: 6 }}>
        <path
          d={up ? 'M4 54 C 40 50, 60 30, 116 8' : 'M4 8 C 40 12, 60 32, 116 54'}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - line}
        />
      </svg>
    </div>
  );
}

/**
 * 18–31,5 s · Tu evolución. Real Progreso screens on the phone; next to it the
 * weight curve builds point by point, entries drop into a timeline and the
 * figures count. Then the two goals, fat loss and muscle gain, as paths.
 */
export function Evolution() {
  const frame = useCurrentFrame();
  const phone = useSpr(0, { damping: 20, stiffness: 70 });
  const card = useSpr(22, { damping: 18, stiffness: 90 });
  const part1 = 1 - prog(frame, w6(0) - 16, w6(0) - 2, easeInOut);
  const part2 = prog(frame, w6(0) - 6, w6(0) + 8);
  const scroll = prog(frame, 120, 175, easeInOut);
  const out = prog(frame, LEN - 14, LEN, easeInOut);
  const rumbi = useSpr(w6(2), { damping: 14, stiffness: 100 });

  return (
    <AbsoluteFill>
      <Stage glow={0.62} x={0.62} y={0.58} rays={0.35} />
      <Particles seed={14} count={18} opacity={0.3} />
      <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${1 + 0.03 * out})` }}>
        {/* Part 1 · register, follow, observe */}
        <div style={{ position: 'absolute', left: 96, right: 96, top: 270, opacity: part1 }}>
          {[
            { text: 'Registra tus datos.', f: [w5(0), w5(1), w5(2)], accent: [2] },
            { text: 'Sigue tus objetivos.', f: [w5(3), w5(4), w5(5)], accent: [2] },
            { text: 'Observa cómo evoluciona tu esfuerzo.', f: [w5(7), w5(8), w5(9), w5(10), w5(11)], accent: [4] },
          ].map((l, i, all) => {
            const next = all[i + 1];
            const dim = next ? prog(frame, next.f[0]!, next.f[0]! + 10) : 0;
            return (
              <div key={l.text} style={{ opacity: 1 - 0.55 * dim, marginBottom: 4 }}>
                <Words text={l.text} frames={l.f} size={60} weight={800} accent={l.accent} />
              </div>
            );
          })}
        </div>

        {/* entries dropping into a timeline */}
        <div style={{ position: 'absolute', left: 96, top: 650, width: 440, opacity: part1 }}>
          <div style={{ position: 'absolute', left: 17, top: 10, width: 3, height: 330 * prog(frame, 50, 110), background: 'linear-gradient(180deg, #ff5a63, rgba(255,90,99,0.1))', borderRadius: 2 }} />
          {LOGS.map((l, i) => {
            const at = 54 + i * 12;
            const s = useSprSafe(frame, at);
            return (
              <div key={l.date} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22, height: 82, opacity: clamp(s * 1.5), transform: `translateY(${(1 - s) * -40}px)` }}>
                <div style={{ width: 37, height: 37, borderRadius: '50%', background: i === 0 ? '#ff5a63' : 'rgba(255,90,99,0.25)', boxShadow: i === 0 ? '0 0 24px rgba(255,90,99,0.7)' : undefined, flex: 'none' }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 24px', borderRadius: 22, background: 'rgba(24,25,24,0.88)', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.07)' }}>
                  <span style={{ fontSize: 28, color: C.text2, fontWeight: 600 }}>{l.date}</span>
                  <span style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {l.kg} <span style={{ fontSize: 24, color: C.text3, fontWeight: 600 }}>kg</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Part 2 · two goals, one way of understanding the path */}
        <div style={{ position: 'absolute', left: 96, right: 96, top: 290, display: 'flex', flexDirection: 'column', gap: 30, opacity: part2 }}>
          <GoalChip label="Perder grasa" icon={IC.trendDown} color="#ff5a63" at={w6(3)} frame={frame} />
          <GoalChip label="Ganar masa muscular" icon={IC.trendUp} color={C.progress} at={w6(6)} frame={frame} />
          <div style={{ marginTop: 26 }}>
            <Words text="Entiende mejor tu camino." frames={[w6(16), w6(16) + 4, w6(17), w6(19)]} size={60} weight={800} accent={[3]} />
          </div>
        </div>

        <Phone3D
          width={410}
          layers={[
            { src: 'progreso-top', opacity: 1 - scroll },
            { src: 'progreso-chart', opacity: scroll, y: (1 - scroll) * 6 },
          ]}
          x={812 + (1 - phone) * 300}
          y={1110 + Math.sin(frame / 50) * 8}
          rx={6}
          ry={interpolate(phone, [0, 1], [-40, -18]) + Math.sin(frame / 70) * 2}
          rz={2}
          glow={0.45}
        />

        {/* the curve, built point by point */}
        <Card
          style={{
            left: 64,
            top: 1070,
            width: 520,
            height: 390,
            padding: '32px 40px',
            opacity: clamp(card * 1.4),
            transform: `translateY(${(1 - card) * 120}px) rotate(${(1 - card) * -4}deg)`,
          }}
        >
          <Label>Evolución del peso</Label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 10 }}>
            <span style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff' }}>
              −<Counter from={0} to={4.6} at={40} dur={150} decimals={1} />
            </span>
            <span style={{ fontSize: 32, color: C.text3, fontWeight: 700 }}>kg · 60 días</span>
          </div>
          <div style={{ marginTop: 22 }}>
            <Chart frame={frame} />
          </div>
        </Card>

        <div style={{ position: 'absolute', left: 860, top: 1440 + (1 - rumbi) * 200, opacity: clamp(rumbi * 1.5) }}>
          <Rumbi size={150} events={RUMBI} seed={203} />
        </div>

        <div style={{ position: 'absolute', left: 96, top: 1488, fontSize: 22, color: 'rgba(255,255,255,0.45)', fontWeight: 600, opacity: windowed(frame, 20, LEN, 14) }}>
          Pantallas reales de RUMBO con datos de ejemplo
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Spring evaluated inline (keeps hooks out of the map above). */
function useSprSafe(frame: number, at: number) {
  const t = Math.max(0, frame - at) / 30;
  return t <= 0 ? 0 : 1 - Math.exp(-t * 9) * Math.cos(t * 14);
}

export const _keys = keys;
