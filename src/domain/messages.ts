import type { DateKey } from './dates';

export interface MessageContext {
  today: DateKey;
  hasAnyRecord: boolean;
  recordedToday: boolean;
  currentStreak: number;
  daysSinceLast: number | null;
  goalsMetToday: number;
  goalsTotal: number;
  workoutToday: boolean;
  plannedToday: boolean;
}

const pick = (options: string[], seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return options[Math.abs(h) % options.length] as string;
};

/** Deterministic per day so the message doesn't change on every render. */
export function dailyMessage(ctx: MessageContext): string {
  if (!ctx.hasAnyRecord) {
    return 'Todo empieza con un primer registro. Hoy también cuenta.';
  }
  if (ctx.daysSinceLast !== null && ctx.daysSinceLast >= 7 && !ctx.recordedToday) {
    return 'No necesitas hacerlo perfecto para seguir avanzando. Retomar ya es avanzar.';
  }
  if (ctx.goalsTotal > 0 && ctx.goalsMetToday === ctx.goalsTotal) {
    return pick(
      ['Objetivos de hoy cumplidos. Tu constancia está construyendo algo importante.', 'Día redondo. Disfruta también del descanso.'],
      ctx.today,
    );
  }
  if (ctx.plannedToday && !ctx.workoutToday) {
    return pick(['Hoy tienes entrenamiento planificado. Sin prisa, a tu ritmo.', 'Tu plan de hoy te espera cuando estés listo.'], ctx.today);
  }
  if (ctx.currentStreak >= 7) {
    return `${ctx.currentStreak} días seguidos registrando. Tu constancia está construyendo algo importante.`;
  }
  if (ctx.currentStreak >= 3) {
    return pick(['Vas cogiendo ritmo. Un día más, un poco más de claridad.', 'Pequeños pasos, todos los días. Así se construye.'], ctx.today);
  }
  if (ctx.recordedToday) {
    return 'Un registro más. Un poco más de claridad sobre tu progreso.';
  }
  return pick(
    ['Hoy también cuenta.', 'No necesitas hacerlo perfecto para seguir avanzando.', 'Cada pequeño paso cuenta.'],
    ctx.today,
  );
}

export const LOG_FEEDBACK = [
  'Un registro más. Un poco más de claridad sobre tu progreso.',
  'Guardado. Hoy también cuenta.',
  'Hecho. Cada pequeño paso cuenta.',
];

export function feedbackMessage(seed: number): string {
  return LOG_FEEDBACK[Math.abs(seed) % LOG_FEEDBACK.length] as string;
}
