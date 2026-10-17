import { Img, useCurrentFrame } from 'remotion';
import { RUNNER_VIEWBOX, WORDMARK_TEXT_VIEWBOX, runnerPaths, wordmarkPaths } from '../../../src/brand/logoPaths';
import { isLight, onBody, onScreen, phonePose } from './film';
import { finaleGeo, hookGeo } from './geo';
import { HandLine, IC, Ico, KTitle, PathLine, SansLine, TitleArea, clamp, easeInOut, easeOut, easeSoft, hexA, mix, prog, shotUrl, spr, SCREEN_H, SCREEN_W, phoneGeom } from './kit';
import { useLayout } from './layout';
import { ACCENT, BUTTON, FONT, V } from './theme';
import { cue as c, cues, SCENES } from './timing';

/* ── 0:00 Hook ──────────────────────────────────────────────────────────── */
export function Hook() {
  const f = useCurrentFrame();
  const L = useLayout();
  const H = hookGeo(L);
  if (f > SCENES.reveal[0] + 30) return null;
  const k = L.k;
  // A spark leaves Rumbi and lights the dot where the path begins.
  const s0 = c('hook.spark');
  const sp = prog(f, s0, c('hook.dot'), easeInOut);
  const from = { x: H.rumbiBig.x - 120 * k, y: H.rumbiBig.y + 150 * k };
  const sx = mix(from.x, H.dot.x, sp);
  const sy = mix(from.y, H.dot.y, sp) - Math.sin(Math.PI * sp) * 160 * k;
  const pathP = prog(f, c('hook.path'), c('hook.pathEnd'), easeSoft);
  const lineOut = 1 - prog(f, SCENES.reveal[0] - 10, SCENES.reveal[0] + 20, easeInOut);
  const dotIn = spr(f, c('hook.dot'), { damping: 11, stiffness: 200 });
  const titleOut = SCENES.reveal[0] - 14;
  return (
    <>
      {f >= s0 && f < c('hook.dot') + 2 && (
        <div style={{ position: 'absolute', left: sx - 14, top: sy - 14, width: 28, height: 28, borderRadius: 14, background: `radial-gradient(closest-side, #fff, ${hexA(V.lav, 0.6)} 50%, transparent 80%)` }} />
      )}
      {f >= c('hook.dot') && f < c('hook.path') + 4 && (
        <div style={{ position: 'absolute', left: H.dot.x - 40, top: H.dot.y - 40, width: 80, height: 80, borderRadius: 40, transform: `scale(${dotIn})`, background: `radial-gradient(closest-side, #fff 0, #fff 18%, ${hexA(V.lav, 0.45)} 40%, transparent 75%)` }} />
      )}
      <PathLine d={H.path} p={pathP} width={6 * k} stepGap={52 * k} opacity={lineOut} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: H.logoY - 40 * k, display: 'flex', justifyContent: 'center', opacity: 1 - prog(f, titleOut, titleOut + 14, easeInOut) }}>
        <LogoLockup at={c('hook.logo')} height={40 * k} />
      </div>
      <div style={{ position: 'absolute', left: (L.W - L.textW) / 2, width: L.textW, top: H.titleY }}>
        <KTitle text="TU CAMINO." at={c('hook.title')} out={titleOut} size={H.titleSize * k} />
        <KTitle text="TU RUMBO." at={c('hook.title') + 8} out={titleOut} size={H.titleSize * k} gradient={[1]} />
      </div>
    </>
  );
}

