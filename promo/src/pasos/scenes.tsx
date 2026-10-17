import type { CSSProperties, ReactNode } from 'react';
import { spring } from 'remotion';
import { krophedWidth } from '../../../src/brand/krophed';
import { accentAt, BEAT, cubicPath, hookLight, hookPath, screenPoint, w } from './choreo';
import { CHART, CHIPS, column, CROP, HOY, onScreen, places, TAP } from './geo';
import { clamp, Crop, DemoTag, easeInOut, Headline, keys, Logo, Phone, phoneGeom, prog, Ripple, Sparkle, Trail, useT, windowed } from './kit';
import { BRAND_GRAD, C, FONT, FPS, useLayout, type Layout } from './theme';

const v = <T,>(L: Layout, story: T, feed: T): T => (L.format === 'story' ? story : feed);

/** Largest Krophed size (px) at which `text` fits `width`. */
function fitK(text: string, width: number, max: number) {
  return Math.min(max, width / (krophedWidth(text) + 0.02 * text.length));
}

/** The headline band at the top of the frame. */
function Head({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const L = useLayout();
  return (
    <div style={{ position: 'absolute', left: L.left, width: L.right - L.left, top: L.headY, height: L.headH, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', ...style }}>
      {children}
    </div>
  );
}

/** A lifted card that springs out of the phone into the right-hand column. */
function Lift({ crop, at, out, y, from }: { crop: (typeof CROP)[keyof typeof CROP]; at: number; out: number; y: number; from: { x: number; y: number } }) {
  const f = useT();
  const fps = FPS;
  const L = useLayout();
  const col = column(L);
  if (f < at - 1 || f > out + 20) return null;
  const s = spring({ frame: f - at, fps, config: { damping: 22, stiffness: 110, mass: 1 } });
  const leave = prog(f, out, out + 18, easeInOut);
  return (
    <Crop
      src={crop.src}
      crop={crop.r}
      width={col.w}
      x={from.x + (col.x - from.x) * s + leave * 60}
      y={from.y + (y - from.y) * s}
      scale={0.55 + 0.45 * s - leave * 0.06}
      opacity={clamp(s * 1.6) * (1 - leave)}
      ry={(1 - s) * -24}
      glow={0.35}
    />
  );
}

/* ═══ 1 · Hook ═══════════════════════════════════════════════════════════ */
export function Hook() {
  const f = useT();
  const L = useLayout();
  if (f > 300) return null;
  const light = hookLight(L);
  const lightIn = prog(f, BEAT.light, BEAT.light + 16);
  const pulse = 1 + Math.sin(f / 6) * 0.14;
  const draw = prog(f, BEAT.trail[0], BEAT.trail[1], easeInOut);
  const fade = 1 - prog(f, 248, 276);
  const logoY = v(L, 345, 142);
  const lineY = v(L, 1118, 852);
  const size = v(L, 92, 74);
  return (
    <>
      {f < BEAT.trail[0] + 6 && (
        <div
          style={{
            position: 'absolute',
            left: light.x - 60,
            top: light.y - 60,
            width: 120,
            height: 120,
            borderRadius: '50%',
            opacity: lightIn * (1 - prog(f, BEAT.trail[0], BEAT.trail[0] + 6)),
            transform: `scale(${(0.3 + 0.7 * lightIn) * pulse})`,
            background: `radial-gradient(closest-side, #fff, ${C.lav}dd 30%, ${C.violet}55 62%, transparent)`,
          }}
        />
      )}
      {f >= BEAT.trail[0] && <Trail d={hookPath(L)} to={draw} opacity={fade} />}
      {f >= BEAT.logo - 2 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: logoY, display: 'flex', justifyContent: 'center', transform: `translateY(-50%) translateY(${-prog(f, 262, 292) * 40}px)`, opacity: 1 - prog(f, 262, 290) }}>
          <Logo width={v(L, 330, 270)} at={BEAT.logo} />
        </div>
      )}
      <div style={{ position: 'absolute', left: L.left, right: L.W - L.right, top: lineY, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.1 }}>
        <Headline text="TU CAMINO." at={w('l1', 10) + 2} out={254} size={size} />
        <Headline text="TU RUMBO." at={w('l1', 14)} out={258} size={size} accent={[1]} />
      </div>
    </>
  );
}

