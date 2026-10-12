import type { ActivityLevel, ActivityProfile, GoalType, HealthFlag, Sex } from './types';
import { round } from './units';

// ── BMI ────────────────────────────────────────────────────────────────

export type BmiCategoryId = 'under' | 'normal' | 'over' | 'obese1' | 'obese2' | 'obese3';

export interface BmiCategory {
  id: BmiCategoryId;
  label: string;
  min: number;
  max: number;
  tone: 'good' | 'warn' | 'bad';
  description: string;
}

/** WHO reference ranges for adults (18+). */
export const BMI_CATEGORIES: BmiCategory[] = [
  {
    id: 'under',
    label: 'Bajo peso',
    min: 0,
    max: 18.5,
    tone: 'warn',
    description: 'Está por debajo del rango de referencia. Si te preocupa, consúltalo con un profesional sanitario.',
  },
  {
    id: 'normal',
    label: 'Rango de referencia',
    min: 18.5,
    max: 25,
    tone: 'good',
    description: 'Se encuentra dentro del rango considerado de referencia para personas adultas.',
  },
  {
    id: 'over',
    label: 'Sobrepeso',
    min: 25,
    max: 30,
    tone: 'warn',
    description: 'Ligeramente por encima del rango de referencia. Tus hábitos y tu composición corporal también importan.',
  },
  {
    id: 'obese1',
    label: 'Obesidad grado I',
    min: 30,
    max: 35,
    tone: 'bad',
    description: 'Por encima del rango de referencia. Un profesional puede ayudarte a valorar tu caso concreto.',
  },
  {
    id: 'obese2',
    label: 'Obesidad grado II',
    min: 35,
    max: 40,
    tone: 'bad',
    description: 'Por encima del rango de referencia. Te recomendamos comentarlo con un profesional sanitario.',
  },
  {
    id: 'obese3',
    label: 'Obesidad grado III',
    min: 40,
    max: Infinity,
    tone: 'bad',
    description: 'Muy por encima del rango de referencia. Te recomendamos acompañamiento profesional.',
  },
];

export function calculateBmi(kg: number, heightCm: number): number {
  if (kg <= 0 || heightCm <= 0) throw new RangeError('Peso y altura deben ser positivos');
  const m = heightCm / 100;
  return round(kg / (m * m), 1);
}

export function bmiCategory(bmi: number, age?: number): BmiCategory | null {
  if (age !== undefined && age < 18) return null;
  return BMI_CATEGORIES.find((c) => bmi >= c.min && bmi < c.max) ?? null;
}

/** Weight (kg) that would produce a given BMI for a height. */
export function weightForBmi(bmi: number, heightCm: number): number {
  const m = heightCm / 100;
  return round(bmi * m * m, 1);
}

// ── Energy (Mifflin-St Jeor) ───────────────────────────────────────────

export const ACTIVITY_LEVELS: Record<ActivityLevel, { label: string; factor: number; description: string }> = {
  sedentary: { label: 'Sedentario', factor: 1.2, description: 'Trabajo sentado y poca actividad física.' },
  light: { label: 'Ligero', factor: 1.375, description: 'Ejercicio suave 1–3 días por semana.' },
  moderate: { label: 'Moderado', factor: 1.55, description: 'Ejercicio moderado 3–5 días por semana.' },
  active: { label: 'Activo', factor: 1.725, description: 'Entrenamiento intenso 6–7 días por semana.' },
  very_active: {
    label: 'Muy activo',
    factor: 1.9,
    description: 'Trabajo físico exigente o entrenamientos dobles.',
  },
};

const LEVEL_ORDER: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

/**
 * Activity factor from everyday life plus training, so the user never has to
 * guess a "PAL": the posture they spend most of the day in (a physical job
 * counts as moving) sets the base, and weekly training sessions add to it.
 *   base: sitting 0 · on your feet 1 · moving 2
 *   training: 0 days +0 · 1–2 +0.5 · 3–4 +1 · 5+ +1.5   (rounded half up, capped)
 * e.g. desk job + 3 sessions → light (1.375); physical job + 5 → very active (1.9).
 */
