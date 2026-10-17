import type { GoalType, HealthFlag, MealType, Nutrients } from '../types';
import { formatInt, formatNumber } from '../units';

/**
 * A short, reasoned note on how a portion fits the user's goal. It looks at
 * the portion, the daily energy target and what is already logged; it never
 * labels a food as good or bad and never pushes extreme changes.
 */

export interface GuidanceInput {
  total: Nutrients;
  meal: MealType;
  goal: GoalType;
  /** Daily energy target, or null when the profile has no target to compare with. */
  targetKcal: number | null;
  /** Why there is no target: data missing, or a reason not to show one. */
  noTarget?: 'missing' | 'restricted';
  kg?: number;
  /** Energy already logged today, not counting this food. */
  loggedKcal: number;
  /** Amounts estimated from a photo. */
  estimated: boolean;
  healthFlags: readonly HealthFlag[];
}

export interface Guidance {
  headline: string;
  tips: string[];
  note?: string;
}

type Family = 'lose' | 'gain' | 'maintain' | 'muscle';

export function goalFamily(goal: GoalType): Family {
  if (goal === 'lose' || goal === 'recomp') return 'lose';
  if (goal === 'gain') return 'gain';
  if (goal === 'strength') return 'muscle';
  return 'maintain';
}

/** Usual share of the day's energy for each meal (Spanish timetable). */
const TYPICAL_SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

const ESTIMATE_NOTE = 'Cantidades estimadas a partir de la foto: el peso real, el aceite o las salsas pueden cambiar los valores.';

function proteinTip(total: Nutrients, family: Family, meal: MealType, kg?: number): string | null {
  if (meal === 'snack' || (family !== 'lose' && family !== 'muscle')) return null;
  // Around 0.3 g/kg per main meal spreads the day's protein evenly.
  const perMeal = kg ? 0.3 * kg : 25;
  if (total.protein >= perMeal) return `Buen aporte de proteína (${formatNumber(total.protein, 0)} g) para tu objetivo.`;
  if (total.kcal >= 200 && total.protein < perMeal * 0.6) {
    return family === 'muscle'
      ? 'Sumar una fuente de proteína (huevo, legumbre, pescado, carne, yogur…) te ayuda a construir músculo.'
      : 'Sumar una fuente de proteína (huevo, legumbre, pescado, yogur…) ayuda a la saciedad y a conservar músculo.';
  }
  return null;
}

function fiberTip(total: Nutrients): string | null {
  if (total.fiber === undefined || total.fiber >= 3 || total.kcal < 300) return null;
  return 'Acompañarla de verdura, fruta o legumbre añade fibra y saciedad.';
}

export function mealGuidance(input: GuidanceInput): Guidance {
  const { total, meal, targetKcal, loggedKcal } = input;
  const note = input.estimated ? ESTIMATE_NOTE : undefined;

  if (input.healthFlags.includes('eating_disorder')) {
    return {
      headline: 'Valores orientativos de este alimento.',
      tips: [],
      note: 'Por lo que nos contaste, RUMBO no compara las comidas con objetivos de calorías.',
    };
  }

  const family = goalFamily(input.goal);
  const balance = [proteinTip(total, family, meal, input.kg), fiberTip(total)].filter((t): t is string => t !== null);

  if (targetKcal === null || !(targetKcal > 0)) {
    return {
      headline: `Aporta ${formatInt(total.kcal)} kcal, ${formatNumber(total.protein, 0)} g de proteína, ${formatNumber(total.carbs, 0)} g de hidratos y ${formatNumber(total.fat, 0)} g de grasa.`,
      tips: balance.slice(0, 2),
      note:
        input.noTarget === 'restricted'
          ? 'En tu caso no mostramos comparaciones con un objetivo de calorías: un profesional sanitario puede darte una pauta adaptada.'
          : (note ?? 'Completa tu peso, altura y edad en el perfil para ver cómo encaja en tu día.'),
    };
  }

  const share = total.kcal / targetKcal;
  const pct = Math.round(share * 100);
  const typical = TYPICAL_SHARE[meal];
  const target = formatInt(targetKcal);
  let headline: string;
  const tips: string[] = [];

  switch (family) {
    case 'lose':
      if (share > typical + 0.12) {
        headline = `Es una ración generosa para tu objetivo: aporta el ${pct} % de las ~${target} kcal de tu día.`;
        tips.push('Si quieres, ajusta la cantidad o equilíbralo en el resto de comidas: un día no marca la diferencia.');
      } else if (meal !== 'snack' && share < typical - 0.15) {
        headline = `Una ración ligera: el ${pct} % de tus ~${target} kcal diarias.`;
      } else {
        headline = `Encaja bien en tu objetivo: el ${pct} % de tus ~${target} kcal diarias.`;
      }
      break;
    case 'gain':
      if (share < typical - 0.08) {
        headline = `Aporta el ${pct} % de tus ~${target} kcal diarias; para ganar peso te puede venir bien una ración algo mayor.`;
        tips.push('Frutos secos, aceite de oliva o pan suman energía sin mucho volumen.');
      } else {
        headline = `Ayuda a cubrir tus necesidades: el ${pct} % de tus ~${target} kcal diarias.`;
      }
      break;
    case 'muscle':
      headline = `Aporta ${formatNumber(total.protein, 0)} g de proteína y el ${pct} % de tus ~${target} kcal diarias.`;
      break;
    default:
      headline = `Supone el ${pct} % de las ~${target} kcal con las que mantienes tu peso.`;
      if (share > typical + 0.2) tips.push('Es una comida abundante; puedes equilibrarlo en el resto del día.');
  }

  if (loggedKcal > 0) {
    const remaining = Math.round(targetKcal - loggedKcal - total.kcal);
    if (remaining >= 0) tips.push(`Con lo que llevas registrado hoy te quedarían unas ${formatInt(remaining)} kcal.`);
    else if (family === 'lose' && -remaining > targetKcal * 0.1) {
      tips.push(`Con lo registrado hoy pasarías tu objetivo en unas ${formatInt(-remaining)} kcal; no pasa nada por un día.`);
    }
  }
  tips.push(...balance);
  return { headline, tips: [...new Set(tips)].slice(0, 2), note };
}
