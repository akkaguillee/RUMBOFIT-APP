import type { DockSide } from './prefs';

/**
 * Where floating Rumbi may rest: the band of the screen between the header
 * and the bottom navigation (or anything else docked there, like the rest
 * timer), inside the side margins. Coordinates are CSS pixels of the viewport.
 */
export interface DockArea {
  /** Left edge Rumbi may touch (after the desktop sidebar, if any). */
  left: number;
  /** Right edge Rumbi may touch. */
  right: number;
  /** Lowest y for Rumbi's top edge. */
  top: number;
  /** Highest y for Rumbi's bottom edge. */
  bottom: number;
  /** Whether the dock edges are the screen edges, so Rumbi can tuck into them when idle. */
  edgeToEdge: boolean;
}

export interface Point {
  x: number;
  y: number;
}

/** Share of Rumbi pushed past the dock edge while it rests out of the way (about half ends off screen). */
export const TUCK = 0.6;
/** A horizontal flick faster than this (px/s) sends Rumbi to that side, wherever it is dropped. */
export const FLICK_SPEED = 650;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Height of the band Rumbi's top edge can move in. */
const travel = (area: DockArea, size: number) => Math.max(0, area.bottom - area.top - size);

/** Top-left corner of Rumbi docked on `side` at relative height `y` (0–1). */
export function dockPoint(side: DockSide, y: number, area: DockArea, size: number, tucked = false): Point {
  const tuck = tucked && area.edgeToEdge;
  const x =
    side === 'left' ? (tuck ? area.left - size * TUCK : area.left) : tuck ? area.right - size * (1 - TUCK) : area.right - size;
  return { x, y: area.top + clamp01(y) * travel(area, size) };
}

/**
 * Where a drag ends: the nearer edge (or the one a quick flick points to) and
 * the relative height, clamped to the free band.
 */
export function settle(p: Point, area: DockArea, size: number, velocityX = 0): { side: DockSide; y: number } {
  const center = p.x + size / 2;
  let side: DockSide = center < (area.left + area.right) / 2 ? 'left' : 'right';
  if (velocityX > FLICK_SPEED) side = 'right';
  else if (velocityX < -FLICK_SPEED) side = 'left';
  const t = travel(area, size);
  return { side, y: t ? clamp01((p.y - area.top) / t) : 0 };
}

/**
 * While dragging Rumbi follows the finger freely, but beyond the screen it
 * resists (a rubber band), so it can never be lost off screen.
 */
export function rubberBand(value: number, min: number, max: number, give = 0.35): number {
  if (value < min) return min - (min - value) * give;
  if (value > max) return max + (value - max) * give;
  return value;
}
