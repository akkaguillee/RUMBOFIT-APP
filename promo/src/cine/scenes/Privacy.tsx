import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Rumbi, type RumbiEvent } from '../../Rumbi';
import { easeInOut, Particles, Words } from '../../ui';
import { AppCrop, C, clamp, Ico, IC, Phone3D, phoneHeight, prog, Stage, useSpr } from '../kit';
import { length, sceneWord } from '../timing';

const LEN = length('privacy');
const w9 = (i: number) => sceneWord('privacy', 'c9', i);
// Y(0) algo(1) fundamental:(2) tu(3) privacidad.(4) Tus(5) datos(6) se(7) quedan(8) en(9) tu(10) dispositivo.(11) No(12) se(13) envían(14) ni(15) siquiera(16) al(17) desarrollador(18) de(19) la(20) aplicación.(21)

const PW = 430;
const CX = 540;
const CY = 1050;
const PH = phoneHeight(PW);
const IN = w9(5); // the data go in on «Tus datos…»
const CLOSE = w9(8);

const ORBS = [
  { d: IC.scale, color: '#fff' },
  { d: IC.droplet, color: C.water },
  { d: IC.steps, color: C.steps },
  { d: IC.dumbbell, color: '#fff' },
  { d: IC.flame, color: C.redHi },
  { d: IC.heart, color: C.redHi },
];

const RUMBI: RumbiEvent[] = [
  { at: 0, expr: 'thinking' },
  { at: 10, look: [0.5, -0.4] },
  { at: w9(4), expr: 'neutral' },
  { at: IN, look: [0.3, -0.2] },
  { at: CLOSE + 30, expr: 'proud' },
  { at: w9(12), look: [0, 0] },
  { at: w9(14), expr: 'happy' },
  { at: w9(21), tap: true },
];

/**
 * 50–60 s · Privacidad. Quieter light. The user's data orbit the phone and
 * settle inside it; a soft ring of light closes around the device while
 * Rumbi travels along it and stays beside it. The real «Datos y privacidad»
 * card from Perfil comes forward. No padlocks, no shields.
 */
