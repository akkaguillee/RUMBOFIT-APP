/**
 * RUMBO promo design system: one grid, one type scale, one palette.
 * Every scene builds on these numbers so margins and rhythm stay consistent.
 *
 * Canvas 1080 × 1920 (9:16). Social apps cover the top ~230 px (status bar,
 * account), the bottom ~420 px (caption, buttons) and, on TikTok, a right
 * rail around x > 960 between y 900–1600. Text and key UI live inside SAFE;
 * only backgrounds, light and decorative depth may bleed outside.
 */
export const W = 1080;
export const H = 1920;

export const SAFE = {
  left: 96,
  right: 984, // W - 96
  top: 250,
  bottom: 1500,
} as const;

export const CONTENT_W = SAFE.right - SAFE.left; // 888

/** 8-pt spacing scale (px). */
export const SPACE = { xs: 8, s: 16, m: 24, l: 40, xl: 64, xxl: 96 } as const;

/** Type scale (Inter). Display lines: weight 800, tracking −0.04em, line-height 0.98. */
export const TYPE = {
  display: 128,
  headline: 104,
  title: 64,
  body: 40,
  label: 30,
  eyebrow: 26,
} as const;

export const COLOR = {
  ink: '#050507',
  text: '#ffffff',
  text2: 'rgba(255,255,255,0.72)',
  text3: 'rgba(255,255,255,0.5)',
  red: '#e53945',
  redHi: '#ff5a63',
  redSoft: '#ff8a8f',
  redDeep: '#8f182b',
  good: '#4fe08f',
  water: '#3b8cff',
  steps: '#f2b01e',
  hairline: 'rgba(255,255,255,0.12)',
} as const;

export const RED_GRAD = 'linear-gradient(100deg, #ff8a7a 0%, #ff4552 48%, #c81d35 100%)';

/** Scene windows (frames) and helpers. */
import timeline from './timeline.json';
import voice from './voice.json';

export type SceneId = keyof typeof timeline.scenes;
export const SCENES = timeline.scenes as Record<SceneId, [number, number]>;
export const sceneStart = (id: SceneId) => SCENES[id][0];
export const sceneLength = (id: SceneId) => SCENES[id][1] - SCENES[id][0];

export interface VoiceWord {
  w: string;
  f: number;
}
export interface VoiceLine {
  id: string;
  at: number;
  text: string;
  dur: number;
  words: VoiceWord[];
}
export const VOICE = voice as VoiceLine[];

/**
 * Frame (relative to the scene) at which the n-th word of a voice line is spoken.
 * Use it to sync kinetic type: wordAt('v3', 1, 'progress') → "peso,".
 */
export function wordAt(line: string, index: number, scene: SceneId): number {
  const l = VOICE.find((v) => v.id === line);
  if (!l) throw new Error(`Unknown voice line ${line}`);
  const w = l.words[Math.min(index, l.words.length - 1)]!;
  return w.f - sceneStart(scene);
}