/* ═══ 2 · A companion: the path becomes the phone ════════════════════════ */
export function AppScene() {
  const f = useT();
  const L = useLayout();
  if (f < 270 || f > 620) return null;
  const width = L.right - L.left;
  const words: [string, number, number][] = [
    ['REGISTRA.', w('l2', 4), w('l2', 8) - 6],
    ['OBSERVA.', w('l2', 10), w('l2', 15) - 6],
    ['SIGUE ADELANTE.', w('l2', 15), 586],
  ];
  return (
    <>
      <Head>
        {words.map(([text, at, out]) =>
          f >= at - 2 && f < out + 22 ? (
            <div key={text} style={{ position: 'absolute' }}>
              <Headline text={text} at={at} out={out} size={fitK(text, width, L.display)} accent={text === 'SIGUE ADELANTE.' ? [1] : []} />
            </div>
          ) : null,
        )}
      </Head>
      <DemoTag x={L.right} y={v(L, 1296, 1150)} at={340} out={590} align="right" />
    </>
  );
}

/* ═══ 3 · Evolution, with context ════════════════════════════════════════ */
export function Evolution() {
  const f = useT();
  const L = useLayout();
  if (f < 600 || f > 1060) return null;
  const P = places(L).evolution;
  const from = { x: P.x, y: P.y };
  return (
    <>
      <Head>
        <Headline text="Tu evolución, paso a paso." upper={false} at={w('l3', 0)} out={BEAT.zoomChart[0] - 10} size={v(L, 60, 52)} accent={[2, 3, 4]} stagger={3} />
      </Head>
      <Lift crop={CROP.imc} at={BEAT.imc} out={BEAT.zoomChart[0] - 4} y={v(L, 700, 430)} from={from} />
      <Lift crop={CROP.kcal} at={BEAT.kcal} out={BEAT.zoomChart[0]} y={v(L, 965, 640)} from={from} />
      <DemoTag x={L.right} y={v(L, 1296, 1150)} at={640} out={1036} align="right" />
    </>
  );
}

/* ═══ 4 · Training ═══════════════════════════════════════════════════════ */
export function Training() {
  const f = useT();
  const fps = FPS;
  const L = useLayout();
  if (f < 1040 || f > 1510) return null;
  const P = places(L).training;
  const col = column(L);
  const k = phoneGeom(P.w).k;
  // The template card slides in, then settles onto the session header it becomes.
  const sIn = spring({ frame: f - BEAT.cardIn[0], fps, config: { damping: 22, stiffness: 100 } });
  const settle = prog(f, BEAT.toSession[0] - 6, BEAT.toSession[1], easeInOut);
  const head = onScreen(P, 195, 98);
  const cardX = L.W + 260 + (col.x - L.W - 260) * sIn;
  const cardW = col.w + (CROP.template.r.w * k - col.w) * settle;
  const tokens: [string, number][] = [
    ['RUTINAS', w('l4', 4)],
    ['SERIES', BEAT.setDone + 2],
    ['MARCAS', w('l4', 7)],
  ];
  const size = fitK('RUTINAS SERIES MARCAS', L.right - L.left - 70, 64);
  return (
    <>
      <Head>
        <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.42, opacity: 1 - prog(f, 1470, 1496) }}>
          {tokens.map(([t, at], i) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: size * 0.42 }}>
              {i > 0 && <span style={{ width: size * 0.2, height: size * 0.2, borderRadius: '50%', background: C.violetHi, opacity: prog(f, at - 4, at + 6), transform: `scale(${prog(f, at - 4, at + 8)})` }} />}
              <Headline text={t} at={at} size={size} accent={t === 'MARCAS' ? [0] : []} />
            </div>
          ))}
        </div>
      </Head>
      {f >= BEAT.cardIn[0] && f < BEAT.toSession[1] + 2 && (
        <Crop
          src={CROP.template.src}
          crop={CROP.template.r}
          width={cardW}
          x={cardX + (head.x - cardX) * settle}
          y={v(L, 760, 470) + (head.y - v(L, 760, 470)) * settle}
          opacity={1 - prog(f, BEAT.toSession[1] - 6, BEAT.toSession[1] + 2)}
          ry={(1 - sIn) * -30}
          glow={0.5}
        />
      )}
      <Lift crop={CROP.records} at={BEAT.records} out={BEAT.history[0] + 6} y={v(L, 720, 450)} from={{ x: P.x, y: P.y }} />
      <Lift crop={CROP.stats} at={BEAT.stats} out={1468} y={v(L, 740, 460)} from={{ x: P.x, y: P.y }} />
      <DemoTag x={L.right} y={v(L, 1296, 1150)} at={1060} out={1490} align="right" />
    </>
  );
}

