import type { FC } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { SCENES, type SceneId } from './design';
import { Brand } from './scenes/Brand';
import { End } from './scenes/End';
import { Habits } from './scenes/Habits';
import { Intro } from './scenes/Intro';
import { Progress } from './scenes/Progress';
import { RumbiScene } from './scenes/RumbiScene';
import { Streak } from './scenes/Streak';
import { Training } from './scenes/Training';
import timeline from './timeline.json';
import { LightSweep } from './ui';

const SCENE_COMPONENTS: Record<SceneId, FC> = {
  intro: Intro,
  brand: Brand,
  progress: Progress,
  habits: Habits,
  training: Training,
  streak: Streak,
  rumbi: RumbiScene,
  end: End,
};

/** Cuts between scenes built by different hands get the shared light sweep; the others are match cuts inside the scenes. */
const SWEEP_CUTS = [240, 585, 885];

export function Promo() {
  return (
    <AbsoluteFill style={{ background: '#050507', fontFamily: 'Inter, system-ui, sans-serif', color: '#fff' }}>
      {(Object.keys(SCENE_COMPONENTS) as SceneId[]).map((id) => {
        const [from, to] = SCENES[id];
        const C = SCENE_COMPONENTS[id];
        return (
          <Sequence key={id} from={from} durationInFrames={to - from} name={id}>
            <C />
          </Sequence>
        );
      })}
      {timeline.cuts
        .filter((c) => SWEEP_CUTS.includes(c))
        .map((c) => (
          <LightSweep key={c} at={c - 7} />
        ))}
    </AbsoluteFill>
  );
}
