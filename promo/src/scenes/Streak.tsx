import { AbsoluteFill } from 'remotion';
import { Backdrop } from '../ui';

/** Placeholder — replaced by the scene implementation. */
export function Streak() {
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ display: 'grid', placeItems: 'center', fontSize: 80, fontWeight: 800 }}>Streak</AbsoluteFill>
    </AbsoluteFill>
  );
}