/* ═══ 5 · Habits and consistency ═════════════════════════════════════════ */
function Glass({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 3h14l-1.6 16.2a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8Z" fill={`${C.water}33`} stroke="#8fb8ff" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M6.2 10.5c2-.9 3.9-.9 5.8 0s3.8.9 5.8 0l-.9 8.6a1.4 1.4 0 0 1-1.4 1.3H8.5a1.4 1.4 0 0 1-1.4-1.3Z" fill={C.water} />
    </svg>
  );
}

function Footprint({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.steps} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" fill={`${C.steps}33`} />
      <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" fill={`${C.steps}33`} />
    </svg>
  );
}

export function Habits() {
  const f = useT();
  const fps = FPS;
  const L = useLayout();
  if (f < 1500 || f > 1930) return null;
  const P = places(L).habits;
  const col = column(L);
  const water = screenPoint(f, L, HOY.water.x, HOY.water.y);
  const steps = screenPoint(f, L, HOY.steps.x, HOY.steps.y);
  const icons = [
    { kind: 'glass', x: col.x - v(L, 110, 100), y: v(L, 640, 400), at: BEAT.icons, to: water, go: BEAT.iconsWater },
    { kind: 'glass', x: col.x, y: v(L, 600, 370), at: BEAT.icons + 5, to: water, go: BEAT.iconsWater + 3 },
    { kind: 'glass', x: col.x + v(L, 110, 100), y: v(L, 640, 400), at: BEAT.icons + 10, to: water, go: BEAT.iconsWater + 6 },
    { kind: 'step', x: col.x - v(L, 60, 55), y: v(L, 800, 540), at: w('l5', 3), to: steps, go: BEAT.iconsSteps },
    { kind: 'step', x: col.x + v(L, 70, 60), y: v(L, 840, 570), at: w('l5', 3) + 6, to: steps, go: BEAT.iconsSteps + 4 },
  ];
  const isz = v(L, 92, 76);
  return (
    <>
      {icons.map((ic, i) => {
        if (f < ic.at || f > ic.go + 16) return null;
        const s = spring({ frame: f - ic.at, fps, config: { damping: 16, stiffness: 130 } });
        const t = prog(f, ic.go, ic.go + 14, easeInOut);
        const bob = Math.sin((f + i * 11) / 14) * 8 * (1 - t);
        const x = ic.x + (ic.to.x - ic.x) * t;
        const y = ic.y + (ic.to.y - ic.y) * t - Math.sin(Math.PI * t) * 90 + bob;
        const sc = s * (1 - 0.55 * t);
        return (
          <div key={i} style={{ position: 'absolute', left: x - isz / 2, top: y - isz / 2, transform: `scale(${sc})`, opacity: 1 - prog(f, ic.go + 8, ic.go + 15), filter: `drop-shadow(0 12px 20px rgba(0,0,0,0.6))` }}>
            {ic.kind === 'glass' ? <Glass size={isz} /> : <Footprint size={isz} />}
          </div>
        );
      })}
      <Lift crop={CROP.streak} at={BEAT.streak} out={BEAT.calendar - 4} y={v(L, 730, 460)} from={{ x: P.x, y: P.y }} />
      {f > BEAT.streak && f < BEAT.streak + 60 && <Sparkle x={col.x - col.w * 0.33} y={v(L, 730, 460) - col.w * 0.12} at={w('l5', 14)} radius={110} seed={5} />}
      <Head>
        <Headline text="La constancia también suma." upper={false} at={w('l5', 16)} out={1904} size={v(L, 60, 52)} accent={[1]} stagger={3} />
      </Head>
      <DemoTag x={L.right} y={v(L, 1296, 1150)} at={1520} out={1910} align="right" />
    </>
  );
}