export function estimateActivityLevel(a: Pick<ActivityProfile, 'posture' | 'job' | 'trainingDays'>): ActivityLevel {
  let base = a.posture === 'moving' ? 2 : a.posture === 'standing' ? 1 : 0;
  if (a.job === 'physical') base = Math.max(base, 2);
  if (a.job === 'standing') base = Math.max(base, 1);
  const days = Math.max(0, Math.min(7, Math.round(a.trainingDays)));
  const bonus = days >= 5 ? 1.5 : days >= 3 ? 1 : days >= 1 ? 0.5 : 0;
  return LEVEL_ORDER[Math.min(LEVEL_ORDER.length - 1, Math.floor(base + bonus + 0.5))]!;
}

const SEX_CONSTANT: Record<Sex, number> = {
  male: 5,
  female: -161,
  // Midpoint of both constants, explained to the user as a less precise estimate.
  unspecified: -78,
};

export interface EnergyInput {
  kg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: GoalType;
  healthFlags?: HealthFlag[];
}

export interface EnergyTarget {
  id: 'maintain' | 'lose_mild' | 'lose' | 'gain_mild' | 'gain';
  label: string;
  kcal: number;
  description: string;
  recommended: boolean;
}

export interface EnergyResult {
  bmr: number;
  activityFactor: number;
  tdee: number;
  maintenance: number;
  targets: EnergyTarget[];
  /** Reasons why only maintenance is shown, if any. */
  restrictions: string[];
  notes: string[];
}

