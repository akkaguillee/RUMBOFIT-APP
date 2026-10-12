import type { Tip, TipTopic } from '@/domain/tips/types';

/**
 * Rumbi's faces. Each one is a pose of the same calm character: it only ever
 * changes its eyes, its tint and how it moves, never into anything sad or
 * guilty. Transient beats (blinks, glances, waking up, tap reactions) are
 * behaviours of the rig, not expressions.
 */
export const MASCOT_EXPRESSIONS = ['neutral', 'happy', 'proud', 'encouraging', 'thinking', 'sleepy', 'concerned', 'surprised'] as const;

export type MascotExpression = (typeof MASCOT_EXPRESSIONS)[number];

export const isMascotExpression = (v: unknown): v is MascotExpression => MASCOT_EXPRESSIONS.includes(v as MascotExpression);

/** The face that suits each topic when the tip itself says nothing more specific. */
export const TOPIC_EXPRESSIONS: Record<TipTopic, MascotExpression> = {
  celebrate: 'proud',
  consistency: 'happy',
  progress: 'happy',
  comeback: 'encouraging',
  start: 'encouraging',
  time: 'encouraging',
  mindset: 'encouraging',
  steps: 'encouraging',
  training: 'encouraging',
  recovery: 'sleepy',
  sleep: 'sleepy',
  stress: 'concerned',
  wellbeing: 'concerned',
  water: 'neutral',
  weighing: 'neutral',
  food: 'neutral',
  profile: 'neutral',
};

/**
 * Tips whose message differs from their topic's usual mood (ids from
 * `src/domain/tips/rules.ts`). Unknown ids simply fall back to the topic.
 */
export const TIP_EXPRESSIONS: Readonly<Record<string, MascotExpression>> = {
  // Moments
  'workout-done': 'proud',
  'goals-all-met': 'proud',
  'weight-goal-reached': 'proud',
  // A missed day or a slower stretch: kind and calm, never a telling-off.
  'consistency-not-two': 'encouraging',
  'progress-nonlinear': 'concerned',
  'progress-gradual': 'concerned',
  // Good weeks
  'steps-week': 'happy',
  'streak-strong': 'happy',
  'streak-building': 'happy',
  'progress-on-track': 'happy',
  // Plain information
  'general-today': 'neutral',
  'training-active': 'encouraging',
};

/** Late evening and night (22:00–05:59): a neutral face winds down to sleepy. */
export const isLateHour = (hour: number) => hour >= 22 || hour < 6;

/** The face for one tip. `hour` (0–23, local) only softens a neutral face late at night. */
export function expressionForTip(tip: Pick<Tip, 'id' | 'topic'>, hour?: number): MascotExpression {
  const face = TIP_EXPRESSIONS[tip.id] ?? TOPIC_EXPRESSIONS[tip.topic] ?? 'neutral';
  return face === 'neutral' && hour !== undefined && isLateHour(hour) ? 'sleepy' : face;
}

export type TipMoodState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; main: Pick<Tip, 'id' | 'topic'>; extra?: Pick<Tip, 'id' | 'topic'> };

/**
 * Rumbi's face for the tip card. Loading → thinking; nothing to say → neutral
 * (sleepy late at night); otherwise the main tip's face. An extra tip ("Un paso
 * más") always reacts to something good that just happened, so it wins and is
 * at least happy.
 */
export function mascotExpression(state: TipMoodState, hour?: number): MascotExpression {
  if (state.status === 'loading') return 'thinking';
  if (state.status === 'empty') return hour !== undefined && isLateHour(hour) ? 'sleepy' : 'neutral';
  if (state.extra) return expressionForTip(state.extra) === 'proud' ? 'proud' : 'happy';
  return expressionForTip(state.main, hour);
}
