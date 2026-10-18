import cuesJson from './cues.json';
import subsJson from './subs.json';
import voiceJson from './voice.json';

/** One clock for picture and sound: audio/build_reel.py writes these files from the voice takes. */
export const FPS = cuesJson.fps;
export const FRAMES = cuesJson.frames;
export const BPM = cuesJson.bpm;
/** Frames per beat of the score. */
export const BEAT_F = (FPS * 60) / BPM;
const PULSE = cuesJson.pulse as [number, number][];
/** Where the music drives and the picture pulses with the kick. */
export const inPulse = (f: number) => PULSE.some(([a, b]) => f >= a && f < b);
export const KEYWORDS = cuesJson.keywords as { at: number; text: string }[];
export type SceneId = 'hook' | 'reveal' | 'evolution' | 'training' | 'habits' | 'style' | 'privacy' | 'finale';
export const SCENES = cuesJson.scenes as Record<SceneId, [number, number]>;
const CUES = cuesJson.cues as Record<string, number | number[]>;

export function cue(name: string): number {
  const v = CUES[name];
  if (typeof v !== 'number') throw new Error(`Unknown cue ${name}`);
  return v;
}
export function cues(name: string): number[] {
  const v = CUES[name];
  if (!Array.isArray(v)) throw new Error(`Unknown cue list ${name}`);
  return v;
}

export interface Sub {
  from: number;
  to: number;
  text: string;
}
export const SUBS = subsJson as Sub[];
export const VOICE = voiceJson as { source: string; lines: { id: string; text: string; at: number; end: number; words: { w: string; f: number }[] }[] };
export const lineEnd = (id: string) => VOICE.lines.find((l) => l.id === id)!.end;