export function mifflinStJeor(kg: number, heightCm: number, age: number, sex: Sex): number {
  return 10 * kg + 6.25 * heightCm - 5 * age + SEX_CONSTANT[sex];
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function calculateEnergy(input: EnergyInput): EnergyResult {
  const { kg, heightCm, age, sex, activityLevel, goal } = input;
  const bmrRaw = mifflinStJeor(kg, heightCm, age, sex);
  const factor = ACTIVITY_LEVELS[activityLevel].factor;
  const bmr = Math.round(bmrRaw);
  // The activity factor already includes habitual training, so exercise
  // calories are never added a second time.
  const tdee = Math.round(bmrRaw * factor);
  const maintenance = roundTo(tdee, 10);

  const restrictions: string[] = [];
  const notes: string[] = [
    'Estimación basada en la ecuación de Mifflin-St Jeor (1990). Las necesidades reales pueden variar ±10 % o más.',
    'El nivel de actividad ya incluye tu entrenamiento habitual: no sumes de nuevo las calorías del ejercicio.',
  ];
  if (sex === 'unspecified') {
    notes.push('Sin sexo biológico indicado se usa un valor intermedio, por lo que la estimación es menos precisa.');
  }
  if (age < 18) {
    restrictions.push(
      'Eres menor de edad: las necesidades energéticas durante el crecimiento son diferentes y no mostramos objetivos de pérdida ni de ganancia.',
    );
  }
  const flags = input.healthFlags ?? [];
  if (flags.includes('pregnancy')) {
    restrictions.push('Durante el embarazo o la lactancia las necesidades cambian: consúltalo con tu profesional sanitario.');
  }
  if (flags.includes('eating_disorder')) {
    restrictions.push(
      'Por tus antecedentes, no mostramos objetivos de déficit o superávit. Un profesional puede acompañarte de forma segura.',
    );
  }
  if (flags.includes('medical_condition')) {
    restrictions.push('Con una condición médica, un objetivo estándar no es una prescripción segura: consulta con un profesional.');
  }

  const targets: EnergyTarget[] = [
    {
      id: 'maintain',
      label: 'Mantenimiento',
      kcal: maintenance,
      description: 'Energía estimada para mantener tu peso actual.',
      recommended: restrictions.length > 0 || !['lose', 'gain', 'strength'].includes(goal),
    },
  ];

  if (restrictions.length === 0) {
    // Conservative deficits: never below the estimated basal metabolism (rounded up, so 1.844 → 1.850).
    const floor = Math.ceil(bmrRaw / 10) * 10;
    const mild = Math.max(floor, roundTo(tdee - Math.min(tdee * 0.1, 300), 10));
    const moderate = Math.max(floor, roundTo(tdee - Math.min(tdee * 0.2, 500), 10));
    if (goal === 'lose') {
      targets.push(
        {
          id: 'lose_mild',
          label: 'Pérdida suave',
          kcal: mild,
          description: 'Déficit ligero (≈10 %), más fácil de sostener en el tiempo.',
          recommended: true,
        },
        {
          id: 'lose',
          label: 'Pérdida gradual',
          kcal: moderate,
          description: 'Déficit moderado (≈20 %, máx. 500 kcal). Nunca por debajo del metabolismo basal estimado.',
          recommended: false,
        },
      );
    }
    if (goal === 'recomp') {
      targets.push({
        id: 'lose_mild',
        label: 'Recomposición',
        kcal: mild,
        description: 'Déficit muy ligero (≈10 %) con proteína suficiente y entrenamiento de fuerza. Mantenimiento también es válido.',
        recommended: false,
      });
    }
    if (goal === 'gain' || goal === 'strength') {
      targets.push(
        {
          id: 'gain_mild',
          label: 'Ganancia suave',
          kcal: roundTo(tdee + Math.min(tdee * 0.05, 200), 10),
          description: 'Superávit ligero (≈5 %) para ganar masa minimizando la grasa.',
          recommended: true,
        },
        {
          id: 'gain',
          label: 'Ganancia gradual',
          kcal: roundTo(tdee + Math.min(tdee * 0.1, 350), 10),
          description: 'Superávit moderado (≈10 %, máx. 350 kcal).',
          recommended: false,
        },
      );
    }
  }

  return { bmr, activityFactor: factor, tdee, maintenance, targets, restrictions, notes };
}

export interface MacroSplit {
  proteinG: number;
  fatG: number;
  carbsG: number;
  proteinKcal: number;
  fatKcal: number;
  carbsKcal: number;
  valid: boolean;
}

/**
 * Protein by body weight, fat as a share of calories and carbohydrates as
 * the remainder (4 kcal/g protein & carbs, 9 kcal/g fat).
 */
export function calculateMacros(kcal: number, kg: number, proteinPerKg: number, fatPct: number): MacroSplit {
  const proteinG = Math.round(kg * proteinPerKg);
  const proteinKcal = proteinG * 4;
  const fatKcal = Math.round(kcal * (fatPct / 100));
  const fatG = Math.round(fatKcal / 9);
  const carbsKcal = Math.max(0, kcal - proteinKcal - fatG * 9);
  const carbsG = Math.round(carbsKcal / 4);
  return { proteinG, fatG, carbsG, proteinKcal, fatKcal: fatG * 9, carbsKcal, valid: proteinKcal + fatG * 9 <= kcal };
}

/** Starting suggestion for water (≈ 33 ml/kg), clamped and rounded. Editable by the user. */
export function suggestWaterGoal(kg?: number): number {
  if (!kg) return 2000;
  return Math.min(4000, Math.max(1500, Math.round((kg * 33) / 250) * 250));
}

/** Estimated stride length from height. Always presented as an estimate. */
export function estimateStrideM(heightCm: number, sex: Sex): number {
  const k = sex === 'female' ? 0.413 : sex === 'male' ? 0.415 : 0.414;
  return (heightCm * k) / 100;
}

export function estimateDistanceKm(steps: number, heightCm?: number, sex: Sex = 'unspecified'): number | null {
  if (!heightCm) return null;
  return round((steps * estimateStrideM(heightCm, sex)) / 1000, 2);
}

/** Rough walking energy estimate (~0.57 kcal per kg per km). */
export function estimateWalkingKcal(distanceKm: number | null, kg?: number): number | null {
  if (distanceKm === null || !kg) return null;
  return Math.round(distanceKm * kg * 0.57);
}

export function currentAge(age: number | undefined, recordedOn: string | undefined, today: string): number | undefined {
  if (age === undefined) return undefined;
  if (!recordedOn) return age;
  const [y1, m1, d1] = recordedOn.split('-').map(Number) as [number, number, number];
  const [y2, m2, d2] = today.split('-').map(Number) as [number, number, number];
  let years = y2 - y1;
  if (m2 < m1 || (m2 === m1 && d2 < d1)) years -= 1;
  return age + Math.max(0, years);
}
