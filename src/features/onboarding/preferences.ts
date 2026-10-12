import { Armchair, Footprints, PersonStanding, type LucideIcon } from 'lucide-react';
import { calculateBmi, estimateActivityLevel, suggestWaterGoal, weightForBmi } from '@/domain/health';
import type { ActivityLevel, ActivityProfile, Allergen, ExperienceLevel, FoodHabits, GoalType, MotivationProfile, Profile, Wellbeing } from '@/domain/types';
import { checkRange, LIMITS } from '@/domain/validation';
import { goalLabel } from '../shared/labels';

/**
 * Wording and pure helpers for the personalisation answers gathered in
 * onboarding and edited in Perfil → Tu personalización. Shared so both screens
 * (and the coach) always use the same labels.
 *
 * "unsure" = «No lo sé / No estoy seguro»; "skip" = «Prefiero no responder».
 * Options flagged `quiet` are those meta answers: they are drawn more softly.
 */

export interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: LucideIcon;
  quiet?: boolean;
}

export type Posture = ActivityProfile['posture'];
export type Job = ActivityProfile['job'];
export type ActivityType = ActivityProfile['activityTypes'][number];
type Answer<T> = NonNullable<T>;
type Item<T> = NonNullable<T> extends readonly (infer U)[] ? U : never;

const UNSURE = 'No lo sé';
const SKIP = 'Prefiero no responder';

// ── Objetivos ──────────────────────────────────────────────────────────

/** Main goal as chosen on screen: one of the goals, or a personal goal written by the user. */
export type GoalChoice = GoalType | 'other';

export const GOAL_NOTE_MAX = 80;
export const SECONDARY_MAX = 3;

/** «Otro objetivo personal» is stored as the habits goal plus the user's own words. */
export const goalChoiceOf = (goal: GoalType, note?: string): GoalChoice => (goal === 'habits' && note ? 'other' : goal);

export function goalFromChoice(choice: GoalChoice, note: string): { goal: GoalType; goalNote?: string } {
  if (choice !== 'other') return { goal: choice };
  const clean = cleanText(note, GOAL_NOTE_MAX);
  return { goal: 'habits', ...(clean ? { goalNote: clean } : {}) };
}

/** "Perder grasa", or the user's own goal in their words. */
export const mainGoalLabel = (p: Pick<Profile, 'goal' | 'goalNote'>) => (p.goal === 'habits' && p.goalNote ? p.goalNote : goalLabel(p.goal));

export const TARGET_NEEDS_HEIGHT = 'Indica tu altura para comprobar que el objetivo es saludable.';

/**
 * Why a target weight cannot be saved, or null. Weights in kg; `format`
 * renders a weight in the user's units for the message. A target always needs
 * the height, so it can never fall below a BMI of 18.5.
 */
export function targetWeightError(goal: GoalType, targetKg: number | null, refKg: number | null, heightCm: number | null, format: (kg: number) => string): string | null {
  if (targetKg === null) return null;
  const range = checkRange(targetKg, LIMITS.weightKg);
  if (range) return range;
  if (refKg !== null) {
    if (goal === 'lose' && targetKg >= refKg) return 'Para perder grasa, el objetivo debe ser menor que tu peso de partida.';
    if (goal === 'gain' && targetKg <= refKg) return 'Para ganar masa muscular, el objetivo debe ser mayor que tu peso de partida.';
  }
  if (!heightCm) return TARGET_NEEDS_HEIGHT;
  if (calculateBmi(targetKg, heightCm) < 18.5) {
    return `Por tu salud, RUMBO no permite objetivos por debajo de un IMC de 18,5 (${format(weightForBmi(18.5, heightCm))} para tu altura).`;
  }
  return null;
}

// ── Actividad cotidiana ────────────────────────────────────────────────

export const POSTURE_OPTIONS: Option<Posture>[] = [
  { value: 'sitting', label: 'Sentado', description: 'Oficina o estudio', icon: Armchair },
  { value: 'standing', label: 'De pie', description: 'Tienda o aula', icon: PersonStanding },
  { value: 'moving', label: 'En movimiento', description: 'Caminas o cargas', icon: Footprints },
];

