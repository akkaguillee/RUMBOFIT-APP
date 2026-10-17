import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { accentAt, lightAmount, PhoneTrack, RumbiActor } from './film';
import { Stage, Subtitles } from './kit';
import { L45, L916, LayoutCtx } from './layout';
import { DemoTag, Evolution, Finale, Habits, Hook, Privacy, PrivacyBack, Reveal, Style, Training } from './scenes';
import { FONT } from './theme';

/**
 * RUMBO · «Cada pequeño paso cuenta». One continuous film: the stage, the
 * phone with the app's real screens, the scenes' type and graphics, Rumbi and
 * the subtitles, all on the clock of src/reel/cues.json.
 */
export function Reel({ format }: { format: '9x16' | '4x5' }) {
  const f = useCurrentFrame();
  const L = format === '4x5' ? L45 : L916;
  return (
    <LayoutCtx.Provider value={L}>
      <AbsoluteFill style={{ background: '#0d0c14', fontFamily: FONT.sans, color: '#fff', overflow: 'hidden' }}>
        <Stage light={lightAmount(f)} accent={accentAt(f)} />
        <Hook />
        <PrivacyBack />
        <PhoneTrack />
        <DemoTag />
        <Reveal />
        <Evolution />
        <Training />
        <Habits />
        <Style />
        <Privacy />
        <Finale />
        <RumbiActor />
        <Subtitles />
      </AbsoluteFill>
    </LayoutCtx.Provider>
  );
}