/* ═══ 6 · Your style: accent colour and theme ════════════════════════════ */
export function StyleBack() {
  const f = useT();
  const fps = FPS;
  const L = useLayout();
  if (f < BEAT.fan[0] - 2 || f > BEAT.fan[1] + 30) return null;
  const P = places(L).style;
  const fan: [string, number, number][] = [
    ['inicio-naranja', -1, 0],
    ['inicio-fucsia', 1, 8],
    ['inicio-volt', -2, 16],
  ];
  return (
    <>
      {fan.map(([src, side, delay]) => {
        const s = spring({ frame: f - BEAT.fan[0] - delay, fps, config: { damping: 20, stiffness: 90 } });
        const back = prog(f, BEAT.fan[1] - delay / 2, BEAT.fan[1] + 22 - delay / 2, easeInOut);
        const t = s * (1 - back);
        const dx = side * v(L, 205, 175) * t;
        return (
          <Phone
            key={src}
            width={P.w * 0.78}
            x={P.x + dx}
            y={P.y + Math.abs(side) * 30 * t}
            rz={side * 8 * t}
            ry={side * -12 * t}
            opacity={clamp(t * 2)}
            glow={0.3}
            glowColor={src === 'inicio-naranja' ? '#ff6a1a' : src === 'inicio-fucsia' ? '#f0287a' : '#c8f53a'}
            layers={[{ src }]}
          />
        );
      })}
    </>
  );
}

export function Style() {
  const f = useT();
  const L = useLayout();
  if (f < 1920 || f > 2320) return null;
  return (
    <>
      <Head>
        <Headline text="A TU ESTILO." at={w('l6', 1)} out={2296} size={L.display} accent={[2]} />
      </Head>
      <DemoTag x={L.right} y={v(L, 1296, 1150)} at={1950} out={2300} align="right" />
    </>
  );
}

