import { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import captions from './captions.json';
import { BEAT, cameraFx, phoneAt, rumbiAt, rumbiEvents, travel } from './choreo';
import { Captions, Phone, useT, type Cue } from './kit';
import { RumbiSvg, simulate } from './Rumbi';
import { AppScene, Backdrop, Build, Close, Evolution, Flashes, Habits, Hook, Privacy, ScreenOverlay, Style, StyleBack, Training } from './scenes';
import { LAYOUTS, LayoutContext, useLayout, type Format } from './theme';

export type PasosProps = {
  format: Format;
};

function AppPhone() {
  const f = useT();
  const L = useLayout();
  const p = phoneAt(f, L);
  if (!p) return null;
  return (
    <Phone width={p.w} x={p.x} y={p.y} rx={p.rx} ry={p.ry} rz={p.rz} scale={p.scale} opacity={p.opacity} blur={p.blur} glow={0.8} glowColor={p.glowColor} layers={p.layers}>
      <ScreenOverlay width={p.w} />
    </Phone>
  );
}

function Mascot() {
  const f = useT();
  const L = useLayout();
  const events = useMemo(() => rumbiEvents(L).map((e) => ({ ...e, at: e.at - BEAT.wake })), [L]);
  const r = rumbiAt(f, L);
  const rig = simulate(`rumbi-${L.format}`, 'neutral', events, f - BEAT.wake, 11);
  if (r.hidden) return null;
  // A squash on the kick: Rumbi dances with the music.
  const sq = r.squash;
  return (
    <div
      style={{
        position: 'absolute',
        left: r.x - r.size / 2,
        top: r.y - r.size / 2,
        opacity: r.opacity,
        transform: `scale(${(0.9 + 0.1 * r.opacity) * (1 + 0.06 * sq)}, ${(0.9 + 0.1 * r.opacity) * (1 - 0.08 * sq)})`,
        transformOrigin: '50% 90%',
      }}
    >
      <RumbiSvg f={rig} size={r.size} accent={r.accent} uid={`rumbi-${L.format}`} />
    </div>
  );
}

/** Everything the camera moves: it punches on the kick, slams on the drops and shakes on impacts. */
function Camera({ children }: { children: React.ReactNode }) {
  const f = useT();
  const c = cameraFx(f);
  return <AbsoluteFill style={{ transform: `translate(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px) rotate(${c.rot.toFixed(3)}deg) scale(${c.scale.toFixed(4)})` }}>{children}</AbsoluteFill>;
}

/** Captions for the narrated blocks; the hook and the close set their words as big type instead. */
const CUES = (captions as Cue[]).filter((c) => c.line !== 'l1' && c.line !== 'l9');

/** «Cada pequeño paso cuenta»: 1:04, 9:16 or 4:5, at 120 BPM. */
export function Pasos({ format }: PasosProps) {
  const L = LAYOUTS[format];
  const f = useT();
  const distance = useMemo(() => travel(f), [f]);
  return (
    <LayoutContext.Provider value={L}>
      <AbsoluteFill style={{ background: '#0d0c14', overflow: 'hidden' }}>
        <Camera>
          <Backdrop travel={distance} />
          <StyleBack />
          <AppPhone />
          <Hook />
          <AppScene />
          <Evolution />
          <Training />
          <Habits />
          <Style />
          <Privacy />
          <Build />
          <Close />
          <Mascot />
        </Camera>
        <Flashes />
        <Captions cues={CUES} />
      </AbsoluteFill>
    </LayoutContext.Provider>
  );
}