/** The real logo (runner + wordmark), drawn in like the app's splash. */
function LogoLockup({ at, height }: { at: number; height: number }) {
  const f = useCurrentFrame();
  const [, , rw, rh] = RUNNER_VIEWBOX.split(' ').map(Number) as [number, number, number, number];
  const [, , ww, wh] = WORDMARK_TEXT_VIEWBOX.split(' ').map(Number) as [number, number, number, number];
  const runnerH = height * 1.9;
  const draw = prog(f, at, at + 26, easeInOut);
  const fill = prog(f, at + 16, at + 30, easeOut);
  const word = prog(f, at + 10, at + 34, easeOut);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: height * 0.55, opacity: prog(f, at, at + 6) }}>
      <svg viewBox={RUNNER_VIEWBOX} width={(runnerH * rw) / rh} height={runnerH} style={{ overflow: 'visible' }}>
        {[...runnerPaths.speedLines, runnerPaths.leg, runnerPaths.body, runnerPaths.head].map((d, i) => (
          <path key={i} d={d} fill="#fff" fillOpacity={fill} stroke={V.lav} strokeWidth={26} strokeOpacity={1 - fill * 0.9} pathLength={1} strokeDasharray={`${draw} 1`} />
        ))}
      </svg>
      <svg viewBox={WORDMARK_TEXT_VIEWBOX} width={(height * ww) / wh} height={height} style={{ overflow: 'visible' }}>
        {wordmarkPaths.letters.map((d, i) => (
          <path key={i} d={d} fill="#fff" fillRule="evenodd" opacity={prog(f, at + 10 + i * 3, at + 24 + i * 3)} transform={`translate(${(1 - word) * (i - 2) * 160} 0)`} />
        ))}
      </svg>
    </div>
  );
}

/* ── 0:09 Reveal ────────────────────────────────────────────────────────── */
export function Reveal() {
  const f = useCurrentFrame();
  const L = useLayout();
  const t = c('reveal.title');
  const out = SCENES.evolution[0] - 16;
  if (f < t - 2 || f > out + 20) return null;
  const size = 56 * L.k;
  return (
    <TitleArea>
      <KTitle text="REGISTRA. OBSERVA." at={t} out={out} size={size} stagger={16} />
      <KTitle text="SIGUE ADELANTE." at={t + 32} out={out} size={size} gradient={[0, 1]} />
    </TitleArea>
  );
}

/* ── 0:21 Evolution ─────────────────────────────────────────────────────── */
export function Evolution() {
  const f = useCurrentFrame();
  const L = useLayout();
  const t = c('evo.title');
  const out = SCENES.training[0] - 16;
  if (f < t - 2 || f > out + 20) return null;
  return (
    <TitleArea>
      <SansLine text="Tu evolución," at={t} out={out} size={66 * L.k} />
      <HandLine text="paso a paso." at={t + 10} out={out} size={78 * L.k} />
    </TitleArea>
  );
}

/* ── 0:36 Training ──────────────────────────────────────────────────────── */
/** The «Pierna» session card of the real history screen (pt). */
const CARD = { x: 14, y: 316, w: 362, h: 136 };

export function Training() {
  const f = useCurrentFrame();
  const L = useLayout();
  const t0 = c('train.card');
  const land = c('train.hist');
  const titleAt = c('train.title');
  const out = SCENES.habits[0] - 14;
  const els = [];
  if (f >= t0 - 2 && f < land + 14) {
    const pose = phonePose(f, L);
    const g = phoneGeom(pose.w);
    const k = g.k * pose.scale;
    // In front of the phone, then into its place on the real history screen.
    const inP = prog(f, t0, t0 + 24, easeOut);
    const toP = prog(f, land - 8, land + 8, easeInOut);
    const target = onScreen(f, L, CARD.x, CARD.y);
    const cw = mix(CARD.w * k * 1.14, CARD.w * k, toP);
    const cx = mix(mix(L.W + cw, L.W / 2 - cw / 2, inP), target.x, toP);
    const cy = mix(pose.y - CARD.h * k * 0.9, target.y, toP);
    const rot = (1 - inP) * 8 * (1 - toP);
    const fade = 1 - prog(f, land + 4, land + 14);
    const sc = cw / CARD.w;
    els.push(
      <div
        key="card"
        style={{
          position: 'absolute',
          left: cx,
          top: cy,
          width: cw,
          height: CARD.h * sc,
          borderRadius: 18 * sc,
          overflow: 'hidden',
          opacity: fade,
          transform: `rotate(${rot}deg)`,
          boxShadow: `0 40px 80px -30px rgba(0,0,0,0.85), 0 0 0 1.5px ${hexA(V.lav, 0.35 * (1 - toP))}, 0 0 60px -10px ${hexA(V.acc, 0.5 * (1 - toP))}`,
        }}
      >
        <Img src={shotUrl('historial')} style={{ position: 'absolute', width: SCREEN_W * sc, height: SCREEN_H * sc, left: -CARD.x * sc, top: -CARD.y * sc }} />
      </div>,
    );
  }
  if (f >= titleAt - 2 && f < out + 20) {
    const words = ['Rutinas', 'Series', 'Marcas'];
    els.push(
      <TitleArea key="title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 * L.k }}>
          {words.map((w, i) => {
            const s = prog(f, titleAt + i * 8, titleAt + i * 8 + 16, easeOut);
            const leave = prog(f, out + i, out + 12 + i, easeInOut);
            return (
              <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 22 * L.k }}>
                {i > 0 && <span style={{ width: 12 * L.k, height: 12 * L.k, borderRadius: 99, background: V.accHi, opacity: s * (1 - leave), transform: `scale(${s})` }} />}
                <span style={{ display: 'inline-block', overflow: 'hidden', lineHeight: 1.1 }}>
                  <span style={{ display: 'inline-block', fontFamily: FONT.sans, fontWeight: 800, fontSize: 64 * L.k, letterSpacing: '-0.02em', color: '#fff', transform: `translateY(${(1 - s) * 105 - leave * 105}%)` }}>{w}</span>
                </span>
              </div>
            );
          })}
        </div>
      </TitleArea>,
    );
  }
  return <>{els}</>;
}