/* ═══ 7 · Privacy, only what the code proves ═════════════════════════════ */
export function Privacy() {
  const f = useT();
  const fps = FPS;
  const L = useLayout();
  if (f < 2300 || f > 2700) return null;
  const P = places(L).privacy;
  const k = phoneGeom(P.w).k;
  const orbit = [
    { x: P.x - v(L, 330, 330), y: P.y - v(L, 300, 230) },
    { x: P.x + v(L, 330, 330), y: P.y - v(L, 380, 280) },
    { x: P.x - v(L, 320, 320), y: P.y + v(L, 230, 160) },
    { x: P.x + v(L, 320, 330), y: P.y + v(L, 150, 120) },
  ];
  const chipSize = v(L, 112, 92);
  return (
    <>
      {CHIPS.map((c, i) => {
        const at = BEAT.chipsIn[0] + i * 8;
        if (f < at) return null;
        const s = spring({ frame: f - at, fps, config: { damping: 18, stiffness: 110 } });
        const home = onScreen(P, c.x + c.w / 2, c.y + c.h / 2);
        const go = BEAT.chipsHome[0] + i * 5;
        const t = prog(f, go, go + 22, easeInOut);
        const drift = Math.sin((f + i * 20) / 22) * 10 * (1 - t);
        const o = orbit[i]!;
        const width = chipSize + (c.w * k - chipSize) * t;
        return (
          <Crop
            key={i}
            src="inicio-violeta"
            crop={c}
            width={width}
            x={o.x + (home.x - o.x) * t}
            y={o.y + (home.y - o.y) * t + drift}
            radius={14}
            scale={s}
            opacity={clamp(s * 1.5) * (1 - prog(f, go + 20, go + 26))}
            glow={0.5 * (1 - t)}
          />
        );
      })}
      <Head style={{ justifyContent: 'flex-start', paddingTop: v(L, 10, 0) }}>
        <Headline text="Tus registros se guardan en este dispositivo." upper={false} at={w('l7', 4)} size={v(L, 54, 46)} accent={[5, 6]} stagger={3} out={2664} style={{ maxWidth: v(L, 760, 820), rowGap: 0 }} />
        <div
          style={{
            marginTop: v(L, 22, 12),
            maxWidth: v(L, 760, 820),
            textAlign: 'center',
            fontFamily: FONT.sans,
            fontSize: v(L, 29, 26),
            lineHeight: 1.32,
            fontWeight: 500,
            color: C.text2,
            opacity: prog(f, BEAT.saved + 18, BEAT.saved + 32) * (1 - prog(f, 2664, 2680)),
            textWrap: 'balance',
          }}
        >
          El escáner de comidas, opcional, se conecta a internet para identificar alimentos.
        </div>
      </Head>
      <DemoTag x={L.right} y={v(L, 1296, 1150)} at={2340} out={2656} align="right" />
    </>
  );
}

