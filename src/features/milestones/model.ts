import { RARITIES, type CategoryId, type Rarity } from '@/domain/achievements/catalog';
import type { AchievementState } from '@/domain/achievements/engine';
import type { AchievementUnlock } from '@/domain/types';

/**
 * done: unlocked (persisted). progress: some real progress, not finished.
 * locked: nothing yet. na: depends on a goal the user doesn't have now.
 */
export type ItemStatus = 'done' | 'progress' | 'locked' | 'na';
export type StatusFilter = 'all' | 'done' | 'progress' | 'locked';

export interface MilestoneItem {
  state: AchievementState;
  status: ItemStatus;
  unlockedAt?: number;
  /** Position in the catalog (progression order inside each category). */
  order: number;
}

export interface MilestoneGroup {
  rarity: Rarity;
  label: string;
  hint: string;
  /** Unlocked / total in this rarity (the category filter applies, the status filter doesn't). */
  done: number;
  total: number;
  /** Up to {@link PREVIEW_SIZE} representative milestones, shown before expanding. */
  preview: MilestoneItem[];
  /** The rest of the group (after the status filter), revealed by «Ver todos». */
  rest: MilestoneItem[];
}

export const PREVIEW_SIZE = 5;

export const RARITY_ORDER = (Object.keys(RARITIES) as Rarity[]).sort((a, b) => RARITIES[a].order - RARITIES[b].order);

export const RARITY_HINTS: Record<Rarity, string> = {
  common: 'Llegan enseguida.',
  uncommon: 'Hábitos que toman forma.',
  rare: 'Semanas de constancia.',
  epic: 'Meses de trabajo sostenido.',
  legendary: 'Retos de largo plazo.',
};

export function itemStatus(state: AchievementState, unlockedAt: number | undefined): ItemStatus {
  if (unlockedAt !== undefined) return 'done';
  if (!state.applicable) return 'na';
  return state.current > 0 ? 'progress' : 'locked';
}

export function matchesStatus(status: ItemStatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'locked') return status === 'locked' || status === 'na';
  return status === filter;
}

export function toItems(states: AchievementState[], unlocks: ReadonlyMap<string, Pick<AchievementUnlock, 'unlockedAt'>>): MilestoneItem[] {
  return states.map((state, order) => {
    const unlockedAt = unlocks.get(state.def.id)?.unlockedAt;
    return { state, status: itemStatus(state, unlockedAt), unlockedAt, order };
  });
}

/**
 * Picks the milestones a collapsed group shows: what is closest to completion
 * (up to three), the most recent unlocks (up to two), then what comes next in
 * progression order. Returns them, and the rest, in one reading order:
 * in progress (closest first) → unlocked (newest first) → locked → not applicable.
 */
export function pickPreview(items: MilestoneItem[], size = PREVIEW_SIZE): { preview: MilestoneItem[]; rest: MilestoneItem[] } {
  const inProgress = items
    .filter((i) => i.status === 'progress')
    .sort((a, b) => b.state.progress - a.state.progress || a.state.target - b.state.target || a.order - b.order);
  const done = items.filter((i) => i.status === 'done').sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0) || a.order - b.order);
  const locked = items.filter((i) => i.status === 'locked').sort((a, b) => a.order - b.order);
  const na = items.filter((i) => i.status === 'na').sort((a, b) => a.order - b.order);

  const picked = new Set<MilestoneItem>();
  const take = (list: MilestoneItem[], max: number) => {
    let n = 0;
    for (const it of list) {
      if (picked.size >= size || n >= max) return;
      if (picked.has(it)) continue;
      picked.add(it);
      n += 1;
    }
  };
  take(inProgress, 3);
  take(done, 2);
  take(inProgress, size);
  take(locked, size);
  take(done, size);
  take(na, size);

  const ordered = [...inProgress, ...done, ...locked, ...na];
  return { preview: ordered.filter((i) => picked.has(i)), rest: ordered.filter((i) => !picked.has(i)) };
}

/** Rarity blocks (Común → Legendario) with their preview and the rest. Empty blocks are left out. */
export function buildGroups(items: MilestoneItem[], filter: { status: StatusFilter; category: CategoryId | 'all' }): MilestoneGroup[] {
  return RARITY_ORDER.flatMap((rarity): MilestoneGroup[] => {
    const inGroup = items.filter((i) => i.state.def.rarity === rarity && (filter.category === 'all' || i.state.def.category === filter.category));
    const visible = inGroup.filter((i) => matchesStatus(i.status, filter.status));
    if (!visible.length) return [];
    return [
      {
        rarity,
        label: RARITIES[rarity].label,
        hint: RARITY_HINTS[rarity],
        done: inGroup.filter((i) => i.status === 'done').length,
        total: inGroup.length,
        ...pickPreview(visible),
      },
    ];
  });
}
