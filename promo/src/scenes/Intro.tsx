import { AbsoluteFill } from 'remotion';
import { Backdrop } from '../ui';

/** Placeholder — replaced by the scene implementation. */
export function Intro() {
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ display: 'grid', placeItems: 'center', fontSize: 80, fontWeight: 800 }}>Intro</AbsoluteFill>
    </AbsoluteFill>
  );
}
