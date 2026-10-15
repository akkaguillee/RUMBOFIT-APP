/**
 * RUMBO · cinematic cut (84 s, 30 fps). One table for picture and sound:
 * scene windows here, voice lines and word frames in voice.json (from the
 * ElevenLabs takes, see audio/align_voice.py), sound cues in timeline.json.
 */
import voice from './voice.json';

export const FPS = 30;
export const FRAMES = 2520;

export const SCENES = {
  hook: [0, 270],
  reveal: [270, 540],
  evolution: [540, 945],
  effort: [945, 1260],
  style: [1260, 1500],
  privacy: [1500, 1800],
  finale: [1800, 2520],
} as const;

export type SceneId = keyof typeof SCENES;
export const start = (id: SceneId) => SCENES[id][0];
export const length = (id: SceneId) => SCENES[id][1] - SCENES[id][0];

interface Line {
  id: string;
  at: number;
  text: string;
  words: { w: string; f: number }[];
}
const LINES = voice as Line[];

/** Absolute frame where word `i` of voice line `id` starts. */
export function word(id: string, i: number): number {
  const line = LINES.find((l) => l.id === id);
  if (!line) throw new Error(`voice line ${id}`);
  return line.words[Math.min(i, line.words.length - 1)]!.f;
}

/** Same, relative to a scene (what a component inside that scene's Sequence sees). */
export function sceneWord(scene: SceneId, id: string, i: number): number {
  return word(id, i) - start(scene);
}
