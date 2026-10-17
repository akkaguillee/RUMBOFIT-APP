/**
 * Measurements taken from the real captures (pt of the 390-wide screen, see
 * promo/capture and public/pasos/app/boxes.json) and the placement of the
 * phone in each block, per format. Scenes and the Rumbi / phone tracks read
 * the same numbers, so a tap always lands on the real control.
 */
import boxes from '../../public/pasos/app/boxes.json';
import { phoneGeom, phonePt } from './kit';
import type { Layout } from './theme';

type Rect = { x: number; y: number; w: number; h: number };
const centre = (b: Rect) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Cards lifted out of the captures. */
export const CROP = {
  imc: { src: 'imc', r: { x: 19, y: 272, w: 352, h: 275 } },
  kcal: { src: 'calorias', r: { x: 19, y: 272, w: 352, h: 134 } },
  template: { src: 'plantillas', r: { x: 19, y: 342, w: 352, h: 261 } },
  sessionHead: { src: 'sesion', r: { x: 19, y: 60, w: 352, h: 76 } },
  records: { src: 'marcas', r: { x: 19, y: 532, w: 352, h: 222 } },
  stats: { src: 'stats', r: { x: 19, y: 270, w: 352, h: 216 } },
  streak: { src: 'inicio-1040', r: { x: 19, y: 88, w: 352, h: 237 } },
  exercise: { src: 'sesion-serie', r: { x: 19, y: 237, w: 352, h: 402 } },
  chart: { src: 'progreso-todo', r: { x: 19, y: 64, w: 352, h: 420 } },
  calendar: { src: 'calendario', r: { x: 19, y: 184, w: 352, h: 524 } },
} as const;

/** Quick actions on Inicio (Peso, Agua, Pasos, Entrenar): the records of the privacy block. */
export const CHIPS: Rect[] = [
  { x: 26, y: 212, w: 51, h: 51 },
  { x: 98, y: 212, w: 51, h: 51 },
  { x: 170, y: 212, w: 51, h: 51 },
  { x: 313, y: 212, w: 51, h: 51 },
];

/** Weight chart in «progreso-todo»: plot area, card colour and the 17 weigh-ins (last one in violet). */
export const CHART = {
  plot: { x: 78, y: 262, w: 270, h: 170 },
  card: '#1e1c29',
  markers: [
    [83.8, 289.2], [102.0, 295.8], [115.6, 285.8], [133.7, 302.5], [147.3, 309.2], [165.5, 302.5], [179.1, 322.5], [197.2, 325.9],
    [210.8, 315.9], [229.0, 332.5], [242.6, 342.5], [260.7, 335.8], [274.3, 349.2], [292.5, 359.2], [306.1, 352.5], [324.2, 362.5], [338.5, 367.5],
  ] as [number, number][],
};

export const TAP = {
  accent: centre(boxes.accentButton),
  theme: centre(boxes.themeToggle),
  set1: centre(boxes.set1),
  add250: centre(boxes.add250),
  /** The colour chip of «CIAN GLACIAR» in the accent sheet. */
  cyan: { x: boxes.swatch4.x + 22, y: boxes.swatch4.y + boxes.swatch4.h / 2 },
};

/** Hoy cards on Inicio (water and steps), the zoom target of the habits block. */
export const HOY = { focus: { x: 195, y: 200 }, water: { x: 104, y: 170 }, steps: { x: 285, y: 170 } };

/** Weight chart focus for the camera push-in. */
export const CHART_FOCUS = { x: 213, y: 340 };

export interface PhonePlace {
  x: number;
  y: number;
  w: number;
}

/** Where the phone sits in each block. */
export function places(L: Layout) {
  const s = L.format === 'story';
  return {
    app: s ? { x: 420, y: 1012, w: 520 } : { x: 390, y: 716, w: 380 },
    evolution: s ? { x: 300, y: 1000, w: 470 } : { x: 290, y: 716, w: 370 },
    training: s ? { x: 300, y: 1000, w: 470 } : { x: 290, y: 716, w: 370 },
    habits: s ? { x: 320, y: 1000, w: 490 } : { x: 300, y: 716, w: 380 },
    style: s ? { x: 460, y: 1000, w: 500 } : { x: 460, y: 716, w: 380 },
    privacy: s ? { x: 490, y: 1020, w: 450 } : { x: 540, y: 744, w: 340 },
  } satisfies Record<string, PhonePlace>;
}

/** Right-hand column for lifted cards and Rumbi. */
export function column(L: Layout) {
  return L.format === 'story' ? { x: 765, w: 430 } : { x: 795, w: 350 };
}

/** Absolute position of a screen point (pt) on a flat phone, optionally scaled by the camera (s). */
export function onScreen(p: PhonePlace, px: number, py: number, s = 1) {
  const o = phonePt(p.w, px, py);
  return { x: p.x + o.x * s, y: p.y + o.y * s };
}

export function phoneTop(p: PhonePlace) {
  return p.y - phoneGeom(p.w).height / 2;
}
