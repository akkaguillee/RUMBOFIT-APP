/**
 * Automatic body metrics: BMI and a personalised calorie estimate built from
 * what the user already gave us (profile + weight records). Pure helpers on
 * top of health.ts. Nothing is ever invented: when a value is missing the
 * result says which one, so the UI can ask for exactly that.
 */
import { toDateKey, type DateKey } from './dates';
import {
  ACTIVITY_LEVELS,
  bmiCategory,
  calculateBmi,
  calculateEnergy,
  currentAge,
  estimateActivityLevel,
  weightForBmi,
  type BmiCategory,
  type EnergyResult,
  type EnergyTarget,
} from './health';
import type { ActivityLevel, ActivityProfile, GoalType, Profile, Sex, WeightEntry } from './types';
import { clamp } from './units';
import { sortWeights } from './weight';

// ── BMI ────────────────────────────────────────────────────────────────

export type BmiBandId = 'under' | 'normal' | 'over' | 'obese';

export interface BmiBand {
  id: BmiBandId;
  label: string;
  /** Short label for narrow layouts. */
  short: string;
  /** Range as written in Spanish ("18,5–24,9"). */
  range: string;
  min: number;
  max: number;
  tone: 'good' | 'warn' | 'bad';
  /** One respectful line; never a diagnosis. */
  interpretation: string;
}

/**
 * Display scale for adults (WHO). The four bands are drawn with equal widths
 * so every label fits on a phone; the marker is placed linearly inside its
 * band. The outer bands are shown from 15 and up to 40 (values beyond clamp).
 */
export const BMI_BANDS: BmiBand[] = [
  {
    id: 'under',
    label: 'Bajo peso',
    short: 'Bajo peso',
    range: '<18,5',
    min: 15,
    max: 18.5,
    tone: 'warn',
    interpretation: 'Por debajo del intervalo de referencia. Si te preocupa, coméntalo con un profesional sanitario.',
  },
  {
    id: 'normal',
    label: 'Intervalo de referencia',
    short: 'Referencia',
    range: '18,5–24,9',
    min: 18.5,
    max: 25,
    tone: 'good',
    interpretation: 'Dentro del intervalo de referencia para personas adultas.',
  },
  {
    id: 'over',
    label: 'Sobrepeso',
    short: 'Sobrepeso',
    range: '25–29,9',
    min: 25,
    max: 30,
    tone: 'warn',
    interpretation: 'Algo por encima del intervalo de referencia. Tus hábitos y tu composición corporal también cuentan.',
  },
  {
    id: 'obese',
    label: 'Obesidad',
    short: 'Obesidad',
    range: '≥30',
    min: 30,
    max: 40,
    tone: 'bad',
    interpretation: 'Por encima del intervalo de referencia. Un profesional puede ayudarte a valorarlo en tu caso.',
  },
];

/** Lower and upper BMI of the adult reference interval (18,5–24,9). */
export const BMI_REFERENCE = { min: 18.5, max: 24.9 } as const;

export const BMI_DISCLAIMER = 'El IMC es orientativo y no es un diagnóstico; no distingue músculo de grasa.';

const MINOR_NOTE =
  'En menores de 18 años el IMC se interpreta con percentiles según la edad y el sexo, así que no aplicamos las categorías de adultos. Tu pediatra o tu médico pueden ayudarte a valorarlo.';

const UNKNOWN_AGE_NOTE = 'No tenemos tu edad: usamos las categorías para personas adultas (18 años o más).';

const PREGNANCY_NOTE =
  'Durante el embarazo o la lactancia el peso cambia por motivos esperados, así que no aplicamos las categorías habituales del IMC. Tu matrona o tu médico pueden ayudarte a valorarlo.';

export function bmiBand(bmi: number): BmiBand {
  return BMI_BANDS.find((b) => bmi < b.max) ?? BMI_BANDS[BMI_BANDS.length - 1]!;
}

