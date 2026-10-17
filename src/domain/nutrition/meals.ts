import type { MealItem, MealType, NutrientSource, Nutrients } from '../types';
import { roundNutrients, scaleNutrients } from './nutrients';

export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Desayuno' },
  { id: 'lunch', label: 'Comida' },
  { id: 'dinner', label: 'Cena' },
  { id: 'snack', label: 'Picoteo' },
];

export const mealLabel = (id: MealType): string => MEAL_TYPES.find((m) => m.id === id)?.label ?? id;

/** The meal a time of day usually belongs to (Spanish timetable). */
export function mealForTime(time: string): MealType {
  const h = Number(time.slice(0, 2));
  if (h >= 5 && h < 12) return 'breakfast';
  if (h >= 13 && h < 17) return 'lunch';
  if (h >= 20 || h < 2) return 'dinner';
  return 'snack';
}

/** An item described per 100 g, for the amount eaten. */
export function itemFromPer100(input: { name: string; per100: Nutrients; grams: number; source: NutrientSource; estimated: boolean; unit?: 'ml' }): MealItem {
  const grams = Math.min(5000, Math.max(1, Math.round(input.grams)));
  return {
    name: input.name,
    grams,
    ...(input.unit ? { unit: input.unit } : {}),
    per100: input.per100,
    nutrients: roundNutrients(scaleNutrients(input.per100, grams)),
    source: input.source,
    estimated: input.estimated,
  };
}

/** Same item with a new amount (only for items that keep their values per 100 g). */
export function withGrams(item: MealItem, grams: number): MealItem {
  if (!item.per100) return item;
  return itemFromPer100({ ...item, per100: item.per100, grams, estimated: false });
}

export function sourceLabel(source: NutrientSource): string {
  switch (source.kind) {
    case 'usda':
      return `USDA FoodData Central · ${source.label}`;
    case 'off':
      return `Open Food Facts · ${source.label}`;
    case 'ai':
      return 'Estimación de IA · valores típicos por 100 g';
    case 'manual':
      return 'Introducido a mano';
  }
}
