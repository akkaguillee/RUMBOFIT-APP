import type { DateKey } from '../dates';
import type { TipContext } from './context';

/** What a tip is about. The UI maps each topic to an icon and a short label. */
export const TIP_TOPICS = [
  'start',
  'comeback',
  'consistency',
  'celebrate',
  'recovery',
  'progress',
  'weighing',
  'water',
  'steps',
  'training',
  'sleep',
  'stress',
  'time',
  'food',
  'mindset',
  'profile',
  'wellbeing',
] as const;

export type TipTopic = (typeof TIP_TOPICS)[number];

/** The only places a tip may link to (existing routes and tabs). */
export const TIP_ROUTES = [
  '/',
  '/progresos',
  '/progresos?tab=imc',
  '/progresos?tab=calorias',
  '/calendario',
  '/entreno',
  '/entreno?tab=historial',
  '/entreno/sesion',
  '/habitos',
  '/habitos?tab=pasos',
  '/hitos',
  '/perfil',
  '/perfil#preferencias',
  '/perfil#personal',
  '/perfil#goal',
] as const;

export type TipRoute = (typeof TIP_ROUTES)[number];

export interface TipAction {
  label: string;
  to: TipRoute;
}

export interface TipContent {
  title: string;
  body: string;
  action?: TipAction;
}

export interface Tip extends TipContent {
  id: string;
  topic: TipTopic;
}

/**
 * Changes during the day that justify one extra tip ("Un paso más"):
 * a first record after ≥ 3 days away, every daily goal met, a finished
 * workout, or the weight goal reached.
 */
export type TipEvent = 'comeback' | 'allGoals' | 'workout' | 'weightGoal';

export const TIP_EVENTS: readonly TipEvent[] = ['comeback', 'allGoals', 'workout', 'weightGoal'];

export interface TipRule {
  id: string;
  topic: TipTopic;
  /**
   * Suitable for minors and health-flag situations: general wellbeing only
   * (nothing about weight, food amounts, calories or pushing harder).
   */
  gentle?: boolean;
  /** Talks about weight change: never shown to minors or with health flags. */
  weight?: boolean;
  /** Reaction to a change during the day; eligible as the extra tip. */
  event?: TipEvent;
  /** Whether the tip can be chosen now. */
  when: (ctx: TipContext) => boolean;
  /** Whether a tip chosen earlier today still makes sense (defaults to `when`). */
  holds?: (ctx: TipContext) => boolean;
  /** Higher wins. Bands: 90+ moments, 60–89 today's data, 35–59 profile, < 35 general. */
  priority: (ctx: TipContext) => number;
  build: (ctx: TipContext) => TipContent;
}

/** A tip that applies right now, as proposed by a source. */
export interface TipCandidate extends Tip {
  priority: number;
  weight?: boolean;
  event?: TipEvent;
}

/**
 * Anything that can propose tips for a context. Today only the built-in rules
 * (`ruleSource`); an AI-generated source could be added later by returning
 * candidates from a local cache, without touching the selection or the UI.
 * Must be pure and synchronous: no network calls during selection.
 */
export interface TipSource {
  id: string;
  /** Tips that could be chosen now. */
  candidates: (ctx: TipContext) => TipCandidate[];
  /** A tip chosen earlier today, rebuilt with today's data, or null when it no longer applies. */
  resume: (id: string, ctx: TipContext) => TipCandidate | null;
}

/** Signals compared during the day to detect a significant change. */
export type TipSignals = Record<TipEvent, boolean>;

/** The day's choice, persisted so the tip stays the same all day. */
export interface TipDayRecord {
  date: DateKey;
  mainId: string;
  /** Signals when the day's first tip was chosen. */
  baseline: TipSignals;
  /** The day's only extra tip, once chosen (kept even if it stops applying, so no second one appears). */
  extraId?: string;
}

export interface ShownTip {
  id: string;
  topic: TipTopic;
  date: DateKey;
}

export interface TipHistory {
  /** Stored choice for today, if any (records for other days are ignored). */
  day?: TipDayRecord | null;
  /** Tips shown recently, any order. */
  recent: ShownTip[];
}

export interface DailyTips {
  main: Tip;
  extra?: Tip;
  /** What to persist for today (equal to the stored record when nothing changed). */
  record: TipDayRecord;
}