/** Position (0–1) on the equal-width band scale. */
export function bmiScalePosition(bmi: number): number {
  const i = BMI_BANDS.findIndex((b) => bmi < b.max);
  const index = i === -1 ? BMI_BANDS.length - 1 : i;
  const band = BMI_BANDS[index]!;
  const within = clamp((bmi - band.min) / (band.max - band.min), 0, 1);
  return (index + within) / BMI_BANDS.length;
}

export type AgeGroup = 'adult' | 'minor' | 'unknown';

/** Why a value is shown without adult categories: under 18, or pregnancy / breastfeeding (flagged in the profile). */
export type NoBandReason = 'minor' | 'pregnancy';

export type MissingBmiField = 'weight' | 'height';

export type BmiSnapshot =
  | {
      status: 'ok';
      bmi: number;
      kg: number;
      heightCm: number;
      /** Date of the weight record used. */
      weighedOn: DateKey;
      age?: number;
      ageGroup: AgeGroup;
      /** Adult band; null for minors and during pregnancy / breastfeeding (see noBandReason). */
      band: BmiBand | null;
      /** Detailed WHO category (obesity grades); null whenever band is null. */
      category: BmiCategory | null;
      /** Marker position on the adult scale (0–1); null whenever band is null. */
      position: number | null;
      /** Weight range that corresponds to the reference interval at this height; null whenever band is null. */
      reference: { minKg: number; maxKg: number } | null;
      noBandReason: NoBandReason | null;
      interpretation: string;
      notes: string[];
    }
  | { status: 'missing'; fields: MissingBmiField[] };

/** Most recent weight record on or before today (by date and time, several records a day allowed). */
export function latestWeightUpTo(weights: WeightEntry[], today: DateKey): WeightEntry | undefined {
  const sorted = sortWeights(weights.filter((w) => w.date <= today));
  return sorted[sorted.length - 1];
}

function ageGroupOf(age: number | undefined): AgeGroup {
  if (age === undefined) return 'unknown';
  return age < 18 ? 'minor' : 'adult';
}

export function bmiSnapshot(
  profile: Pick<Profile, 'heightCm' | 'age' | 'ageRecordedOn'> & Partial<Pick<Profile, 'healthFlags'>>,
  weights: WeightEntry[],
  today: DateKey,
): BmiSnapshot {
  const latest = latestWeightUpTo(weights, today);
  const fields: MissingBmiField[] = [];
  if (!latest) fields.push('weight');
  if (!profile.heightCm) fields.push('height');
  if (!latest || !profile.heightCm) return { status: 'missing', fields };

  const heightCm = profile.heightCm;
  const bmi = calculateBmi(latest.kg, heightCm);
  const age = currentAge(profile.age, profile.ageRecordedOn, today);
  const ageGroup = ageGroupOf(age);
  const notes: string[] = [];

  // Minors are read with percentiles; during pregnancy or breastfeeding weight changes for expected reasons.
  const noBandReason: NoBandReason | null = ageGroup === 'minor' ? 'minor' : profile.healthFlags?.includes('pregnancy') ? 'pregnancy' : null;
  if (noBandReason) {
    return {
      status: 'ok',
      bmi,
      kg: latest.kg,
      heightCm,
      weighedOn: latest.date,
      age,
      ageGroup,
      band: null,
      category: null,
      position: null,
      reference: null,
      noBandReason,
      interpretation: noBandReason === 'minor' ? MINOR_NOTE : PREGNANCY_NOTE,
      notes,
    };
  }

  if (ageGroup === 'unknown') notes.push(UNKNOWN_AGE_NOTE);
  const band = bmiBand(bmi);
  return {
    status: 'ok',
    bmi,
    kg: latest.kg,
    heightCm,
    weighedOn: latest.date,
    age,
    ageGroup,
    band,
    category: bmiCategory(bmi, age),
    position: bmiScalePosition(bmi),
    reference: { minKg: weightForBmi(BMI_REFERENCE.min, heightCm), maxKg: weightForBmi(BMI_REFERENCE.max, heightCm) },
    noBandReason: null,
    interpretation: band.interpretation,
    notes,
  };
}

export interface BmiPoint {
  date: DateKey;
  kg: number;
  bmi: number;
}