/* ── 0:50 Habits ────────────────────────────────────────────────────────── */
export function Habits() {
  const f = useCurrentFrame();
  const L = useLayout();
  const t0 = c('hab.icons');
  const land = c('hab.cards');
  const titleAt = c('hab.title');
  const out = SCENES.style[0] - 14;
  const els = [];
  if (f >= t0 && f < land + 30) {
    const g = phoneGeom(L.phone.w);
    const topY = L.phone.y - (g.h / 2) * 0.9 + 70 - 10;
    const items = [
      { d: IC.droplet, color: '#3f8fea', x: L.W * 0.44, target: [103, 446] as const },
      { d: IC.footprints, color: '#e3a516', x: L.W * 0.62, target: [286, 446] as const },
    ];
    items.forEach((it, i) => {
      const pop = spr(f, t0 + i * 5, { damping: 12, stiffness: 190 });
      const fly = prog(f, land + i * 4, land + 22 + i * 4, easeInOut);
      const tgt = onScreen(f, L, it.target[0], it.target[1]);
      const x = mix(it.x, tgt.x, fly);
      const y = mix(topY, tgt.y, fly) - Math.sin(Math.PI * fly) * 90 * L.k;
      const size = mix(96, 60, fly) * L.k;
      const fade = 1 - prog(f, land + 18 + i * 4, land + 28 + i * 4);
      els.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x - size / 2,
            top: y - size / 2,
            width: size,
            height: size,
            borderRadius: size * 0.3,
            display: 'grid',
            placeItems: 'center',
            background: `linear-gradient(160deg, ${hexA(it.color, 0.35)}, ${hexA(it.color, 0.16)})`,
            boxShadow: `inset 0 0 0 1.5px ${hexA(it.color, 0.55)}, 0 18px 40px -16px ${hexA(it.color, 0.8)}`,
            transform: `scale(${pop})`,
            opacity: fade,
          }}
        >
          <Ico d={it.d} size={size * 0.52} color={it.color} stroke={2.2} />
        </div>,
      );
    });
  }
  if (f >= titleAt - 2 && f < out + 20) {
    els.push(
      <TitleArea key="title">
        <SansLine text="La constancia" at={titleAt} out={out} size={66 * L.k} />
        <HandLine text="también suma." at={titleAt + 10} out={out} size={78 * L.k} />
      </TitleArea>,
    );
  }
  return <>{els}</>;
}

/* ── 1:05 Style ─────────────────────────────────────────────────────────── */
const ACCENT_NAMES: [string, string][] = [
  ['cian', 'CIAN GLACIAR'],
  ['fucsia', 'FUCSIA NEÓN'],
  ['naranja', 'NARANJA BRASA'],
  ['volt', 'LIMA VOLT'],
  ['rojo', 'ROJO INTENSO'],
  ['violeta', 'VIOLETA RUMBO'],
];

