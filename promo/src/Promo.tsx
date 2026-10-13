import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { Rumbi, type RumbiEvent } from './Rumbi';
import timeline from './timeline.json';
import { Backdrop, clamp, easeInOut, Flame, fmt, Glass, LightSweep, Phone, prog, RED, rng, RunnerLogo, useSpring, Wordmark, Words } from './ui';

const S = timeline.scenes as Record<string, [number, number]>;
const dur = (k: string) => S[k]![1] - S[k]![0];

/** Common exit: the scene lifts slightly and dissolves into the light sweep. */
function useExit(start: number, length = 10) {
  const frame = useCurrentFrame();
  const p = prog(frame, start, start + length, easeInOut);
  return { opacity: 1 - p, transform: `translateY(${-60 * p}px) scale(${1 - 0.04 * p})`, filter: `blur(${p * 10}px)` };
}

const Center = ({ y, children }: { y: number; children: ReactNode }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center' }}>{children}</div>
);

// ── 1 · Hook ─────────────────────────────────────────────────────────────
const HOOK_RUMBI: RumbiEvent[] = [
  { at: 30, look: [-0.85, -0.15] },
  { at: 44, look: [0.85, -0.3] },
  { at: 56, expr: 'thinking' },
  { at: 64, look: [0, 0] },
  { at: 68, expr: 'happy' },
  { at: 72, tap: true },
];

