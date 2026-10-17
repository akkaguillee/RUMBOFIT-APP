import { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import captions from './captions.json';
import { BEAT, phoneAt, rumbiAt, rumbiEvents } from './choreo';
import { Captions, Phone, Stage, useT, type Cue } from './kit';
import { RumbiSvg, simulate } from './Rumbi';
import { AppScene, Close, Evolution, Habits, Hook, Privacy, ScreenOverlay, stageAt, Style, StyleBack, Training } from './scenes';
import { LAYOUTS, LayoutContext, useLayout, type Format } from './theme';

export type PasosProps = {
  format: Format;
  /** Address shown under the call to action (empty to leave it out). */
  url: string;
};

function Backdrop() {
  const f = useT();
  const L = useLayout();
  const s = stageAt(f, L);
  return <Stage glow={s.glow} y={s.y} tint={s.tint} light={s.light} />;
}

function AppPhone() {
  const f = useT();
  const L = useLayout();
  const p = phoneAt(f, L);
  if (!p) return null;
  return (
    <>
      {p.outline !== undefined && <Phone width={p.w} x={p.x} y={p.y} layers={[]} outline={p.outline} />}
      <Phone width={p.w} x={p.x} y={p.y} rx={p.rx} ry={p.ry} rz={p.rz} scale={p.scale} opacity={p.opacity} glowColor={p.glowColor} layers={p.layers}>
        <ScreenOverlay width={p.w} />
      </Phone>
    </>
  );
}

function Mascot() {
  const f = useT();
  const L = useLayout();
  const events = useMemo(() => rumbiEvents(L).map((e) => ({ ...e, at: e.at - BEAT.wake })), [L]);
  const r = rumbiAt(f, L);
  const rig = simulate(`rumbi-${L.format}`, 'neutral', events, f - BEAT.wake, 11);
  return (
    <div style={{ position: 'absolute', left: r.x - r.size / 2, top: r.y - r.size / 2, opacity: r.opacity, transform: `scale(${0.9 + 0.1 * r.opacity})` }}>
      <RumbiSvg f={rig} size={r.size} accent={r.accent} uid={`rumbi-${L.format}`} />
    </div>
  );
}

/** «Cada pequeño paso cuenta»: 1:44.5, 9:16 or 4:5. */
export function Pasos({ format, url }: PasosProps) {
  const L = LAYOUTS[format];
  return (
    <LayoutContext.Provider value={L}>
      <AbsoluteFill style={{ background: '#0d0c14', overflow: 'hidden' }}>
        <Backdrop />
        <StyleBack />
        <AppPhone />
        <Hook />
        <AppScene />
        <Evolution />
        <Training />
        <Habits />
        <Style />
        <Privacy />
        <Close url={url} />
        <Mascot />
        <Captions cues={captions as Cue[]} />
      </AbsoluteFill>
    </LayoutContext.Provider>
  );
}