/* ═══ 8 · Close and call to action ═══════════════════════════════════════ */
export function Close({ url }: { url: string }) {
  const f = useT();
  const fps = FPS;
  const L = useLayout();
  if (f < 2690) return null;
  const cards = [
    { crop: CROP.exercise, at: BEAT.cardA, x: v(L, 330, 290), y: v(L, 650, 360), w: v(L, 370, 300), rz: -5 },
    { crop: CROP.chart, at: BEAT.cardB, x: v(L, 735, 760), y: v(L, 905, 560), w: v(L, 360, 300), rz: 4 },
    { crop: CROP.streak, at: BEAT.cardC, x: v(L, 350, 300), y: v(L, 1170, 820), w: v(L, 380, 300), rz: -3 },
  ];
  const away = prog(f, BEAT.closeTrail[0], BEAT.closeTrail[0] + 22, easeInOut);
  const logoY = v(L, 700, 380);
  const trail = v(L, 'M 700 1070 C 640 980, 420 960, 430 840 C 440 740, 540 720, 540 690', 'M 720 820 C 660 740, 420 700, 430 560 C 440 470, 540 440, 540 400');
  const tagY = v(L, 962, 590);
  const ctaY = v(L, 1082, 690);
  const cta = spring({ frame: f - BEAT.cta, fps, config: { damping: 18, stiffness: 120 } });
  return (
    <>
      {cards.map((c, i) => {
        if (f < c.at - 1 || away >= 1) return null;
        const s = spring({ frame: f - c.at, fps, config: { damping: 20, stiffness: 120 } });
        return (
          <Crop
            key={i}
            src={c.crop.src}
            crop={c.crop.r}
            width={c.w}
            x={c.x + (540 - c.x) * away * 0.4}
            y={c.y + (1 - s) * 120 + (logoY - c.y) * away * 0.4}
            rz={c.rz * s}
            scale={(0.8 + 0.2 * s) * (1 - 0.25 * away)}
            opacity={clamp(s * 1.6) * (1 - away)}
            glow={0.45}
          />
        );
      })}
      {f >= BEAT.closeTrail[0] && <Trail d={trail} to={prog(f, ...BEAT.closeTrail, easeInOut)} opacity={1 - prog(f, BEAT.logoEnd + 14, BEAT.logoEnd + 34)} />}
      {f >= BEAT.logoEnd - 2 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: logoY, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)' }}>
          <Logo width={v(L, 520, 440)} at={BEAT.logoEnd} />
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: tagY,
          textAlign: 'center',
          fontFamily: FONT.sans,
          fontWeight: 700,
          fontSize: v(L, 34, 30),
          textTransform: 'uppercase',
          color: C.lavender,
          letterSpacing: `${0.32 + 0.6 * (1 - prog(f, BEAT.tagline, BEAT.tagline + 34))}em`,
          opacity: prog(f, BEAT.tagline - 2, BEAT.tagline + 18),
          transform: 'translateY(-50%)',
          paddingLeft: '0.32em',
        }}
      >
        Cada pequeño paso cuenta
      </div>
      {f >= BEAT.cta - 1 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: ctaY, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: v(L, 26, 18), transform: 'translateY(-50%)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: v(L, '26px 56px', '22px 48px'),
              borderRadius: 999,
              background: `linear-gradient(135deg, ${C.violetHi}, ${C.violetLo})`,
              boxShadow: `0 24px 60px -18px ${C.violet}cc, inset 0 1.5px 0 rgba(255,255,255,0.35)`,
              color: '#fff',
              fontFamily: FONT.sans,
              fontWeight: 760,
              fontSize: v(L, 46, 40),
              letterSpacing: '-0.02em',
              transform: `scale(${0.85 + 0.15 * cta})`,
              opacity: clamp(cta * 1.5),
            }}
          >
            Empieza hoy
            <svg width={v(L, 40, 34)} height={v(L, 40, 34)} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
          <div style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: v(L, 34, 30), color: C.text2, letterSpacing: '0.01em', opacity: prog(f, BEAT.cta + 10, BEAT.cta + 26) }}>{url}</div>
        </div>
      )}
      {f >= w('l8', 7) && f < w('l8', 7) + 50 && <Sparkle x={v(L, 700, 720)} y={v(L, 1070, 820) - 40} at={w('l8', 7)} radius={120} seed={9} />}
    </>
  );
}

