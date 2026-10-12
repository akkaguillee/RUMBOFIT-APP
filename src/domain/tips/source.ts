import type { TipContext } from './context';
import { RULES } from './rules';
import type { TipCandidate, TipRule, TipSource } from './types';

const applies = (rule: TipRule, ctx: TipContext) => !(ctx.gentle && !rule.gentle);

const candidate = (rule: TipRule, ctx: TipContext): TipCandidate => ({
  id: rule.id,
  topic: rule.topic,
  ...rule.build(ctx),
  priority: rule.priority(ctx),
  ...(rule.weight ? { weight: true } : {}),
  ...(rule.event ? { event: rule.event } : {}),
});

/** A source backed by a list of rule templates. */
export function rulesSource(id: string, rules: readonly TipRule[]): TipSource {
  const byId = new Map(rules.map((r) => [r.id, r]));
  return {
    id,
    candidates: (ctx) => rules.filter((r) => applies(r, ctx) && r.when(ctx)).map((r) => candidate(r, ctx)),
    resume: (tipId, ctx) => {
      const rule = byId.get(tipId);
      if (!rule || !applies(rule, ctx) || !(rule.holds ?? rule.when)(ctx)) return null;
      return candidate(rule, ctx);
    },
  };
}

/** The built-in, hand-written tips. */
export const ruleSource = rulesSource('rules', RULES);

/**
 * Sources asked for tips, in order (the first one that knows an id wins).
 *
 * A future AI-generated source would be one more `TipSource` here: tips are
 * generated elsewhere (a server job, or an explicit user action), validated and
 * stored locally, and the source only reads that cache synchronously, returning
 * candidates with a priority and `weight`/`event` flags like the rules do.
 * Selection, safety checks (`isSafeTip`), persistence and the card stay the same.
 */
export const DEFAULT_SOURCES: readonly TipSource[] = [ruleSource];