export function Style() {
  const f = useCurrentFrame();
  const L = useLayout();
  const a = cues('sty.accents');
  const starts = [...a, c('sty.violet')];
  const chipFrom = a[0]! + 18;
  const chipTo = c('sty.violet') + 16;
  const titleAt = c('sty.title');
  const out = SCENES.privacy[0] - 12;
  const light = isLight(f);
  const els = [];
  if (f >= chipFrom - 2 && f < chipTo + 12) {
    let i = 0;
    for (let k = 0; k < starts.length; k++) if (f >= starts[k]!) i = k;
    const [id, name] = ACCENT_NAMES[i]!;
    const pop = spr(f, starts[i]!, { damping: 14, stiffness: 260 });
    const vis = prog(f, chipFrom - 2, chipFrom + 8) * (1 - prog(f, chipTo, chipTo + 12, easeInOut));
    els.push(
      <TitleArea key="chip" opacity={vis}>
        <div style={{ fontFamily: FONT.sans, fontSize: 24 * L.k, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', marginBottom: 8 * L.k }}>COLOR DE LA INTERFAZ</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18 * L.k,
            padding: `${16 * L.k}px ${30 * L.k}px`,
            borderRadius: 999,
            background: 'rgba(16,13,26,0.8)',
            boxShadow: `0 0 0 1.5px ${hexA(ACCENT[id]!, 0.7)}, 0 0 40px -6px ${hexA(ACCENT[id]!, 0.6)}`,
            transform: `scale(${0.94 + 0.06 * pop})`,
          }}
        >
          <span style={{ width: 30 * L.k, height: 30 * L.k, borderRadius: 99, background: ACCENT[id] }} />
          <span style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 36 * L.k, letterSpacing: '0.06em', color: '#fff' }}>{name}</span>
        </div>
      </TitleArea>,
    );
  }
  if (f >= titleAt - 2 && f < out + 20) {
    els.push(
      <TitleArea key="title">
        <KTitle text="A TU ESTILO." at={titleAt} out={out} size={96 * L.k} gradient={[2]} color={light ? V.ink : '#fff'} onLight={light} />
      </TitleArea>,
    );
  }
  return <>{els}</>;
}

