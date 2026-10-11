export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface Range {
  min: number;
  max: number;
  label: string;
  unit?: string;
}

export const LIMITS = {
  weightKg: { min: 20, max: 400, label: 'El peso', unit: 'kg' },
  heightCm: { min: 90, max: 250, label: 'La altura', unit: 'cm' },
  age: { min: 12, max: 110, label: 'La edad', unit: 'años' },
  waterMl: { min: 10, max: 5000, label: 'La cantidad', unit: 'ml' },
  waterGoalMl: { min: 500, max: 8000, label: 'El objetivo de agua', unit: 'ml' },
  steps: { min: 0, max: 150_000, label: 'Los pasos' },
  stepsGoal: { min: 500, max: 60_000, label: 'El objetivo de pasos' },
  setKg: { min: 0, max: 1000, label: 'El peso', unit: 'kg' },
  reps: { min: 0, max: 1000, label: 'Las repeticiones' },
  durationSec: { min: 0, max: 86_400, label: 'La duración' },
  distanceKm: { min: 0, max: 1000, label: 'La distancia', unit: 'km' },
  restSec: { min: 0, max: 1800, label: 'El descanso' },
} satisfies Record<string, Range>;

export function checkRange(value: number | null | undefined, range: Range): string | null {
  if (value === null || value === undefined) return `${range.label} es obligatorio.`;
  if (Number.isNaN(value)) return `${range.label} no es un número válido.`;
  if (value < range.min || value > range.max) {
    const u = range.unit ? ` ${range.unit}` : '';
    return `${range.label} debe estar entre ${range.min}${u} y ${range.max}${u}.`;
  }
  return null;
}

export function assertRange(value: number | null | undefined, range: Range): number {
  const err = checkRange(value, range);
  if (err) throw new ValidationError(err);
  return value as number;
}

export function assertText(value: string, label: string, max = 120): string {
  const v = value.trim();
  if (!v) throw new ValidationError(`${label} es obligatorio.`);
  if (v.length > max) throw new ValidationError(`${label} no puede superar ${max} caracteres.`);
  return v;
}