export function Privacy() {
  const frame = useCurrentFrame();
  const phone = useSpr(0, { damping: 22, stiffness: 60 });
  const ring = prog(frame, CLOSE - 10, CLOSE + 40, easeInOut);
  const card = useSpr(w9(12) - 4, { damping: 20, stiffness: 90 });
  const cardOut = prog(frame, LEN - 30, LEN - 10, easeInOut);
  const out = prog(frame, LEN - 14, LEN, easeInOut);
  const glowIn = prog(frame, IN + 20, IN + 50);

  // Ring path: a rounded rectangle around the phone, drawn from the top centre down both sides.
  const m = 46;
  const rw = PW + 2 * m;
  const rh = PH + 2 * m;
  const r = PW * 0.2 + m;
  const left = CX - rw / 2;
  const top = CY - rh / 2;
  const half = `M ${CX} ${top} H ${left + rw - r} A ${r} ${r} 0 0 1 ${left + rw} ${top + r} V ${top + rh - r} A ${r} ${r} 0 0 1 ${left + rw - r} ${top + rh} H ${CX}`;
  const mirror = `M ${CX} ${top} H ${left + r} A ${r} ${r} 0 0 0 ${left} ${top + r} V ${top + rh - r} A ${r} ${r} 0 0 0 ${left + r} ${top + rh} H ${CX}`;

  // Rumbi rides the right half of the ring as it closes, then rests at the bottom left.
  const along = ring;
  const perim = [
    [CX, top - 20],
    [left + rw + 10, top + r],
    [left + rw + 10, top + rh - r],
    [CX + 60, top + rh + 10],
    [left + 40, top + rh - 30],
  ];
  const seg = Math.min(perim.length - 2, Math.floor(along * (perim.length - 1)));
  const tt = along * (perim.length - 1) - seg;
  const rx = perim[seg]![0]! + (perim[seg + 1]![0]! - perim[seg]![0]!) * tt;
  const ry = perim[seg]![1]! + (perim[seg + 1]![1]! - perim[seg]![1]!) * tt;
  // Before the ring: idle at the bottom right, then a short flight to where the ring starts.
  const idle = { x: 860, y: 1480 + Math.sin(frame / 20) * 8 };
  const fly = prog(frame, CLOSE - 26, CLOSE - 8, easeInOut);
  const ride =
    frame < CLOSE - 8
      ? { x: idle.x + (perim[0]![0]! - idle.x) * fly, y: idle.y + (perim[0]![1]! - idle.y) * fly }
      : { x: rx, y: ry };
  // When the card comes forward, Rumbi hops onto its empty top-right corner so no text is covered.
  const hop = prog(frame, w9(12) - 6, w9(12) + 12, easeInOut);
  const perch = { x: 850, y: 1098 + Math.sin(frame / 18) * 4 };
  const pos = {
    x: ride.x + (perch.x - ride.x) * hop,
    y: ride.y + (perch.y - ride.y) * hop - Math.sin(Math.PI * hop) * 90,
  };

  return (
    <AbsoluteFill>
      <Stage glow={0.38 + 0.12 * glowIn} y={0.55} warm={1} />
      <Particles seed={41} count={16} opacity={0.25} />
      <AbsoluteFill style={{ opacity: 1 - out }}>
        <div style={{ position: 'absolute', left: 96, right: 96, top: 262 }}>
          <div style={{ opacity: 1 - prog(frame, IN - 10, IN, easeInOut), position: 'absolute', left: 0, right: 0 }}>
            <Words text="Algo fundamental:" frames={[w9(1), w9(2)]} size={44} weight={700} color="rgba(255,255,255,0.7)" />
            <Words text="tu privacidad." frames={[w9(3), w9(4)]} size={92} weight={800} accent={[1]} />
          </div>
          <div style={{ opacity: prog(frame, IN - 4, IN + 6) * (1 - prog(frame, w9(12) - 8, w9(12), easeInOut)), position: 'absolute', left: 0, right: 0 }}>
            <Words text="Tus datos se quedan" frames={[w9(5), w9(6), w9(7), w9(8)]} size={70} weight={800} />
            <Words text="en tu dispositivo." frames={[w9(9), w9(10), w9(11)]} size={70} weight={800} accent={[2]} />
          </div>
          <div style={{ opacity: prog(frame, w9(12) - 4, w9(12) + 6), position: 'absolute', left: 0, right: 0 }}>
            <Words text="No se envían," frames={[w9(12), w9(13), w9(14)]} size={66} weight={800} />
            <Words text="ni siquiera al desarrollador." frames={[w9(15), w9(16), w9(17), w9(18)]} size={66} weight={800} accent={[3]} />
          </div>
        </div>

        <Phone3D
          width={PW}
          layers={[{ src: 'perfil-privacidad' }]}
          x={CX}
          y={CY + (1 - phone) * 700}
          rx={(1 - phone) * 24 + 2}
          ry={Math.sin(frame / 70) * 4}
          glow={0.35 + 0.35 * glowIn}
          opacity={1 - 0.35 * clamp(card) * (1 - cardOut)}
        />

        {/* the data orbit, then settle inside the device */}
        {ORBS.map((o, i) => {
          const a = (i / ORBS.length) * Math.PI * 2 + frame / 55;
          const inP = prog(frame, IN + i * 3, IN + 34 + i * 3, easeInOut);
          const rad = 1 - inP;
          const x = CX + Math.cos(a) * 400 * rad;
          const y = CY + Math.sin(a) * 560 * rad;
          const appear = prog(frame, 6 + i * 5, 24 + i * 5);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x - 48,
                top: y - 48,
                width: 96,
                height: 96,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(24,25,24,0.92)',
                boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,0.12), 0 0 40px -10px ${o.color}`,
                opacity: appear * (1 - prog(frame, IN + 26 + i * 3, IN + 36 + i * 3)),
                transform: `scale(${0.6 + 0.4 * appear - 0.5 * inP})`,
              }}
            >
              <Ico d={o.d} size={46} color={o.color} stroke={2.2} />
            </div>
          );
        })}

        {/* the ring of light that closes around the phone */}
        <svg style={{ position: 'absolute', inset: 0 }} width={1080} height={1920}>
          <defs>
            <filter id="priv-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>
          {[half, mirror].map((d, i) => (
            <g key={i} opacity={ring > 0 ? 1 : 0}>
              <path d={d} fill="none" stroke="#ff5a63" strokeWidth={10} filter="url(#priv-glow)" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ring} opacity={0.7 + 0.2 * Math.sin(frame / 12)} />
              <path d={d} fill="none" stroke="#ffd0d3" strokeWidth={3} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ring} />
            </g>
          ))}
        </svg>

        {/* the real card from Perfil › Datos y privacidad */}
        <div
          style={{
            position: 'absolute',
            left: 540 - 400,
            top: 1150,
            width: 800,
            opacity: clamp(card * 1.4) * (1 - cardOut),
            transform: `translateY(${(1 - card) * 160}px) scale(${0.85 + 0.15 * card})`,
          }}
        >
          <AppCrop src="perfil-privacidad" crop={{ x: 16, y: 133, w: 358, h: 230 }} width={800} style={{ left: 0, top: 0 }} radius={44} />
        </div>

        <div style={{ position: 'absolute', left: pos.x - 75, top: pos.y - 75, opacity: prog(frame, 8, 30) }}>
          <Rumbi size={150} events={RUMBI} seed={206} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