/* ═══ Inside the screen: chart drawing, taps, the save glow ══════════════ */
export function ScreenOverlay({ width }: { width: number }) {
  const f = useT();
  const g = phoneGeom(width);
  const k = g.k;
  const pt = (x: number, y: number) => ({ x: x * k, y: (47 + y) * k });
  const items: ReactNode[] = [];

  // Evolution: the real chart is uncovered from left to right, each weigh-in lights up.
  if (f >= BEAT.toProgress[0] && f < 1050) {
    const p = prog(f, ...BEAT.chartDraw, easeInOut);
    const { plot, markers } = CHART;
    const sweep = plot.x + plot.w * p;
    const a = pt(sweep, plot.y - 4);
    const b = pt(plot.x + plot.w + 4, plot.y + plot.h + 4);
    const n = markers.length;
    items.push(
      <div key="chart" style={{ position: 'absolute', inset: 0 }}>
        {p < 1 && (
          <div style={{ position: 'absolute', left: a.x - 10 * k, top: a.y, width: b.x - a.x + 10 * k, height: b.y - a.y, background: `linear-gradient(90deg, ${CHART.card}00 0, ${CHART.card} ${10 * k}px)` }} />
        )}
        {p > 0 && p < 1 && <div style={{ position: 'absolute', left: a.x - 1.5 * k, top: a.y, width: 3 * k, height: b.y - a.y, background: `linear-gradient(180deg, transparent, ${C.lav}, transparent)`, boxShadow: `0 0 ${14 * k}px ${C.violetHi}` }} />}
        {markers.map(([mx, my], i) => {
          const passed = clamp((sweep - mx) / 26);
          const seq = prog(f, BEAT.markers[0] + (i * (BEAT.markers[1] - BEAT.markers[0] - 14)) / n, BEAT.markers[0] + (i * (BEAT.markers[1] - BEAT.markers[0] - 14)) / n + 14);
          const ring = (t: number, key: string) =>
            t > 0 && t < 1 ? (
              <div key={key} style={{ position: 'absolute', left: pt(mx, my).x - 14 * k, top: pt(mx, my).y - 14 * k, width: 28 * k, height: 28 * k, borderRadius: '50%', border: `${2.2 * k}px solid ${C.lav}`, boxShadow: `0 0 ${10 * k}px ${C.violetHi}`, opacity: (1 - t) * 0.95, transform: `scale(${0.25 + t})` }} />
            ) : null;
          return (
            <div key={i}>
              {ring(passed, 'a')}
              {ring(seq, 'b')}
            </div>
          );
        })}
      </div>,
    );
  }

  // Training: the first set is completed.
  if (f >= BEAT.setDone - 2 && f < BEAT.setDone + 44) {
    const c = pt(TAP.set1.x, TAP.set1.y);
    items.push(<Ripple key="set" x={c.x} y={c.y} at={BEAT.setDone} size={70 * k} color={C.good} />);
    items.push(<Sparkle key="setsp" x={c.x} y={c.y} at={BEAT.setDone + 2} radius={60 * k} count={10} seed={3} />);
  }

  // Habits: «+ 250».
  if (f >= BEAT.water - 2 && f < BEAT.water + 44) {
    const c = pt(TAP.add250.x, TAP.add250.y);
    const r = pt(HOY.water.x, HOY.water.y);
    items.push(
      <div key="water" style={{ position: 'absolute', inset: 0 }}>
        <Ripple x={c.x} y={c.y} at={BEAT.water} size={60 * k} />
        <Sparkle x={r.x} y={r.y} at={BEAT.water + 3} radius={52 * k} count={10} seed={7} />
      </div>,
    );
  }

  // Style: the taps on the real controls.
  const taps: [number, { x: number; y: number }][] = [
    [BEAT.sheetUp - 3, TAP.accent],
    [BEAT.cyan - 3, TAP.cyan],
    [BEAT.light - 3, TAP.theme],
    [BEAT.backViolet - 3, TAP.theme],
  ];
  for (const [at, t] of taps) {
    if (f >= at && f < at + 18) {
      const c = pt(t.x, t.y);
      items.push(<Ripple key={`tap${at}`} x={c.x} y={c.y} at={at} size={56 * k} color={at === BEAT.light - 3 ? '#14121b' : '#fff'} />);
    }
  }

  // Privacy: a calm glow along the screen edge when the records settle in.
  if (f >= BEAT.saved - 4 && f < BEAT.saved + 80) {
    const t = windowed(f, BEAT.saved, BEAT.saved + 70, 14, 40);
    items.push(<div key="saved" style={{ position: 'absolute', inset: 0, borderRadius: g.innerRadius, boxShadow: `inset 0 0 ${40 * k}px ${12 * k}px ${C.violetHi}${Math.round(t * 0.55 * 255).toString(16).padStart(2, '0')}` }} />);
  }

  return <>{items}</>;
}

export function stageAt(f: number, L: Layout) {
  return {
    glow: keys(f, [
      [0, 0.12],
      [70, 0.55],
      [230, 0.9],
      [2300, 0.85],
      [2400, 0.6],
      [2860, 0.95],
      [3135, 1.05],
    ]),
    y: keys(f, [
      [0, v(L, 0.46, 0.45)],
      [300, 0.42],
      [2860, 0.38],
    ]),
    tint: accentAt(f),
    light: windowed(f, BEAT.light + 4, BEAT.backViolet + 10, 16, 16) * 0.8,
  };
}

export { cubicPath, BRAND_GRAD };
