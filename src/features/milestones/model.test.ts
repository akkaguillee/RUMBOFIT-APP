import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_DEFS, type CategoryId, type Rarity } from '@/domain/achievements/catalog';
import type { AchievementState } from '@/domain/achievements/engine';
import { ACHIEVEMENT_ICONS, RARITY_COLORS } from './icons';
import { buildGroups, itemStatus, pickPreview, PREVIEW_SIZE, toItems, type MilestoneItem } from './model';

let n = 0;
function st(over: { id?: string; rarity?: Rarity; category?: CategoryId; current?: number; target?: number; applicable?: boolean } = {}): AchievementState {
  const target = over.target ?? 10;
  const current = over.current ?? 0;
  return {
    def: {
      id: over.id ?? `m${n++}`,
      name: 'Hito',
      description: 'Descripción de prueba.',
      category: over.category ?? 'consistency',
      icon: 'star',
      rarity: over.rarity ?? 'common',
      target,
    },
    current,
    target,
    progress: current / target,
    achieved: current >= target,
    applicable: over.applicable ?? true,
  };
}

const item = (state: AchievementState, order: number, unlockedAt?: number): MilestoneItem => ({
  state,
  status: itemStatus(state, unlockedAt),
  unlockedAt,
  order,
});

describe('milestone status', () => {
  it('tells unlocked, in progress, locked and not applicable apart', () => {
    expect(itemStatus(st({ current: 10 }), 123)).toBe('done');
    expect(itemStatus(st({ current: 3 }), undefined)).toBe('progress');
    expect(itemStatus(st({ current: 0 }), undefined)).toBe('locked');
    expect(itemStatus(st({ current: 0, applicable: false }), undefined)).toBe('na');
    // Only a persisted unlock counts as unlocked (the sync writes it).
    expect(itemStatus(st({ current: 10 }), undefined)).toBe('progress');
  });
});

describe('collapsed preview', () => {
  it('shows the closest to completion and the newest unlocks, five at most', () => {
    const items = [
      item(st({ current: 2 }), 0),
      item(st({ current: 9 }), 1),
      item(st({ current: 5 }), 2),
      item(st({ current: 7 }), 3),
      item(st({ current: 10 }), 4, 100),
      item(st({ current: 10 }), 5, 300),
      item(st({ current: 10 }), 6, 200),
      item(st({ current: 0 }), 7),
    ];
    const { preview, rest } = pickPreview(items);
    expect(preview).toHaveLength(PREVIEW_SIZE);
    // Three in progress, closest first; then the two newest unlocks.
    expect(preview.map((i) => i.order)).toEqual([1, 3, 2, 5, 6]);
    expect(rest.map((i) => i.order)).toEqual([0, 4, 7]);
    // Nothing is lost or repeated.
    expect(new Set([...preview, ...rest]).size).toBe(items.length);
  });

  it('fills with what comes next in progression order when there is little going on', () => {
    const items = [item(st({ current: 0 }), 3), item(st({ current: 0 }), 1), item(st({ current: 4 }), 2), item(st({ current: 0, applicable: false }), 0)];
    const { preview, rest } = pickPreview(items);
    expect(preview.map((i) => i.order)).toEqual([2, 1, 3, 0]);
    expect(rest).toHaveLength(0);
  });

  it('prefers more in-progress milestones over older unlocks, and those over locked ones', () => {
    const items = [
      ...[1, 2, 3, 4].map((c, i) => item(st({ current: c }), i)),
      ...[10, 11, 12].map((at, i) => item(st({ current: 10 }), 10 + i, at)),
      item(st({ current: 0 }), 20),
    ];
    const { preview } = pickPreview(items);
    expect(preview.map((i) => i.status)).toEqual(['progress', 'progress', 'progress', 'done', 'done']);
    expect(preview.map((i) => i.order)).toEqual([3, 2, 1, 12, 11]);
  });
});

describe('rarity groups', () => {
  const states = [
    st({ id: 'a', rarity: 'common', category: 'hydration', current: 10 }),
    st({ id: 'b', rarity: 'common', category: 'steps', current: 3 }),
    st({ id: 'c', rarity: 'legendary', category: 'hydration' }),
    st({ id: 'd', rarity: 'rare', category: 'gym', current: 1 }),
  ];
  const items = toItems(states, new Map([['a', { unlockedAt: 5 }]]));

  it('builds the blocks in rarity order and leaves empty ones out', () => {
    const groups = buildGroups(items, { status: 'all', category: 'all' });
    expect(groups.map((g) => g.rarity)).toEqual(['common', 'rare', 'legendary']);
    expect(groups[0]).toMatchObject({ label: 'Común', done: 1, total: 2 });
  });

  it('filters by category and by status, keeping the block totals', () => {
    const water = buildGroups(items, { status: 'all', category: 'hydration' });
    expect(water.map((g) => g.rarity)).toEqual(['common', 'legendary']);
    const inProgress = buildGroups(items, { status: 'progress', category: 'all' });
    expect(inProgress.map((g) => [g.rarity, g.preview.map((i) => i.state.def.id)])).toEqual([
      ['common', ['b']],
      ['rare', ['d']],
    ]);
    // The header still counts the whole block (1 of 2 unlocked), not just the filtered cards.
    expect(inProgress[0]).toMatchObject({ done: 1, total: 2 });
    const locked = buildGroups(items, { status: 'locked', category: 'all' });
    expect(locked.map((g) => g.rarity)).toEqual(['legendary']);
  });

  it('keeps every real milestone reachable from its block', () => {
    const real = ACHIEVEMENT_DEFS.map((def, i) => st({ id: def.id, rarity: def.rarity, category: def.category, current: i % 3 }));
    const groups = buildGroups(toItems(real, new Map()), { status: 'all', category: 'all' });
    const shown = groups.flatMap((g) => [...g.preview, ...g.rest].map((i) => i.state.def.id));
    expect(shown.sort()).toEqual(ACHIEVEMENT_DEFS.map((d) => d.id).sort());
    for (const g of groups) expect(g.preview.length).toBeLessThanOrEqual(PREVIEW_SIZE);
  });
});

describe('milestone artwork', () => {
  it('has an icon for every milestone and colours for every rarity', () => {
    for (const def of ACHIEVEMENT_DEFS) expect(ACHIEVEMENT_ICONS[def.icon], def.id).toBeTruthy();
    for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary'] as Rarity[]) expect(RARITY_COLORS[r]).toBeTruthy();
  });
});
