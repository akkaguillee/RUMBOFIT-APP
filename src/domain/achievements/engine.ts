import type { AchievementUnlock, GoalType } from '../types';
import { ACHIEVEMENTS, META_ACHIEVEMENTS, RARITIES, type AchievementDef } from './catalog';
import { computeMetrics, type AchievementData, type Metrics } from './metrics';

export interface AchievementState {
  def: Omit<AchievementDef, 'metric'>;
  current: number;
  target: number;
  progress: number;
  /** Condition currently satisfied by the user's records. */
  achieved: boolean;
  applicable: boolean;
}

export function isApplicable(def: Pick<AchievementDef, 'requires'>, goal?: GoalType): boolean {
  if (def.requires === 'weight_goal') return goal === 'lose' || goal === 'gain';
  if (def.requires === 'maintain_goal') return goal === 'maintain';
  return true;
}

function evaluate({ metric, ...def }: AchievementDef, metrics: Metrics, goal?: GoalType): AchievementState {
  const raw = metric(metrics);
  const current = Math.min(raw, def.target);
  return {
    def,
    current,
    target: def.target,
    progress: def.target > 0 ? current / def.target : 0,
    achieved: raw >= def.target,
    // Weight-goal milestones remain visible if they were already earned under a previous goal.
    applicable: isApplicable(def, goal) || raw >= def.target,
  };
}

export function evaluateAchievements(data: AchievementData): { states: AchievementState[]; metrics: Metrics } {
  const base = computeMetrics(data);
  const goal = data.profile?.goal;
  const states = ACHIEVEMENTS.map((def) => evaluate(def, base, goal));
  // Meta milestones («Coleccionista»…) count the regular ones achieved.
  const metrics: Metrics = { ...base, milestonesAchieved: states.filter((s) => s.achieved).length };
  for (const def of META_ACHIEVEMENTS) states.push(evaluate(def, metrics, goal));
  return { states, metrics };
}

export interface UnlockDiff {
  unlock: string[];
  revoke: string[];
}

/**
 * Unlock policy:
 *  - An achievement is unlocked once when its condition is met (never twice).
 *  - Unlocks are kept while the records that justify them exist. If the user
 *    deletes or corrects those records, the achievement is recalculated and
 *    withdrawn, because achievements must always reflect real data.
 */
export function diffUnlocks(states: AchievementState[], persisted: AchievementUnlock[]): UnlockDiff {
  const have = new Set(persisted.map((u) => u.id));
  const unlock: string[] = [];
  const revoke: string[] = [];
  for (const s of states) {
    if (s.achieved && !have.has(s.def.id)) unlock.push(s.def.id);
    if (!s.achieved && have.has(s.def.id)) revoke.push(s.def.id);
  }
  return { unlock, revoke };
}

/** Closest reachable locked achievement, preferring the most advanced and the least rare. */
export function nextAchievement(states: AchievementState[]): AchievementState | undefined {
  return states
    .filter((s) => !s.achieved && s.applicable)
    .sort(
      (a, b) =>
        b.progress - a.progress ||
        RARITIES[a.def.rarity].order - RARITIES[b.def.rarity].order ||
        a.target - b.target,
    )[0];
}