/* ── 1:19 Privacy ───────────────────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 12 }, (_, i) => {
  const icons = [IC.droplet, IC.footprints, IC.dumbbell, IC.scale];
  const colors = ['#3f8fea', '#e3a516', V.lav, V.lav];
  const ang = (i / 12) * Math.PI * 2 + 0.3;
  return { d: icons[i % 4]!, color: colors[i % 4]!, ang, delay: (i * 7) % 60, dist: 1 + ((i * 37) % 10) / 22 };
});

export function PrivacyBack() {
  const f = useCurrentFrame();
  const L = useLayout();
  const t0 = SCENES.privacy[0];
  if (f < t0 - 10 || f > SCENES.finale[0] + 20) return null;
  const pose = phonePose(f, L);
  const g = phoneGeom(pose.w);
  const halo = prog(f, c('priv.halo'), c('priv.halo') + 40, easeOut);
  const breathe = 1 + Math.sin((f - c('priv.halo')) / 22) * 0.012;
  const out = 1 - prog(f, SCENES.finale[0] - 6, SCENES.finale[0] + 18, easeInOut);
  const w = pose.w * pose.scale * (1.08 + 0.04 * (1 - halo)) * breathe;
  const h = g.h * pose.scale * (1.05 + 0.04 * (1 - halo)) * breathe;
  return (
    <div
      style={{
        position: 'absolute',
        left: pose.x - w / 2,
        top: pose.y - h / 2,
        width: w,
        height: h,
        borderRadius: w * 0.2,
        opacity: halo * out,
        boxShadow: `0 0 0 2px ${hexA(V.lav, 0.35)}, 0 0 80px 10px ${hexA(V.acc, 0.35)}, inset 0 0 60px ${hexA(V.acc, 0.18)}`,
      }}
    />
  );
}

export function Privacy() {
  const f = useCurrentFrame();
  const L = useLayout();
  const t0 = SCENES.privacy[0];
  const titleAt = c('priv.title');
  const out = SCENES.finale[0] - 12;
  if (f < t0 || f > SCENES.finale[0] + 20) return null;
  const pose = phonePose(f, L);
  const els = [];
  const R = 470 * L.k;
  PARTICLES.forEach((p, i) => {
    const s = t0 + 14 + p.delay;
    const q = prog(f, s, s + 46, easeInOut);
    if (q <= 0 || q >= 1) return;
    const r = R * p.dist * (1 - q);
    const x = pose.x + Math.cos(p.ang + q * 0.6) * r;
    const y = pose.y + Math.sin(p.ang + q * 0.6) * r * 1.2;
    const size = 64 * L.k * (1 - q * 0.6);
    const a = prog(f, s, s + 8) * (1 - prog(f, s + 34, s + 46));
    els.push(
      <div key={i} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size * 0.32, display: 'grid', placeItems: 'center', background: hexA(p.color, 0.18), boxShadow: `inset 0 0 0 1.5px ${hexA(p.color, 0.5)}`, opacity: a }}>
        <Ico d={p.d} size={size * 0.5} color={p.color} stroke={2.2} />
      </div>,
    );
  });
  if (f >= titleAt - 2) {
    els.push(
      <TitleArea key="title">
        <SansLine text="Tus registros se guardan" at={titleAt} out={out} size={54 * L.k} weight={700} />
        <SansLine text="en tu propio dispositivo." at={titleAt + 8} out={out} size={54 * L.k} weight={700} color={V.lavText} />
      </TitleArea>,
    );
  }
  return <>{els}</>;
}

/* ── 1:33 Finale ────────────────────────────────────────────────────────── */
export function Finale() {
  const f = useCurrentFrame();
  const L = useLayout();
  const F = finaleGeo(L);
  const t0 = SCENES.finale[0];
  if (f < t0) return null;
  const k = L.k;
  const [rx, ry, rw, rh] = RUNNER_VIEWBOX.split(' ').map(Number) as [number, number, number, number];
  const [, , ww, wh] = WORDMARK_TEXT_VIEWBOX.split(' ').map(Number) as [number, number, number, number];
  const runnerW = F.runner.w * k;
  const runnerH = (runnerW * rh) / rw;
  const s = runnerW / rw;
  // The light leaves the phone and draws the speed lines, then the runner.
  const pose = phonePose(t0, L);
  const dotFrom = { x: pose.x, y: pose.y };
  const firstLine = { x: F.runner.x - runnerW / 2 + (306 - rx) * s, y: F.runner.y - runnerH / 2 + (518 - ry) * s };
  const dp = prog(f, t0 + 4, c('fin.lines'), easeInOut);
  const dot = { x: mix(dotFrom.x, firstLine.x, dp), y: mix(dotFrom.y, firstLine.y, dp) - Math.sin(Math.PI * dp) * 120 * k };
  const lines = runnerPaths.speedLines.map((d, i) => ({ d, p: prog(f, c('fin.lines') + i * 6, c('fin.lines') + 18 + i * 6, easeInOut) }));
  const body = [runnerPaths.leg, runnerPaths.body, runnerPaths.head].map((d, i) => ({ d, p: prog(f, c('fin.runner') + i * 8, c('fin.runner') + 34 + i * 8, easeInOut) }));
  const fill = prog(f, c('fin.fill'), c('fin.fill') + 18, easeOut);
  const bloom = prog(f, c('fin.fill'), c('fin.fill') + 14, easeOut) * (1 - prog(f, c('fin.fill') + 14, c('fin.fill') + 60, easeInOut));
  const word = prog(f, c('fin.word'), c('fin.word') + 26, easeOut);
  const wordW = F.word.w * k;
  const wordH = (wordW * wh) / ww;
  const glint = prog(f, c('fin.word') + 10, c('fin.word') + 40, easeInOut);
  const slog = prog(f, c('fin.slogan'), c('fin.slogan') + 33, easeOut);
  const cta = spr(f, c('fin.cta'), { damping: 15, stiffness: 170 });
  const pulse = 1 + Math.max(0, Math.sin((f - c('fin.cta') - 20) / 14)) * 0.025 * prog(f, c('fin.cta') + 20, c('fin.cta') + 30);
  return (
    <>
      {dp > 0 && dp < 1 && <div style={{ position: 'absolute', left: dot.x - 16, top: dot.y - 16, width: 32, height: 32, borderRadius: 16, background: `radial-gradient(closest-side, #fff 0, #fff 30%, ${hexA(V.lav, 0.5)} 55%, transparent 80%)` }} />}
      <div style={{ position: 'absolute', left: F.runner.x - runnerW * 0.9, top: F.runner.y - runnerW * 0.9, width: runnerW * 1.8, height: runnerW * 1.8, borderRadius: '50%', background: `radial-gradient(closest-side, ${hexA(V.lav, 0.5 * bloom)}, ${hexA(V.acc, 0.25 * bloom)} 50%, transparent 75%)` }} />
      <svg viewBox={RUNNER_VIEWBOX} width={runnerW} height={runnerH} style={{ position: 'absolute', left: F.runner.x - runnerW / 2, top: F.runner.y - runnerH / 2, overflow: 'visible' }}>
        {[...lines, ...body].map(({ d, p }, i) => (
          <path key={i} d={d} pathLength={1} fill="#fff" fillOpacity={fill} stroke={V.lav} strokeWidth={22} strokeOpacity={p > 0 ? 1 - fill * 0.85 : 0} strokeDasharray={`${p} 1`} strokeLinecap="round" />
        ))}
      </svg>
      <div style={{ position: 'absolute', left: F.word.x - wordW / 2, top: F.word.y - wordH / 2, width: wordW, height: wordH }}>
        <svg viewBox={WORDMARK_TEXT_VIEWBOX} width={wordW} height={wordH} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="wm-glint" x1="0" x2="1" y1="0" y2="0">
              <stop offset={Math.max(0, glint - 0.12)} stopColor="#fff" />
              <stop offset={glint} stopColor={V.lav} />
              <stop offset={Math.min(1, glint + 0.12)} stopColor="#fff" />
            </linearGradient>
          </defs>
          {wordmarkPaths.letters.map((d, i) => (
            <path key={i} d={d} fill={glint > 0 && glint < 1 ? 'url(#wm-glint)' : '#fff'} fillRule="evenodd" opacity={prog(f, c('fin.word') + i * 3, c('fin.word') + 12 + i * 3)} transform={`translate(${(1 - word) * (i - 2) * 140} 0)`} />
          ))}
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: F.slogan * (L.format === '9x16' ? 1 : 1) - 20 * k,
          textAlign: 'center',
          fontFamily: FONT.sans,
          fontWeight: 600,
          fontSize: 30 * k,
          letterSpacing: `${mix(0.9, 0.32, slog)}em`,
          marginRight: `-${mix(0.9, 0.32, slog)}em`,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          color: 'rgba(255,255,255,0.78)',
          opacity: slog,
        }}
      >
        Cada pequeño paso cuenta
      </div>
      {f >= c('fin.cta') && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: F.cta - 52 * k, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              padding: `${26 * k}px ${64 * k}px`,
              borderRadius: 999,
              background: BUTTON,
              boxShadow: `0 20px 50px -14px ${hexA(V.acc, 0.85)}, inset 0 1.5px 0 rgba(255,255,255,0.35)`,
              fontFamily: FONT.sans,
              fontWeight: 700,
              fontSize: 44 * k,
              color: '#fff',
              letterSpacing: '-0.01em',
              transform: `scale(${(0.9 + 0.1 * cta) * pulse})`,
              opacity: clamp(cta * 1.4),
            }}
          >
            Empieza hoy
          </div>
        </div>
      )}
    </>
  );
}

/* ── Example-data note, attached to the phone ───────────────────────────── */
export function DemoTag() {
  const f = useCurrentFrame();
  const L = useLayout();
  if (f < SCENES.reveal[0] + 30 || f > SCENES.finale[0]) return null;
  const pose = phonePose(f, L);
  const p = onBody(f, L, 0, 0);
  const zoomed = clamp((pose.scale - 1.02) / 0.08);
  const vis = prog(f, SCENES.reveal[0] + 30, SCENES.reveal[0] + 50) * (1 - prog(f, SCENES.finale[0] - 20, SCENES.finale[0])) * (1 - zoomed);
  const light = isLight(f);
  return (
    <div
      style={{
        position: 'absolute',
        left: p.x + 24 * L.k,
        width: 360 * L.k,
        top: p.y - 34 * L.k,
        textAlign: 'left',
        fontFamily: FONT.sans,
        fontSize: 19 * L.k,
        fontWeight: 600,
        letterSpacing: '0.1em',
        color: light ? 'rgba(21,18,26,0.55)' : 'rgba(255,255,255,0.5)',
        opacity: vis,
      }}
    >
      DATOS DE EJEMPLO
    </div>
  );
}