export const JOB_OPTIONS: Option<Job>[] = [
  { value: 'desk', label: 'Oficina o escritorio' },
  { value: 'standing', label: 'De pie' },
  { value: 'physical', label: 'Físico o manual' },
  { value: 'student', label: 'Estudio' },
  { value: 'home', label: 'Hogar y cuidados' },
  { value: 'none', label: 'Ahora no trabajo' },
  { value: 'other', label: 'Otro' },
];

export const EXERCISE_OPTIONS: Option<'yes' | 'no'>[] = [
  { value: 'yes', label: 'Sí' },
  { value: 'no', label: 'No' },
];

export const ACTIVITY_TYPE_OPTIONS: Option<ActivityType>[] = [
  { value: 'strength', label: 'Fuerza o pesas' },
  { value: 'cardio', label: 'Correr o bici' },
  { value: 'walking', label: 'Caminar' },
  { value: 'sports', label: 'Deportes' },
  { value: 'yoga', label: 'Yoga o pilates' },
  { value: 'other', label: 'Otra' },
];

export const EXPERIENCE_OPTIONS: Option<ExperienceLevel>[] = [
  { value: 'beginner', label: 'Principiante', description: 'Empiezo o llevo menos de 6 meses.' },
  { value: 'intermediate', label: 'Intermedio', description: 'De 6 meses a 2 años con regularidad.' },
  { value: 'advanced', label: 'Avanzado', description: 'Más de 2 años y buena técnica.' },
];

/** Weekdays suggested when the user says they exercise (Monday, Wednesday, Friday). */
const DEFAULT_TRAINING_DAYS = [0, 2, 4];

/** Activity answers while they are being edited: anything can still be unanswered. */
export interface ActivityAnswers {
  posture: Posture | null;
  job: Job | null;
  exercises: boolean | null;
  /** Monday-based weekdays; only meaningful when `exercises` is true. */
  days: number[];
  types: ActivityType[];
  experience: ExperienceLevel | null;
}

export const EMPTY_ACTIVITY: ActivityAnswers = { posture: null, job: null, exercises: null, days: DEFAULT_TRAINING_DAYS, types: [], experience: null };

export function activityAnswersOf(p: Pick<Profile, 'activity' | 'trainingDays'>): ActivityAnswers {
  const a = p.activity;
  if (!a) return { ...EMPTY_ACTIVITY, days: p.trainingDays.length ? p.trainingDays : DEFAULT_TRAINING_DAYS };
  const exercises = a.trainingDays > 0;
  return {
    posture: a.posture,
    job: a.job,
    exercises,
    days: p.trainingDays.length ? p.trainingDays : DEFAULT_TRAINING_DAYS,
    types: exercises ? a.activityTypes : [],
    experience: exercises ? (a.experience ?? null) : null,
  };
}

export const activityStarted = (a: ActivityAnswers) => a.posture !== null || a.job !== null || a.exercises !== null;

/** What is still missing to estimate the activity level, once the user has started answering. */
export function activityMissing(a: ActivityAnswers): string | null {
  if (!activityStarted(a)) return null;
  const missing = [
    a.posture === null && 'cómo pasas el día',
    a.job === null && 'tu tipo de trabajo',
    a.exercises === null && 'si haces ejercicio',
  ].filter(Boolean) as string[];
  if (missing.length) return `Indica también ${joinList(missing)} para estimar tu nivel de actividad.`;
  if (a.exercises && a.days.length === 0) return 'Elige al menos un día o indica que ahora no haces ejercicio.';
  return null;
}

/** The stored activity profile, or undefined while it is incomplete. */
export function toActivityProfile(a: ActivityAnswers): ActivityProfile | undefined {
  if (a.posture === null || a.job === null || a.exercises === null) return undefined;
  const trainingDays = a.exercises ? a.days.length : 0;
  return {
    posture: a.posture,
    job: a.job,
    trainingDays,
    activityTypes: trainingDays > 0 ? a.types : [],
    ...(trainingDays > 0 && a.experience ? { experience: a.experience } : {}),
  };
}

/**
 * The stored activity answers once the training days change in Perfil → Hábitos,
 * cleaned like any other answer (no activity types or experience without
 * training). Undefined when the activity questions were never answered.
 */
export function activityWithDays(p: Pick<Profile, 'activity' | 'trainingDays'>, days: number[]): ActivityProfile | undefined {
  if (!p.activity) return undefined;
  return toActivityProfile({ ...activityAnswersOf(p), exercises: days.length > 0, days });
}

