import { Activity, Dumbbell, Scale, Sparkles, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import type { GoalType, Sex } from '@/domain/types';

export const GOALS: { id: GoalType; label: string; description: string; icon: LucideIcon }[] = [
  { id: 'lose', label: 'Perder peso', description: 'De forma gradual y sostenible.', icon: TrendingDown },
  { id: 'maintain', label: 'Mantener mi peso', description: 'Cuidar lo conseguido.', icon: Scale },
  { id: 'gain', label: 'Ganar masa muscular', description: 'Subir de peso con calidad.', icon: TrendingUp },
  { id: 'fitness', label: 'Mejorar mi forma física', description: 'Más energía y resistencia.', icon: Activity },
  { id: 'strength', label: 'Ganar fuerza', description: 'Progresar en el gimnasio.', icon: Dumbbell },
  { id: 'habits', label: 'Crear hábitos saludables', description: 'Agua, pasos y constancia.', icon: Sparkles },
];

export const goalLabel = (g: GoalType) => GOALS.find((x) => x.id === g)?.label ?? g;

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Mujer' },
  { value: 'male', label: 'Hombre' },
  { value: 'unspecified', label: 'Prefiero no indicarlo' },
];

export const usesWeightGoal = (g: GoalType) => g === 'lose' || g === 'gain';
