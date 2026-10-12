import { TIP_ROUTES, TIP_TOPICS, type TipCandidate, type TipContent } from './types';

/**
 * Words and phrases a tip must never contain, whatever its source: extreme
 * restriction, compensating food with exercise, guilt or labels about bodies.
 * Matched case- and accent-insensitively on whole words or phrases.
 */
export const FORBIDDEN_TERMS = [
  'ayuno',
  'ayunar',
  'ayunas',
  'quemar calorías',
  'quema calorías',
  'compensar',
  'castigo',
  'castigar',
  'culpa',
  'culpable',
  'pecado',
  'detox',
  'prohibido',
  'prohibida',
  'sin excusas',
  'no comas',
  'saltarte comidas',
  'gordo',
  'gorda',
] as const;

/** Weight-change vocabulary that minors and health-flag profiles never see. */
export const WEIGHT_CHANGE_TERMS = ['déficit', 'superávit', 'perder peso', 'perder grasa', 'adelgazar', 'kcal', 'calorías'] as const;

const fold = (s: string) =>
  s
    .toLocaleLowerCase('es-ES')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matcher = (terms: readonly string[]) => new RegExp(`(^|[^\\p{L}])(${terms.map((t) => escape(fold(t))).join('|')})(?=$|[^\\p{L}])`, 'u');

const FORBIDDEN = matcher(FORBIDDEN_TERMS);
const WEIGHT_CHANGE = matcher(WEIGHT_CHANGE_TERMS);

const allText = (tip: TipContent) => fold([tip.title, tip.body, tip.action?.label ?? ''].join(' '));

export const containsForbidden = (tip: TipContent) => FORBIDDEN.test(allText(tip));
export const mentionsWeightChange = (tip: TipContent) => WEIGHT_CHANGE.test(allText(tip));

const ROUTES = new Set<string>(TIP_ROUTES);
const TOPICS = new Set<string>(TIP_TOPICS);

/**
 * Last line of defence for every candidate, from the rules or any future
 * source: a known topic (the card needs its icon, the history drops unknown
 * ones), non-empty copy, no forbidden words, only existing routes with a
 * visible label and, for minors or health flags, nothing about weight change.
 */
export function isSafeTip(tip: TipCandidate, gentle: boolean): boolean {
  if (!tip.id || !TOPICS.has(tip.topic) || !tip.title.trim() || !tip.body.trim()) return false;
  if (containsForbidden(tip)) return false;
  if (tip.action && (!ROUTES.has(tip.action.to) || !tip.action.label.trim())) return false;
  if (gentle && (tip.weight || mentionsWeightChange(tip))) return false;
  return true;
}