/** Weekdays to store as the usual training days. */
export const trainingDaysOf = (a: ActivityAnswers) => (a.exercises ? [...a.days].sort((x, y) => x - y) : []);

export function estimatedLevel(a: ActivityAnswers): ActivityLevel | null {
  const profile = toActivityProfile(a);
  return profile ? estimateActivityLevel(profile) : null;
}

export const trainingDaysText = (n: number) => (n === 0 ? 'Sin entreno habitual' : `${n} ${n === 1 ? 'día' : 'días'} de entreno`);

// ── Alimentación y hábitos ─────────────────────────────────────────────

export const FOOD_IMPROVE_OPTIONS: Option<Answer<FoodHabits['improve']>>[] = [
  { value: 'yes', label: 'Sí' },
  { value: 'a_bit', label: 'Un poco' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: UNSURE, quiet: true },
];

export const FOOD_QUALITY_OPTIONS: Option<Answer<FoodHabits['quality']>>[] = [
  { value: 'good', label: 'Buenos' },
  { value: 'irregular', label: 'Irregulares' },
  { value: 'improvable', label: 'Mejorables' },
  { value: 'unsure', label: 'No estoy seguro', quiet: true },
  { value: 'skip', label: SKIP, quiet: true },
];

export const FOOD_PATTERN_OPTIONS: Option<Answer<FoodHabits['pattern']>>[] = [
  { value: 'omnivore', label: 'Como de todo' },
  { value: 'flexitarian', label: 'Flexitariana' },
  { value: 'pescatarian', label: 'Pescetariana' },
  { value: 'vegetarian', label: 'Vegetariana' },
  { value: 'vegan', label: 'Vegana' },
  { value: 'none', label: 'Ninguno en concreto' },
  { value: 'unsure', label: UNSURE, quiet: true },
  { value: 'skip', label: SKIP, quiet: true },
];

export const ALLERGEN_OPTIONS: Option<Allergen>[] = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'lactose', label: 'Lactosa' },
  { value: 'egg', label: 'Huevo' },
  { value: 'nuts', label: 'Frutos secos' },
  { value: 'peanut', label: 'Cacahuete' },
  { value: 'soy', label: 'Soja' },
  { value: 'fish', label: 'Pescado' },
  { value: 'shellfish', label: 'Marisco' },
];

export const FOOD_DIFFICULTY_OPTIONS: Option<Item<FoodHabits['difficulties']>>[] = [
  { value: 'planning', label: 'Organizarme' },
  { value: 'portions', label: 'Las cantidades' },
  { value: 'consistency', label: 'Ser constante' },
  { value: 'choosing', label: 'Elegir alimentos' },
  { value: 'impulse', label: 'Comer por impulso' },
];

export const EATING_OUT_OPTIONS: Option<Answer<FoodHabits['eatingOut']>>[] = [
  { value: 'rarely', label: 'Casi nunca' },
  { value: 'weekly', label: 'Una vez por semana' },
  { value: 'several', label: 'Varias por semana' },
  { value: 'daily', label: 'A diario' },
  { value: 'unsure', label: UNSURE, quiet: true },
];

export const WATER_OPTIONS: Option<Answer<FoodHabits['water']>>[] = [
  { value: 'low', label: 'Menos de 1 litro' },
  { value: 'medium', label: 'De 1 a 2 litros' },
  { value: 'high', label: 'Más de 2 litros' },
  { value: 'unsure', label: UNSURE, quiet: true },
];

export const MEAL_SCHEDULE_OPTIONS: Option<Answer<FoodHabits['schedule']>>[] = [
  { value: 'regular', label: 'Regulares' },
  { value: 'irregular', label: 'Irregulares' },
  { value: 'skips', label: 'Me salto comidas' },
  { value: 'late', label: 'Ceno tarde' },
  { value: 'unsure', label: UNSURE, quiet: true },
  { value: 'skip', label: SKIP, quiet: true },
];

/** The detail questions only make sense when the user wants to work on how they eat. */
export const wantsFoodDetails = (f: FoodHabits) => f.improve === 'yes' || f.improve === 'a_bit' || f.improve === 'unsure';

