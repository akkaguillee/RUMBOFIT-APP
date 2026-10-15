import type { FC } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { LightSweep } from '../ui';
import { Effort } from './scenes/Effort';
import { Evolution } from './scenes/Evolution';
import { Finale } from './scenes/Finale';
import { Hook } from './scenes/Hook';
import { Privacy } from './scenes/Privacy';
import { Reveal } from './scenes/Reveal';
import { Style } from './scenes/Style';
import { SCENES, type SceneId } from './timing';

const SCENE_COMPONENTS: Record<SceneId, FC> = {
  hook: Hook,
  reveal: Reveal,
  evolution: Evolution,
  effort: Effort,
  style: Style,
  privacy: Privacy,
  finale: Finale,
};

/** Light sweeps on the energetic cuts; the privacy scene enters softly. */
const SWEEPS = [270, 540, 945, 1260, 1800];

export function Cinematic() {
  return (
    <AbsoluteFill style={{ background: '#050506', fontFamily: 'Inter, system-ui, sans-serif', color: '#fff' }}>
      {(Object.keys(SCENE_COMPONENTS) as SceneId[]).map((id) => {
        const [from, to] = SCENES[id];
        const C = SCENE_COMPONENTS[id];
        return (
          <Sequence key={id} from={from} durationInFrames={to - from} name={id}>
            <C />
          </Sequence>
        );
      })}
      {SWEEPS.map((c) => (
        <LightSweep key={c} at={c - 7} />
      ))}
    </AbsoluteFill>
  );
}