function Hook() {
  const frame = useCurrentFrame();
  const enter = useSpring(3, { damping: 16, stiffness: 90 });
  const exit = useExit(80);
  const float = Math.sin(frame / 14) * 10;
  return (
    <AbsoluteFill>
      <Backdrop glow={0.25 + 0.5 * prog(frame, 0, 40)} glowY={0.6} />
      <AbsoluteFill style={exit}>
        <div style={{ position: 'absolute', top: 330, left: 60, right: 60 }}>
          <Words text="¿Y si esta vez" at={9} every={[0, 6, 11, 18]} size={118} align="center" />
          <Words text="fuera diferente?" at={33} every={[0, 8]} size={118} align="center" accent={[1]} />
        </div>
        <Center y={1010 + float}>
          <div style={{ opacity: clamp(enter * 1.4), transform: `scale(${0.65 + 0.35 * enter})` }}>
            <Rumbi size={470} events={HOOK_RUMBI} delay={4} seed={21} />
          </div>
        </Center>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── 2 · Brand ────────────────────────────────────────────────────────────
const BRAND_RUMBI: RumbiEvent[] = [
  { at: 2, expr: 'happy' },
  { at: 20, tap: true },
  { at: 30, look: [0, -0.7] },
];

function Brand() {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [6, 8, 22], [0, 0.42, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rumbi = useSpring(30, { damping: 13, stiffness: 120 });
  const exit = useExit(64);
  const push = 1 + 0.03 * prog(frame, 6, 75);
  return (
    <AbsoluteFill>
      <Backdrop glow={0.5 + 0.6 * prog(frame, 4, 20)} glowY={0.5} />
      <AbsoluteFill style={{ ...exit, transform: `${exit.transform} scale(${push})` }}>
        <div style={{ position: 'absolute', top: 640, left: 0, right: 0 }}>
          <Words text="Esto es" at={7} every={4} size={58} weight={700} align="center" color="#ff6b73" />
        </div>
        <Center y={760}>
          <RunnerLogo size={330} frame={frame} at={10} />
        </Center>
        <Center y={1060}>
          <Wordmark width={820} frame={frame} at={20} sweepAt={42} id="wm-brand" />
        </Center>
        <Center y={1290 + (1 - rumbi) * 260}>
          <div style={{ opacity: clamp(rumbi * 1.5), transform: `scale(${0.5 + 0.5 * rumbi})` }}>
            <Rumbi size={200} events={BRAND_RUMBI} delay={30} seed={33} />
          </div>
        </Center>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#ff3b47', opacity: flash, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  );
}

// ── 3 · Product ──────────────────────────────────────────────────────────
const PRODUCT_LINES: { text: string; at: number; until: number; accent?: number[] }[] = [
  { text: 'Tu peso.', at: 7, until: 29 },
  { text: 'Tus hábitos.', at: 31, until: 53 },
  { text: 'Tus entrenos.', at: 55, until: 81 },
];

function StatCard({ at, y, children, height }: { at: number; y: number; height: number; children: ReactNode }) {
  const s = useSpring(at, { damping: 17, stiffness: 150 });
  return (
    <Glass
      style={{
        left: 56,
        top: y,
        width: 470,
        height,
        padding: '34px 36px',
        opacity: clamp(s * 1.3),
        transform: `translateX(${(1 - s) * -120}px) scale(${0.88 + 0.12 * s})`,
        transformOrigin: 'left center',
      }}
    >
      {children}
    </Glass>
  );
}

function Product() {
  const frame = useCurrentFrame();
  const enter = useSpring(0, { damping: 19, stiffness: 70, mass: 1.1 });
  const unite = prog(frame, 83, 100, easeInOut);
  const exit = useExit(124);
  const ry = -26 + 14 * enter + 8 * prog(frame, 20, 120) + 6 * unite;
  const rx = 30 - 24 * enter;
  const rz = 8 - 10 * enter;
  const screen = (a: number, b: number) => clamp(prog(frame, a, a + 6) - prog(frame, b, b + 6));
  const slide = (a: number) => 6 * (1 - prog(frame, a, a + 10));
  const kg = interpolate(frame, [12, 42], [90, 85.1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => 1 - Math.pow(1 - t, 3) });
  const road = prog(frame, 20, 50) * 0.49;
  const water = prog(frame, 36, 66) * 0.7;
  const ring = 2 * Math.PI * 70;
  return (
    <AbsoluteFill>
      <Backdrop glow={0.75} glowY={0.62} />
      <AbsoluteFill style={exit}>
        {/* one line at a time, big */}
        <div style={{ position: 'absolute', top: 230, left: 64, right: 64, height: 260 }}>
          {PRODUCT_LINES.map((l) => (
            <div key={l.text} style={{ position: 'absolute', inset: 0 }}>
              <Words text={l.text} at={l.at} every={5} size={130} out={l.until - 6} />
            </div>
          ))}
          <div style={{ position: 'absolute', inset: 0 }}>
            <Words text="En un solo" at={86} every={4} size={130} />
            <Words text="lugar." at={96} every={4} size={130} accent={[0]} />
          </div>
        </div>

        <div style={{ position: 'absolute', inset: 0, perspective: 2600 }}>
          <Phone
            width={540}
            style={{
              left: 470 - 40 * unite,
              top: 640 + (1 - enter) * 1400,
              transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
              transformStyle: 'preserve-3d',
            }}
            screens={[
              { src: 'dash-top', opacity: 1 - screen(29, 200) },
              { src: 'habits-water', opacity: screen(29, 53), y: slide(29) },
              { src: 'exercises', opacity: screen(53, 81), y: slide(53) },
              { src: 'progress', opacity: screen(81, 400), y: slide(81) },
            ]}
          />
        </div>

        <div style={{ transform: `translateX(${unite * 26}px)` }}>
          <StatCard at={10} y={700} height={330}>
            <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Peso actual</div>
            <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, marginTop: 6 }}>
              {fmt(kg, 1)}
              <span style={{ fontSize: 44, color: 'rgba(255,255,255,0.6)', marginLeft: 10 }}>kg</span>
            </div>
            <div style={{ height: 14, borderRadius: 99, background: 'rgba(255,255,255,0.1)', marginTop: 18, overflow: 'hidden' }}>
              <div style={{ width: `${road * 100}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, #8f182b, ${RED}, #ff6b73)` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 28, color: 'rgba(255,255,255,0.7)' }}>
              <span>{fmt(Math.round(road * 100))} % del camino</span>
              <span style={{ color: '#5fe39b', fontWeight: 700 }}>−{fmt(90 - kg, 1)} kg</span>
            </div>
          </StatCard>

          <StatCard at={33} y={1066} height={300}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
              <svg width={176} height={176} viewBox="0 0 176 176">
                <circle cx="88" cy="88" r="70" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="16" />
                <circle
                  cx="88"
                  cy="88"
                  r="70"
                  fill="none"
                  stroke="#3b8cff"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${ring * water} ${ring}`}
                  transform="rotate(-90 88 88)"
                />
                <text x="88" y="100" textAnchor="middle" fontSize="38" fontWeight="800" fill="#fff">
                  {fmt(Math.round(water * 100))}%
                </text>
              </svg>
              <div>
                <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Agua de hoy</div>
                <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: '-0.03em' }}>{fmt(water * 2.5, 2)} L</div>
                <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.6)' }}>de 2,5 L</div>
              </div>
            </div>
          </StatCard>

          <StatCard at={57} y={1402} height={210}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
              <div style={{ width: 96, height: 96, borderRadius: 30, background: 'rgba(229,57,69,0.18)', display: 'grid', placeItems: 'center' }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#ff6b73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.4 14.4 9.6 9.6M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829zM21.5 21.5l-1.4-1.4M3.9 3.9 2.5 2.5M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.02em' }}>86 ejercicios</div>
                <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.65)' }}>Series, cargas y récords</div>
              </div>
            </div>
          </StatCard>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── 4 · Streak ───────────────────────────────────────────────────────────
const STREAK_RUMBI: RumbiEvent[] = [
  { at: 2, expr: 'proud' },
  { at: 4, look: [-0.75, -0.8] },
  { at: 12, tap: true },
];

function Embers({ frame }: { frame: number }) {
  const r = rng(5);
  const parts = Array.from({ length: 22 }, () => ({ x: (r() - 0.5) * 300, d: 26 + r() * 30, s: 5 + r() * 9, o: r() * 40, w: (r() - 0.5) * 80 }));
  return (
    <>
      {parts.map((p, i) => {
        const t = ((frame + p.o) % p.d) / p.d;
        const on = prog(frame, 4, 14);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 540 + p.x + Math.sin(t * Math.PI * 2) * p.w * 0.3,
              top: 1010 - t * 520,
              width: p.s,
              height: p.s,
              borderRadius: '50%',
              background: i % 3 ? '#ffb347' : '#ff6b3d',
              boxShadow: '0 0 14px 4px rgba(255,140,60,0.6)',
              opacity: on * Math.sin(t * Math.PI) * 0.85,
            }}
          />
        );
      })}
    </>
  );
}

function Streak() {
  const frame = useCurrentFrame();
  const flame = useSpring(2, { damping: 11, stiffness: 120 });
  const count = Math.round(interpolate(frame, [6, 44], [1, 14], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => 1 - Math.pow(1 - t, 2) }));
  const rumbi = useSpring(48, { damping: 13, stiffness: 130 });
  const exit = useExit(80);
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  return (
    <AbsoluteFill>
      <Backdrop glow={0.9} glowY={0.45} hue={12} />
      <AbsoluteFill style={exit}>
        <div style={{ position: 'absolute', top: 200, left: 60, right: 60, height: 160 }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Words text="Cada día suma." at={4} every={5} size={104} align="center" out={34} />
          </div>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Words text="Enciende tu racha." at={40} every={[0, 9, 13]} size={104} align="center" accent={[2]} />
          </div>
        </div>
        <Embers frame={frame} />
        <Center y={560}>
          <div style={{ transform: `scale(${flame})`, transformOrigin: '50% 100%' }}>
            <Flame size={360} frame={frame} />
          </div>
        </Center>
        <Center y={1030}>
          <div style={{ textAlign: 'center', opacity: prog(frame, 6, 14) }}>
            <div style={{ fontSize: 230, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 0.95, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
            <div style={{ fontSize: 52, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>días de racha</div>
          </div>
        </Center>
        <Center y={1440}>
          <div style={{ display: 'flex', gap: 22 }}>
            {days.map((d, i) => {
              const lit = springAt(frame, 22 + i * 4);
              return (
                <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, opacity: prog(frame, 14 + i * 2, 22 + i * 2) }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: lit > 0.5 ? '#fff' : 'rgba(255,255,255,0.5)' }}>{d}</span>
                  <div
                    style={{
                      width: 104,
                      height: 104,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: `rgba(255,138,31,${0.16 * lit})`,
                      boxShadow: `inset 0 0 0 2px rgba(255,${138 + 80 * (1 - lit)},${31 + 200 * (1 - lit)},${0.25 + 0.3 * lit})`,
                    }}
                  >
                    <div style={{ transform: `scale(${lit})` }}>
                      <Flame size={44} frame={frame} seed={i + 3} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Center>
        <div style={{ position: 'absolute', left: 790, top: 1640 + (1 - rumbi) * 400, opacity: clamp(rumbi * 1.5) }}>
          <Rumbi size={220} events={STREAK_RUMBI} delay={48} seed={44} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Plain-function spring value (usable inside loops). */
function springAt(frame: number, at: number) {
  const t = Math.max(0, frame - at) / 30;
  if (frame < at) return 0;
  return 1 - Math.exp(-t * 9) * Math.cos(t * 14);
}

// ── 5 · Rumbi's tip ─────────────────────────────────────────────────────
const TIP_RUMBI: RumbiEvent[] = [
  { at: 0, expr: 'encouraging' },
  { at: 28, look: [0, 0.9] },
  { at: 62, tap: true },
  { at: 70, expr: 'happy' },
  { at: 92, look: [0, 0] },
  { at: 98, expr: 'proud' },
];

const TIP_BODY = 'Llevas 5 días seguidos registrando algo. Asocia el registro a algo que ya haces, como el café de la mañana, y saldrá casi solo.';

function Tip() {
  const frame = useCurrentFrame();
  const enter = useSpring(0, { damping: 17, stiffness: 80 });
  const card = useSpring(20, { damping: 18, stiffness: 120 });
  const exit = useExit(108);
  const words = TIP_BODY.split(' ');
  return (
    <AbsoluteFill>
      <Backdrop glow={0.7} glowY={0.32} />
      <AbsoluteFill style={exit}>
        <div style={{ position: 'absolute', top: 150, left: 60, right: 60 }}>
          <Words text="Rumbi te guía" at={12} every={[0, 5, 10]} size={108} align="center" accent={[0]} />
          <Words text="cada día." at={50} every={5} size={108} align="center" />
        </div>
        <Center y={430 + (1 - enter) * 900}>
          <div style={{ transform: `translateX(${(1 - enter) * -420}px) scale(${0.55 + 0.45 * enter}) translateY(${Math.sin(frame / 13) * 8}px)` }}>
            <Rumbi size={360} events={TIP_RUMBI} expression="encouraging" seed={55} />
          </div>
        </Center>
        <Glass
          radius={56}
          style={{
            left: 64,
            right: 64,
            top: 880,
            height: 560,
            padding: '48px 52px',
            opacity: clamp(card * 1.3),
            transform: `translateY(${(1 - card) * 160}px) scale(${0.94 + 0.06 * card})`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 40, fontWeight: 800 }}>Tu consejo de hoy</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#ff6b73' }}>
              Rumbi <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>· Constancia</span>
            </div>
          </div>
          <div style={{ height: 1.5, background: 'rgba(255,255,255,0.12)', margin: '30px 0 34px' }} />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: '-0.03em', transform: `translateY(${(1 - prog(frame, 32, 46)) * 110}%)` }}>Vas cogiendo ritmo</div>
          </div>
          <div style={{ marginTop: 24, fontSize: 44, lineHeight: 1.38, color: 'rgba(255,255,255,0.78)' }}>
            {words.map((w, i) => {
              const p = prog(frame, 40 + i * 2.1, 50 + i * 2.1);
              return (
                <span key={i} style={{ opacity: p, filter: `blur(${(1 - p) * 4}px)`, display: 'inline-block', marginRight: 12 }}>
                  {w}
                </span>
              );
            })}
          </div>
        </Glass>
        {/* speech tail towards Rumbi */}
        <div
          style={{
            position: 'absolute',
            left: 540 - 26,
            top: 852,
            width: 52,
            height: 52,
            transform: `rotate(45deg) scale(${card})`,
            background: 'rgba(255,255,255,0.12)',
            borderTop: '1.5px solid rgba(255,255,255,0.3)',
            borderLeft: '1.5px solid rgba(255,255,255,0.3)',
            borderRadius: 8,
            backdropFilter: 'blur(28px)',
            opacity: clamp(card * 1.3),
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── 6 · End card ────────────────────────────────────────────────────────
const END_RUMBI: RumbiEvent[] = [
  { at: 2, expr: 'happy' },
  { at: 46, tap: true },
  { at: 62, expr: 'proud' },
];

function End() {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [2, 4, 18], [0, 0.35, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rumbi = useSpring(4, { damping: 12, stiffness: 120 });
  const outro = prog(frame, 84, 90);
  return (
    <AbsoluteFill>
      <Backdrop glow={0.85} glowY={0.46} />
      <AbsoluteFill style={{ opacity: 1 - outro * 0.0 }}>
        <Center y={430 + (1 - rumbi) * 120}>
          <div style={{ opacity: clamp(rumbi * 1.5), transform: `scale(${0.6 + 0.4 * rumbi})` }}>
            <Rumbi size={240} events={END_RUMBI} delay={4} seed={66} />
          </div>
        </Center>
        <Center y={760}>
          <RunnerLogo size={300} frame={frame} at={4} />
        </Center>
        <Center y={1030}>
          <Wordmark width={760} frame={frame} at={9} sweepAt={50} id="wm-end" />
        </Center>
        <div style={{ position: 'absolute', top: 1250, left: 60, right: 60 }}>
          <Words text="Ahora es el momento" at={8} every={[0, 6, 9, 12]} size={70} weight={700} align="center" />
          <Words text="de encontrar el tuyo." at={33} every={[0, 4, 12, 15]} size={70} weight={700} align="center" accent={[2, 3]} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#ff3b47', opacity: flash, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  );
}

export function Promo() {
  return (
    <AbsoluteFill style={{ background: '#050507', fontFamily: 'Inter, system-ui, sans-serif', color: '#fff' }}>
      <Sequence from={S.hook![0]} durationInFrames={dur('hook')}>
        <Hook />
      </Sequence>
      <Sequence from={S.brand![0]} durationInFrames={dur('brand')}>
        <Brand />
      </Sequence>
      <Sequence from={S.product![0]} durationInFrames={dur('product')}>
        <Product />
      </Sequence>
      <Sequence from={S.streak![0]} durationInFrames={dur('streak')}>
        <Streak />
      </Sequence>
      <Sequence from={S.tip![0]} durationInFrames={dur('tip')}>
        <Tip />
      </Sequence>
      <Sequence from={S.end![0]} durationInFrames={dur('end')}>
        <End />
      </Sequence>
      {timeline.cuts.map((c) => (
        <LightSweep key={c} at={c - 7} />
      ))}
    </AbsoluteFill>
  );
}