/** Drops empty answers and the details of someone who does not want to change how they eat. */
export function cleanFood(f: FoodHabits): FoodHabits | undefined {
  const details = wantsFoodDetails(f);
  return compact({
    improve: f.improve,
    quality: details || f.improve === undefined ? f.quality : undefined,
    pattern: details || f.improve === undefined ? f.pattern : undefined,
    restrictions: details ? f.restrictions : undefined,
    difficulties: details ? f.difficulties : undefined,
    eatingOut: details ? f.eatingOut : undefined,
    water: f.water,
    schedule: details ? f.schedule : undefined,
  });
}

/**
 * Starting water goal. The weight-based suggestion (≈ 33 ml/kg) is the
 * reference; someone who drinks little starts lower so the goal feels
 * reachable, and can raise it little by little.
 */
export function waterGoalFor(water: FoodHabits['water'], kg?: number): number {
  const reference = suggestWaterGoal(kg);
  if (water === 'low') return Math.min(reference, 1500);
  if (water === 'medium') return Math.min(reference, 2000);
  return reference;
}

// ── Obstáculos y motivación ────────────────────────────────────────────

export const BLOCKER_OPTIONS: Option<Item<MotivationProfile['blockers']>>[] = [
  { value: 'time', label: 'Falta de tiempo' },
  { value: 'motivation', label: 'Falta de motivación' },
  { value: 'results', label: 'No ver resultados' },
  { value: 'knowledge', label: 'No saber por dónde empezar' },
  { value: 'stress', label: 'Estrés o cansancio' },
  { value: 'injury', label: 'Lesiones o molestias' },
  { value: 'social', label: 'Planes y compromisos' },
  { value: 'other', label: 'Otro' },
];

export const HARDEST_OPTIONS: Option<Answer<MotivationProfile['hardest']>>[] = [
  { value: 'start', label: 'Empezar' },
  { value: 'consistency', label: 'Mantenerme' },
  { value: 'results', label: 'Ver resultados' },
  { value: 'unsure', label: UNSURE, quiet: true },
];

export const DROP_REASON_OPTIONS: Option<Item<MotivationProfile['dropReasons']>>[] = [
  { value: 'boredom', label: 'Me aburro' },
  { value: 'no_results', label: 'No noto cambios' },
  { value: 'busy', label: 'Se me complica la semana' },
  { value: 'fatigue', label: 'Cansancio' },
  { value: 'perfectionism', label: 'Si fallo un día, lo dejo' },
  { value: 'other', label: 'Otro' },
];

export const MOTIVATOR_OPTIONS: Option<Item<MotivationProfile['motivators']>>[] = [
  { value: 'progress', label: 'Ver mi progreso' },
  { value: 'streaks', label: 'Mantener la racha' },
  { value: 'tips', label: 'Consejos prácticos' },
  { value: 'challenges', label: 'Retos' },
  { value: 'health', label: 'Sentirme mejor' },
  { value: 'routine', label: 'Tener una rutina' },
];

export const STYLE_OPTIONS: Option<Answer<MotivationProfile['style']>>[] = [
  { value: 'small', label: 'Objetivos pequeños', description: 'Pasos fáciles que sumen cada día.' },
  { value: 'balanced', label: 'Un equilibrio', description: 'Constancia con algún reto de vez en cuando.' },
  { value: 'challenging', label: 'Retos exigentes', description: 'Me motiva ponerme a prueba.' },
];

export const MINUTES_OPTIONS: Option<'10' | '20' | '30' | '45' | '60'>[] = [
  { value: '10', label: '10 min' },
  { value: '20', label: '20 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 h o más' },
];

export const FIRST_FOCUS_OPTIONS: Option<Answer<MotivationProfile['firstFocus']>>[] = [
  { value: 'movement', label: 'Moverme más' },
  { value: 'food', label: 'Mi alimentación' },
  { value: 'sleep', label: 'Descansar mejor' },
  { value: 'water', label: 'Beber agua' },
  { value: 'consistency', label: 'Ser constante' },
  { value: 'weight', label: 'Mi peso' },
];

export const NOTE_MAX = 120;

/** The free answer is only kept when "Otro" was chosen in one of the lists. */
export const wantsMotivationNote = (m: MotivationProfile) => !!m.blockers?.includes('other') || !!m.dropReasons?.includes('other');

