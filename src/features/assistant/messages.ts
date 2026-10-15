import type { MascotExpression } from '../mascot/expression';
import { isLateHour } from '../mascot/expression';

/**
 * What Rumbi knows about the day, all of it from the user's own records on
 * this device. Rumbi never claims to know more than this.
 */
export interface RumbiMoment {
  /** Local hour, 0–23. */
  hour: number;
  /** Consecutive days with at least one record (the app's streak). */
  streak: number;
  recordedToday: boolean;
  goalsMet: number;
  goalsTotal: number;
  workoutToday: boolean;
}

function timeLine(hour: number): string {
  if (isLateHour(hour)) return 'descansar también es progresar';
  if (hour < 12) return 'un día nuevo, un paso nuevo';
  if (hour < 19) return 'cada paso de hoy cuenta';
  return 'cierra el día con calma';
}

/**
 * Rumbi's short handwritten lines for the panel, the most relevant first.
 * Tapping Rumbi cycles through them. Encouraging, never a telling-off.
 */
export function rumbiLines(m: RumbiMoment): string[] {
  const lines: string[] = [];
  if (m.goalsTotal > 0 && m.goalsMet >= m.goalsTotal) lines.push('¡objetivos de hoy, cumplidos!');
  if (m.workoutToday) lines.push('entreno completado, ¡bravo!');
  if (m.streak >= 7) lines.push(`${m.streak} días seguidos, ¡sigue así!`);
  else if (m.streak >= 2) lines.push('la racha va cogiendo forma');
  if (!m.recordedToday) lines.push(m.hour < 12 ? '¿empezamos con un vaso de agua?' : 'aún estás a tiempo de sumar');
  lines.push(timeLine(m.hour), 'poco a poco, suma', 'tu ritmo, tu rumbo', 'lo que cuenta es seguir');
  return [...new Set(lines)];
}

/** Rumbi's resting face: sleepy late at night, proud on a day with everything done, otherwise happy. */
export function rumbiFace(m: RumbiMoment): MascotExpression {
  if (isLateHour(m.hour)) return 'sleepy';
  if ((m.goalsTotal > 0 && m.goalsMet >= m.goalsTotal) || m.workoutToday) return 'proud';
  return 'happy';
}
