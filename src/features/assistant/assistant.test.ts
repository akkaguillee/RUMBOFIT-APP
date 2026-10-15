import { describe, expect, it } from 'vitest';
import { dockPoint, FLICK_SPEED, rubberBand, settle, TUCK, type DockArea } from './geometry';
import { rumbiFace, rumbiLines, type RumbiMoment } from './messages';
import { DEFAULT_RUMBI, parseRumbiPrefs } from './prefs';

const phone: DockArea = { left: 8, right: 382, top: 120, bottom: 744, edgeToEdge: true };
const SIZE = 56;

describe('floating Rumbi geometry', () => {
  it('docks inside the free band, on either side', () => {
    expect(dockPoint('right', 0, phone, SIZE)).toEqual({ x: 382 - 56, y: 120 });
    expect(dockPoint('left', 1, phone, SIZE)).toEqual({ x: 8, y: 744 - 56 });
    // Out-of-range heights are clamped.
    expect(dockPoint('left', 3, phone, SIZE).y).toBe(744 - 56);
    expect(dockPoint('left', -1, phone, SIZE).y).toBe(120);
  });

  it('tucks partly into the screen edge only when the dock edge is the screen edge', () => {
    expect(dockPoint('left', 0.5, phone, SIZE, true).x).toBeCloseTo(8 - SIZE * TUCK);
    expect(dockPoint('right', 0.5, phone, SIZE, true).x).toBeCloseTo(382 - SIZE * (1 - TUCK));
    const desktop = { ...phone, left: 280, right: 1430, edgeToEdge: false };
    expect(dockPoint('left', 0.5, desktop, SIZE, true).x).toBe(280);
  });

  it('settles on the nearer edge and keeps the height relative to the band', () => {
    expect(settle({ x: 40, y: 120 }, phone, SIZE)).toEqual({ side: 'left', y: 0 });
    expect(settle({ x: 300, y: 744 - 56 }, phone, SIZE)).toEqual({ side: 'right', y: 1 });
    expect(settle({ x: 300, y: 120 + (744 - 120 - 56) / 2 }, phone, SIZE).y).toBeCloseTo(0.5);
    // Dropped past the band: clamped.
    expect(settle({ x: 300, y: 2000 }, phone, SIZE).y).toBe(1);
  });

  it('follows a quick horizontal flick', () => {
    expect(settle({ x: 40, y: 300 }, phone, SIZE, FLICK_SPEED + 1).side).toBe('right');
    expect(settle({ x: 300, y: 300 }, phone, SIZE, -FLICK_SPEED - 1).side).toBe('left');
    expect(settle({ x: 300, y: 300 }, phone, SIZE, -100).side).toBe('right');
  });

  it('resists being dragged off screen', () => {
    expect(rubberBand(50, 0, 100)).toBe(50);
    expect(rubberBand(-100, 0, 100)).toBeCloseTo(-35);
    expect(rubberBand(200, 0, 100)).toBeCloseTo(135);
  });
});

describe('floating Rumbi preferences', () => {
  it('falls back to the defaults field by field', () => {
    expect(parseRumbiPrefs(null)).toEqual(DEFAULT_RUMBI);
    expect(parseRumbiPrefs('not json')).toEqual(DEFAULT_RUMBI);
    expect(parseRumbiPrefs('{"enabled":false}')).toEqual({ ...DEFAULT_RUMBI, enabled: false });
    expect(parseRumbiPrefs('{"side":"left","y":0.2}')).toEqual({ ...DEFAULT_RUMBI, side: 'left', y: 0.2 });
    expect(parseRumbiPrefs('{"side":"top","y":9}')).toEqual({ ...DEFAULT_RUMBI, y: 1 });
  });
});

describe("Rumbi's lines", () => {
  const base: RumbiMoment = { hour: 10, streak: 0, recordedToday: true, goalsMet: 0, goalsTotal: 2, workoutToday: false };

  it('leads with what happened today', () => {
    expect(rumbiLines({ ...base, goalsMet: 2 })[0]).toBe('¡objetivos de hoy, cumplidos!');
    expect(rumbiLines({ ...base, workoutToday: true })[0]).toBe('entreno completado, ¡bravo!');
    expect(rumbiLines({ ...base, streak: 17 })[0]).toBe('17 días seguidos, ¡sigue así!');
    expect(rumbiLines({ ...base, streak: 3 })[0]).toBe('la racha va cogiendo forma');
    expect(rumbiLines({ ...base, recordedToday: false })[0]).toBe('¿empezamos con un vaso de agua?');
    expect(rumbiLines({ ...base, recordedToday: false, hour: 17 })[0]).toBe('aún estás a tiempo de sumar');
  });

  it('winds down at night and stays short enough for handwriting', () => {
    expect(rumbiLines({ ...base, hour: 23 })).toContain('descansar también es progresar');
    for (const hour of [0, 8, 15, 20]) {
      const lines = rumbiLines({ ...base, hour, streak: 120, goalsMet: 2, workoutToday: true, recordedToday: false });
      expect(new Set(lines).size).toBe(lines.length);
      for (const l of lines) expect(l.length).toBeLessThanOrEqual(34);
    }
  });

  it('chooses a calm resting face', () => {
    expect(rumbiFace({ ...base, hour: 23, goalsMet: 2 })).toBe('sleepy');
    expect(rumbiFace({ ...base, goalsMet: 2 })).toBe('proud');
    expect(rumbiFace({ ...base, workoutToday: true })).toBe('proud');
    expect(rumbiFace(base)).toBe('happy');
  });
});
