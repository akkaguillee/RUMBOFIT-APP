import { describe, expect, it } from 'vitest';
import { MUSCLES } from '@/domain/training/anatomy';
import { bodyGeometry } from './geometry';

describe('body map geometry', () => {
  it('draws exactly the regions the model places in each view, for every figure', () => {
    for (const figure of ['male', 'female', 'neutral'] as const) {
      for (const view of ['front', 'back'] as const) {
        const drawn = bodyGeometry(figure, view).regions.map((r) => r.id).sort();
        const expected = MUSCLES.filter((m) => m.views.includes(view)).map((m) => m.id).sort();
        expect(drawn, `${figure} ${view}`).toEqual(expected);
      }
    }
  });

  it('produces closed, finite paths and changes only the shape between figures', () => {
    const male = bodyGeometry('male', 'front');
    const female = bodyGeometry('female', 'front');
    for (const g of [male, female, bodyGeometry('neutral', 'back')]) {
      expect(g.silhouette).toMatch(/^M[\d.\s-]+C/);
      expect(g.silhouette.endsWith('Z')).toBe(true);
      for (const r of g.regions) {
        expect(r.d).not.toMatch(/NaN|Infinity/);
        // Every region is drawn on both sides of the body.
        expect(r.d.match(/M/g)!.length % 2).toBe(0);
      }
    }
    expect(female.silhouette).not.toBe(male.silhouette);
    expect(female.regions.map((r) => r.id)).toEqual(male.regions.map((r) => r.id));
  });
});