export function cleanMotivation(m: MotivationProfile): MotivationProfile | undefined {
  return compact({ ...m, note: wantsMotivationNote(m) ? cleanText(m.note ?? '', NOTE_MAX) : undefined });
}

const MOTIVATOR_PHRASES: Record<Item<MotivationProfile['motivators']>, string> = {
  progress: 'ver tu progreso',
  streaks: 'mantener la racha',
  tips: 'los consejos prácticos',
  challenges: 'los retos',
  health: 'sentirte mejor',
  routine: 'tener una rutina',
};

/** Preferred kind of support, from how they like to progress and what keeps them going. */
export function supportStyle(m: MotivationProfile | undefined): { title: string; text: string } | null {
  if (!m?.style && !m?.motivators?.length) return null;
  const base =
    m.style === 'small'
      ? { title: 'Paso a paso', text: 'Metas pequeñas y alcanzables' }
      : m.style === 'challenging'
        ? { title: 'Con retos', text: 'Objetivos exigentes, siempre con descanso' }
        : m.style === 'balanced'
          ? { title: 'Equilibrado', text: 'Constancia con algún reto de vez en cuando' }
          : { title: 'A tu ritmo', text: 'Sin prisas y adaptado a ti' };
  const motivators = MOTIVATOR_OPTIONS.filter((o) => m.motivators?.includes(o.value)).map((o) => MOTIVATOR_PHRASES[o.value]);
  return { title: base.title, text: motivators.length ? `${base.text}. Te impulsa: ${joinList(motivators)}.` : `${base.text}.` };
}

// ── Sueño y bienestar ──────────────────────────────────────────────────

export const SLEEP_OPTIONS: Option<Answer<Wellbeing['sleepHours']>>[] = [
  { value: 'lt6', label: 'Menos de 6 h' },
  { value: '6to7', label: '6–7 h' },
  { value: '7to8', label: '7–8 h' },
  { value: 'gt8', label: 'Más de 8 h' },
  { value: 'skip', label: SKIP, quiet: true },
];

export const REST_OPTIONS: Option<Answer<Wellbeing['rest']>>[] = [
  { value: 'good', label: 'Bien' },
  { value: 'ok', label: 'Regular' },
  { value: 'poor', label: 'Mal' },
  { value: 'skip', label: SKIP, quiet: true },
];

export const STRESS_OPTIONS: Option<Answer<Wellbeing['stress']>>[] = [
  { value: 'low', label: 'Bajo' },
  { value: 'medium', label: 'Medio' },
  { value: 'high', label: 'Alto' },
  { value: 'skip', label: SKIP, quiet: true },
];

export const SCHEDULE_OPTIONS: Option<Answer<Wellbeing['regularSchedule']>>[] = [
  { value: 'yes', label: 'Sí' },
  { value: 'sometimes', label: 'A veces' },
  { value: 'no', label: 'No' },
  { value: 'skip', label: SKIP, quiet: true },
];

export const WELLBEING_IMPROVE_OPTIONS: Option<Item<Wellbeing['improve']>>[] = [
  { value: 'sleep', label: 'Dormir mejor' },
  { value: 'stress', label: 'Gestionar el estrés' },
  { value: 'screens', label: 'Menos pantallas de noche' },
  { value: 'water', label: 'Beber más agua' },
  { value: 'movement', label: 'Moverme más' },
  { value: 'routine', label: 'Tener una rutina' },
];

export const cleanWellbeing = (w: Wellbeing): Wellbeing | undefined => compact({ ...w });

// ── Summaries ──────────────────────────────────────────────────────────

const HARDEST_PHRASES: Record<Exclude<Answer<MotivationProfile['hardest']>, 'unsure'>, string> = {
  start: 'Dar el primer paso',
  consistency: 'Mantener la constancia',
  results: 'Ver resultados',
};

/** Up to `max` main difficulties: what stopped them before, then what costs them most with food. */
export function mainDifficulties(m: MotivationProfile | undefined, f: FoodHabits | undefined, max = 4): string[] {
  const out = [
    ...labelsOf(
      BLOCKER_OPTIONS.filter((o) => o.value !== 'other'),
      m?.blockers ?? [],
    ),
    ...(m?.hardest && m.hardest !== 'unsure' ? [HARDEST_PHRASES[m.hardest]] : []),
    ...labelsOf(FOOD_DIFFICULTY_OPTIONS, f?.difficulties ?? []),
  ];
  return out.slice(0, max);
}