/**
 * BMI over time with the current height: one point per day, using the last
 * record of that day (several weigh-ins on one day never count twice).
 */
export function bmiSeries(weights: WeightEntry[], heightCm: number | undefined): BmiPoint[] {
  if (!heightCm) return [];
  const byDay = new Map<DateKey, WeightEntry>();
  for (const w of sortWeights(weights)) byDay.set(w.date, w);
  return [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({ date: w.date, kg: w.kg, bmi: calculateBmi(w.kg, heightCm) }));
}

// ── Energy ─────────────────────────────────────────────────────────────

/** Keeps numbers with their unit on one line ("≈20 %", "500 kcal") in copy that comes from health.ts. */
export function keepUnitsTogether(text: string): string {
  return text.replace(/(\d) (%|kcal\b)/g, '$1\u00a0$2');
}

export type MissingEnergyField = 'weight' | 'height' | 'age';

const MISSING_NAMES: Record<MissingEnergyField, string> = { weight: 'tu peso', height: 'tu altura', age: 'tu edad' };

/** What is missing, in words: "tu peso, tu altura y tu edad". */
export function missingText(fields: MissingEnergyField[]): string {
  const names = fields.map((f) => MISSING_NAMES[f]);
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

const POSTURE_TEXT: Record<ActivityProfile['posture'], string> = {
  sitting: 'Sentado la mayor parte del día',
  standing: 'De pie la mayor parte del día',
  moving: 'En movimiento la mayor parte del día',
};

const trainingText = (days: number) =>
  days <= 0 ? 'sin entrenamientos' : days === 1 ? '1 día de entreno por semana' : `${days} días de entreno por semana`;

/** Plain-language summary of the answers behind the activity factor. */
export function describeActivity(a: Pick<ActivityProfile, 'posture' | 'job' | 'trainingDays'>): string {
  const parts = [POSTURE_TEXT[a.posture]];
  if (a.job === 'physical' && a.posture !== 'moving') parts.push('trabajo físico');
  else if (a.job === 'standing' && a.posture === 'sitting') parts.push('trabajo de pie');
  parts.push(trainingText(Math.max(0, Math.min(7, Math.round(a.trainingDays)))));
  return parts.join(' · ');
}

export interface ActivityBasis {
  level: ActivityLevel;
  label: string;
  factor: number;
  /**
   * 'daily-life': the saved level matches the estimate from posture, job and training days;
   * 'manual': the user answered those questions but then picked another level by hand (their choice wins);
   * 'profile': no daily-life answers, only the level stored in the profile.
   */
  source: 'daily-life' | 'manual' | 'profile';
  summary: string;
}

/** The saved activity level always wins: onboarding and the activity editor save the estimate, Perfil may override it. */
export function activityBasis(profile: Pick<Profile, 'activity' | 'activityLevel'>): ActivityBasis {
  const level = profile.activityLevel;
  const { label, factor, description } = ACTIVITY_LEVELS[level];
  if (!profile.activity) return { level, label, factor, source: 'profile', summary: description };
  return estimateActivityLevel(profile.activity) === level
    ? { level, label, factor, source: 'daily-life', summary: describeActivity(profile.activity) }
    : { level, label, factor, source: 'manual', summary: description };
}

export type EnergyEstimate =
  | {
      status: 'ok';
      kg: number;
      heightCm: number;
      age: number;
      sex: Sex;
      goal: GoalType;
      bmr: number;
      tdee: number;
      maintenance: number;
      /** Recommended daily target; null when only maintenance is appropriate (restrictions). */
      target: EnergyTarget | null;
      /** Every option that passed the safety rules (maintenance always included). */
      options: EnergyTarget[];
      activity: ActivityBasis;
      /** Last day an input changed: the weight record used (its date or last edit) or the profile. */
      basedOn: DateKey;
      restricted: boolean;
      restrictions: string[];
      /** The one note to show prominently (how to use this number). */
      guidance: string;
      notes: string[];
    }
  | { status: 'missing'; fields: MissingEnergyField[] };

export const ENERGY_INITIAL_NOTE =
  'Es una estimación inicial: observa la tendencia de tu peso durante 2–3 semanas y ajústala si no evoluciona como esperabas.';

/** In sensitive situations the number is a general reference, never something to adjust on your own. */
export const ENERGY_RESTRICTED_NOTE = 'Tómalo solo como una referencia general: un profesional sanitario puede darte una pauta adaptada a ti.';

const UNDERWEIGHT_NOTE =
  'Tu IMC está por debajo del intervalo de referencia, así que solo mostramos el mantenimiento. Si quieres cambiar tu peso, un profesional sanitario puede darte una pauta adaptada a ti.';

/**
 * Extra safety on top of calculateEnergy (which already removes targets for
 * minors and health flags), shared by the automatic card and the adjustable
 * calculator:
 *  - an adult whose BMI is below the reference interval gets maintenance only
 *    (no deficit and no surplus) and a note to consult a professional;
 *  - no target is ever below the basal metabolism, rounded up to 10 kcal
 *    (BMR 1.844 → 1.850). calculateEnergy applies the same floor; this keeps
 *    the guarantee for callers that pass a rounded BMR.
 */
export function guardDeficit(
  result: Pick<EnergyResult, 'targets' | 'restrictions' | 'bmr'>,
  kg: number,
  heightCm: number,
  age: number,
): { targets: EnergyTarget[]; restrictions: string[] } {
  const { restrictions } = result;
  const floor = Math.ceil(result.bmr / 10) * 10;
  const targets = result.targets.map((t) => (t.id !== 'maintain' && t.kcal < floor ? { ...t, kcal: floor } : t));
  if (restrictions.length > 0 || age < 18 || calculateBmi(kg, heightCm) >= BMI_REFERENCE.min) return { targets, restrictions };
  return {
    targets: targets.filter((t) => t.id === 'maintain').map((t) => ({ ...t, recommended: true })),
    restrictions: [...restrictions, UNDERWEIGHT_NOTE],
  };
}

export function energyEstimate(profile: Profile, weights: WeightEntry[], today: DateKey): EnergyEstimate {
  const latest = latestWeightUpTo(weights, today);
  const age = currentAge(profile.age, profile.ageRecordedOn, today);
  const fields: MissingEnergyField[] = [];
  if (!latest) fields.push('weight');
  if (!profile.heightCm) fields.push('height');
  if (age === undefined) fields.push('age');
  if (!latest || !profile.heightCm || age === undefined) return { status: 'missing', fields };

  const activity = activityBasis(profile);
  const result = calculateEnergy({
    kg: latest.kg,
    heightCm: profile.heightCm,
    age,
    sex: profile.sex,
    activityLevel: activity.level,
    goal: profile.goal,
    healthFlags: profile.healthFlags,
  });
  const { targets: options, restrictions } = guardDeficit(result, latest.kg, profile.heightCm, age);
  const restricted = restrictions.length > 0;
  const recommended = options.find((t) => t.recommended) ?? options[0]!;
  const notes = [...result.notes];
  if (activity.source === 'profile') {
    notes.push('Cuéntanos cómo es tu día a día en tu perfil para afinar el factor de actividad.');
  }
  // "Actualizado": the last day any input changed (weight record logged or edited, profile saved), never in the future.
  const changed = [latest.date, toDateKey(new Date(latest.updatedAt)), toDateKey(new Date(profile.updatedAt))].filter((d) => d <= today);
  return {
    status: 'ok',
    kg: latest.kg,
    heightCm: profile.heightCm,
    age,
    sex: profile.sex,
    goal: profile.goal,
    bmr: result.bmr,
    tdee: result.tdee,
    maintenance: result.maintenance,
    target: restricted ? null : recommended,
    options,
    activity,
    basedOn: changed.reduce((a, b) => (b > a ? b : a), latest.date),
    restricted,
    restrictions,
    guidance: restricted ? ENERGY_RESTRICTED_NOTE : ENERGY_INITIAL_NOTE,
    notes,
  };
}
