import { describe, expect, it } from 'vitest';
import { RULES } from '@/domain/tips/rules';
import { TIP_TOPICS } from '@/domain/tips/types';
import { expressionForTip, isMascotExpression, mascotExpression, TIP_EXPRESSIONS, TOPIC_EXPRESSIONS } from './expression';

describe('Rumbi expressions', () => {
  it('has a face for every tip topic and only known ids in the overrides', () => {
    for (const topic of TIP_TOPICS) expect(isMascotExpression(TOPIC_EXPRESSIONS[topic])).toBe(true);
    const ids = new Set(RULES.map((r) => r.id));
    for (const id of Object.keys(TIP_EXPRESSIONS)) expect(ids.has(id), id).toBe(true);
  });

  it('celebrates moments, encourages comebacks and stays gentle with stress', () => {
    expect(expressionForTip({ id: 'goals-all-met', topic: 'celebrate' })).toBe('proud');
    expect(expressionForTip({ id: 'comeback-return', topic: 'comeback' })).toBe('encouraging');
    expect(expressionForTip({ id: 'any-stress-tip', topic: 'stress' })).toBe('concerned');
  });

  it('thinks while loading and winds a neutral face down late at night', () => {
    expect(mascotExpression({ status: 'loading' })).toBe('thinking');
    expect(expressionForTip({ id: 'general-today', topic: 'water' }, 23)).toBe('sleepy');
    expect(expressionForTip({ id: 'general-today', topic: 'water' }, 11)).toBe('neutral');
  });

  it('lets a fresh extra tip lift the mood to at least happy', () => {
    const face = mascotExpression({ status: 'ready', main: { id: 'general-today', topic: 'water' }, extra: { id: 'goals-all-met', topic: 'celebrate' } }, 11);
    expect(['happy', 'proud']).toContain(face);
  });
});
