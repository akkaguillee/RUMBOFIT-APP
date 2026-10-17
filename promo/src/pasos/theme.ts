/**
 * «Cada pequeño paso cuenta»: the app's own identity (src/styles/tokens.css,
 * identity.css) and one layout per delivery format.
 *
 * Story 9:16 (1080 × 1920): Reels and TikTok cover the top ~230 px, the bottom
 * ~420 px and, on TikTok, a right rail (x > 960, y 900–1600). Headlines,
 * captions and key UI stay inside SAFE; light, depth and decoration may bleed.
 * Feed 4:5 (1080 × 1350): a reframed layout, not a crop: smaller phone, the
 * headline higher and the captions lower.
 */
import { createContext, useContext } from 'react';
import timeline from './timeline.json';

export const FPS = timeline.fps;
export const FRAMES = timeline.frames;

/* ── Identity (dark theme, violet accent) ─────────────────────────────── */
export const C = {
  bg: '#0d0c14',
  bg2: '#14121d',
  violet: '#8b5cf6',
  violetHi: '#9f7aff',
  violetLo: '#6c3be8',
  lavender: '#c4b5fd',
  lav: '#c9b8ff',
  deep: '#3d1a8f',
  text: '#ffffff',
  text2: 'rgba(255,255,255,0.74)',
  text3: 'rgba(255,255,255,0.52)',
  cyan: '#22d3ee',
  cyanHi: '#5ce3fb',
  water: '#3b82f6',
  steps: '#d4a015',
  good: '#4ade80',
} as const;

/** --brand-grad of the dark theme. */
export const BRAND_GRAD = `linear-gradient(120deg, ${C.lav} 0%, ${C.violetHi} 45%, ${C.violet} 100%)`;

export const FONT = {
  sans: "Inter, -apple-system, 'SF Pro Display', system-ui, sans-serif",
  display: 'Krophed, Inter, sans-serif',
  hand: "'212 Baby Girl', Inter, sans-serif",
} as const;

/* ── Layout per format ────────────────────────────────────────────────── */
export type Format = 'story' | 'feed';

export interface Layout {
  format: Format;
  W: number;
  H: number;
  /** Horizontal safe band. */
  left: number;
  right: number;
  /** Top of the headline zone and its height. */
  headY: number;
  headH: number;
  /** Centre line of the main visual. */
  cy: number;
  /** Phone width when it is the hero of the scene. */
  phoneW: number;
  /** Centre of the caption pill and its font size. */
  capY: number;
  capSize: number;
  /** Headline sizes. */
  display: number;
  title: number;
  /** Rumbi's size next to the phone. */
  rumbi: number;
}

export const LAYOUTS: Record<Format, Layout> = {
  story: {
    format: 'story',
    W: 1080,
    H: 1920,
    left: 96,
    right: 984,
    headY: 262,
    headH: 190,
    cy: 930,
    phoneW: 470,
    capY: 1392,
    capSize: 44,
    display: 96,
    title: 64,
    rumbi: 168,
  },
  feed: {
    format: 'feed',
    W: 1080,
    H: 1350,
    left: 80,
    right: 1000,
    headY: 64,
    headH: 150,
    cy: 690,
    phoneW: 372,
    capY: 1236,
    capSize: 40,
    display: 80,
    title: 54,
    rumbi: 140,
  },
};

export const LayoutContext = createContext<Layout>(LAYOUTS.story);
export const useLayout = () => useContext(LayoutContext);

/* ── Timeline ─────────────────────────────────────────────────────────── */
export type SceneId = keyof typeof timeline.scenes;
export const SCENES = timeline.scenes as Record<SceneId, [number, number]>;
export const VOICE_AT = timeline.voice as Record<string, number>;
