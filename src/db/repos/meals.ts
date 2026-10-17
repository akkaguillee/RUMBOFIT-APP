import { nowTime, todayKey, type DateKey } from '@/domain/dates';
import { isPlausiblePer100, roundNutrients } from '@/domain/nutrition/nutrients';
import type { MealEntry, MealItem, MealType } from '@/domain/types';
import { assertText, ValidationError } from '@/domain/validation';
import { db } from '../db';
import { scheduleSync } from '../sync';

export interface MealInput {
  date?: DateKey;
  time?: string;
  meal: MealType;
  name: string;
  items: MealItem[];
  origin: MealEntry['origin'];
}

const finite = (n: number) => Number.isFinite(n) && n >= 0;

/** Checks every item before it is stored: no negative, impossible or missing values. */
function validItems(items: MealItem[]): MealItem[] {
  if (!items.length) throw new ValidationError('Añade al menos un alimento.');
  if (items.length > 20) throw new ValidationError('Demasiados alimentos en una sola comida.');
  return items.map((it) => {
    const n = it.nutrients;
    if (![n.kcal, n.protein, n.carbs, n.fat].every(finite) || n.kcal > 10000) throw new ValidationError(`Los valores de «${it.name}» no son válidos.`);
    if (it.per100 && !isPlausiblePer100(it.per100)) throw new ValidationError(`Los valores por 100 g de «${it.name}» no son válidos.`);
    if (it.grams !== undefined && !(it.grams > 0 && it.grams <= 5000)) throw new ValidationError(`La cantidad de «${it.name}» no es válida.`);
    return { ...it, name: assertText(it.name, 'El nombre del alimento', 80), nutrients: roundNutrients(n) };
  });
}

export async function addMeal(input: MealInput): Promise<number> {
  const date = input.date ?? todayKey();
  if (date > todayKey()) throw new ValidationError('La fecha no puede estar en el futuro.');
  const now = Date.now();
  const id = (await db.meals.add({
    date,
    time: input.time ?? nowTime(),
    meal: input.meal,
    name: assertText(input.name, 'El nombre de la comida', 80),
    items: validItems(input.items),
    origin: input.origin,
    createdAt: now,
    updatedAt: now,
  })) as number;
  scheduleSync();
  return id;
}

export async function deleteMeal(id: number): Promise<void> {
  await db.meals.delete(id);
  scheduleSync();
}

/** Restores a deleted entry exactly as it was (for «Deshacer»). */
export async function restoreMeal(entry: MealEntry): Promise<void> {
  await db.meals.put(entry);
  scheduleSync();
}
