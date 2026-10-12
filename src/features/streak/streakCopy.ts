import type { StreakInfo } from '@/domain/streak';

export const daysLabel = (n: number) => (n === 1 ? 'día' : 'días');

/** Encouraging, never guilt-inducing: a day without records is not a failure. */
export function streakMessage(s: StreakInfo): string {
  if (s.todayActive) {
    if (s.current === 1) return 'Primer día encendido. Vuelve mañana para seguir sumando.';
    return `Día ${s.current} completado. Mañana puedes llegar a ${s.current + 1}.`;
  }
  if (s.current > 0) return `Haz un registro hoy para llegar a ${s.current + 1} ${daysLabel(s.current + 1)}.`;
  return 'Cualquier registro de hoy enciende la llama: peso, agua, pasos o un entreno.';
}