/** Up to `max` habits to work on: the first focus leads, then the wellbeing habits (no duplicates). */
export function habitsToImprove(m: MotivationProfile | undefined, w: Wellbeing | undefined, max = 4): string[] {
  const out: string[] = [];
  if (m?.firstFocus) out.push(labelOf(FIRST_FOCUS_OPTIONS, m.firstFocus));
  const same: Partial<Record<Item<Wellbeing['improve']>, Answer<MotivationProfile['firstFocus']>>> = { sleep: 'sleep', water: 'water', movement: 'movement' };
  for (const v of w?.improve ?? []) {
    if (m?.firstFocus && same[v] === m.firstFocus) continue;
    out.push(labelOf(WELLBEING_IMPROVE_OPTIONS, v));
  }
  return out.slice(0, max);
}

export function foodSummary(f: FoodHabits | undefined): string | null {
  if (!f) return null;
  const parts = [
    f.improve && f.improve !== 'unsure' && (f.improve === 'no' ? 'Sin cambios por ahora' : f.improve === 'yes' ? 'Quieres mejorarla' : 'Quieres mejorarla un poco'),
    f.pattern && !['unsure', 'skip', 'none'].includes(f.pattern) && labelOf(FOOD_PATTERN_OPTIONS, f.pattern),
    f.restrictions?.length && `Sin ${joinList(labelsOf(ALLERGEN_OPTIONS, f.restrictions).map((l) => l.toLowerCase()))}`,
    f.water && f.water !== 'unsure' && `Agua: ${labelOf(WATER_OPTIONS, f.water).toLowerCase()}`,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : 'Respuestas guardadas';
}

export function motivationSummary(m: MotivationProfile | undefined): string | null {
  if (!m) return null;
  const parts = [
    labelsOf(
      BLOCKER_OPTIONS.filter((o) => o.value !== 'other'),
      m.blockers ?? [],
    )
      .slice(0, 2)
      .join(', '),
    m.style && labelOf(STYLE_OPTIONS, m.style),
    m.dailyMinutes && `${labelOf(MINUTES_OPTIONS, String(m.dailyMinutes) as (typeof MINUTES_OPTIONS)[number]['value'])} al día`,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : 'Respuestas guardadas';
}

export function wellbeingSummary(w: Wellbeing | undefined): string | null {
  if (!w) return null;
  const parts = [
    w.sleepHours && w.sleepHours !== 'skip' && `Duermes ${labelOf(SLEEP_OPTIONS, w.sleepHours).toLowerCase()}`,
    w.stress && w.stress !== 'skip' && `Estrés ${labelOf(STRESS_OPTIONS, w.stress).toLowerCase()}`,
    w.improve?.length && labelsOf(WELLBEING_IMPROVE_OPTIONS, w.improve)[0],
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : 'Respuestas guardadas';
}

// ── Helpers ────────────────────────────────────────────────────────────

export const labelOf = <T extends string>(options: Option<T>[], value: T) => options.find((o) => o.value === value)?.label ?? value;

/** Labels of the selected values, in the canonical option order. */
export function labelsOf<T extends string>(options: Option<T>[], values: readonly T[]): string[] {
  return options.filter((o) => values.includes(o.value)).map((o) => o.label);
}

/** "a, b y c" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/**
 * Number typed in a field that started from a stored value. While the text
 * still shows that value it is kept exactly: in imperial units 90 kg reads
 * «198,4» lb and would come back as 89,99 kg, changing the goal (a new stage)
 * on a save that changed nothing.
 */
export function inputOrStored(input: string, stored: number | undefined, toInput: (v?: number) => string, parse: (s: string) => number | null): number | null {
  return stored !== undefined && input === toInput(stored) ? stored : parse(input);
}

/** Trimmed, single spaces and capped; undefined when empty. */
export function cleanText(text: string, max: number): string | undefined {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, max);
  return clean || undefined;
}

/** Removes undefined values and empty lists; undefined when nothing is left. */
function compact<T extends object>(obj: T): T | undefined {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0));
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
}
