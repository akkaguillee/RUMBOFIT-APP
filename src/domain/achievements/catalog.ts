import type { Metrics } from './metrics';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type CategoryId =
  | 'start'
  | 'consistency'
  | 'evolution'
  | 'hydration'
  | 'steps'
  | 'gym'
  | 'strength'
  | 'recovery'
  | 'organization'
  | 'self'
  | 'monthly'
  | 'longterm'
  | 'special';

export type AchievementIcon =
  | 'compass'
  | 'scale'
  | 'flag'
  | 'play'
  | 'pencil'
  | 'calendar'
  | 'flame'
  | 'shield'
  | 'repeat'
  | 'trending'
  | 'target'
  | 'mountain'
  | 'droplet'
  | 'waves'
  | 'footprints'
  | 'map'
  | 'route'
  | 'dumbbell'
  | 'medal'
  | 'trophy'
  | 'crown'
  | 'zap'
  | 'layers'
  | 'leaf'
  | 'moon'
  | 'clipboard'
  | 'book'
  | 'activity'
  | 'sparkles'
  | 'star'
  | 'gem'
  | 'sun'
  | 'clock'
  | 'heart';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  icon: AchievementIcon;
  rarity: Rarity;
  target: number;
  unit?: string;
  /** Explains why the achievement might not apply to the user's current goal. */
  requires?: 'weight_goal' | 'maintain_goal';
  metric: (m: Metrics) => number;
}

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'start', label: 'Inicio' },
  { id: 'consistency', label: 'Constancia' },
  { id: 'evolution', label: 'Evolución física' },
  { id: 'hydration', label: 'Hidratación' },
  { id: 'steps', label: 'Pasos y movimiento' },
  { id: 'gym', label: 'Gimnasio' },
  { id: 'strength', label: 'Fuerza' },
  { id: 'recovery', label: 'Recuperación' },
  { id: 'organization', label: 'Organización' },
  { id: 'self', label: 'Superación personal' },
  { id: 'monthly', label: 'Objetivos mensuales' },
  { id: 'longterm', label: 'Largo plazo' },
  { id: 'special', label: 'Hitos especiales' },
];

export const RARITIES: Record<Rarity, { label: string; order: number }> = {
  common: { label: 'Común', order: 0 },
  uncommon: { label: 'Poco común', order: 1 },
  rare: { label: 'Raro', order: 2 },
  epic: { label: 'Épico', order: 3 },
  legendary: { label: 'Legendario', order: 4 },
};

type D = Omit<AchievementDef, 'metric'> & { metric: keyof Metrics | ((m: Metrics) => number) };

const defs: D[] = [
  // ── Inicio
  { id: 'first-rumbo', name: 'Primer Rumbo', description: 'Completa tu perfil: nombre, edad, altura y peso.', category: 'start', icon: 'compass', rarity: 'common', target: 1, metric: 'profileComplete' },
  { id: 'first-step', name: 'Primer Paso', description: 'Registra tu peso por primera vez.', category: 'start', icon: 'scale', rarity: 'common', target: 1, metric: 'weightEntries' },
  { id: 'starting-point', name: 'Punto de Partida', description: 'Establece tu objetivo (con peso objetivo si quieres perder o ganar peso).', category: 'start', icon: 'flag', rarity: 'common', target: 1, metric: 'goalConfigured' },
  { id: 'underway', name: 'En Marcha', description: 'Completa tu primer día de seguimiento con al menos dos tipos de registro.', category: 'start', icon: 'play', rarity: 'common', target: 1, metric: 'firstFullTrackingDay' },
  { id: 'first-record', name: 'Primer Registro', description: 'Guarda una actividad: pasos o un entrenamiento.', category: 'start', icon: 'pencil', rarity: 'common', target: 1, metric: 'activityRecords' },
  { id: 'week-started', name: 'Semana Iniciada', description: 'Registra datos en 3 días distintos de una misma semana.', category: 'start', icon: 'calendar', rarity: 'common', target: 3, unit: 'días', metric: 'maxActiveDaysInWeek' },

  // ── Constancia
  { id: 'three-days', name: 'Tres Días en Marcha', description: 'Registra actividad en 3 días distintos.', category: 'consistency', icon: 'flame', rarity: 'common', target: 3, unit: 'días', metric: 'activeDays' },
  { id: 'first-week', name: 'Primera Semana', description: 'Registra datos durante 7 días distintos.', category: 'consistency', icon: 'calendar', rarity: 'uncommon', target: 7, unit: 'días', metric: 'activeDays' },
  { id: 'two-weeks', name: 'Dos Semanas de Rumbo', description: 'Mantén tus registros durante 14 días distintos.', category: 'consistency', icon: 'compass', rarity: 'uncommon', target: 14, unit: 'días', metric: 'activeDays' },
  { id: 'month-commitment', name: 'Un Mes de Compromiso', description: 'Registra datos en al menos 20 días de un mismo mes.', category: 'consistency', icon: 'calendar', rarity: 'rare', target: 20, unit: 'días', metric: 'bestMonthActiveDays' },
  { id: 'steel-constancy', name: 'Constancia de Acero', description: 'Registra actividad en 30 días diferentes.', category: 'consistency', icon: 'shield', rarity: 'rare', target: 30, unit: 'días', metric: 'activeDays' },
  { id: 'habit-builder', name: 'Constructor de Hábitos', description: 'Cumple algún objetivo diario (agua, pasos o entreno) 4 días por semana durante 4 semanas seguidas.', category: 'consistency', icon: 'layers', rarity: 'rare', target: 4, unit: 'semanas', metric: 'habitWeeksRun' },
  { id: 'back-on-track', name: 'Vuelta al Camino', description: 'Retoma el seguimiento después de 7 días o más sin registros. Volver también es avanzar.', category: 'consistency', icon: 'repeat', rarity: 'uncommon', target: 1, metric: 'comebacks' },

  // ── Evolución física
  { id: 'first-change', name: 'Primer Cambio', description: 'Registra tu peso en 2 días distintos para empezar a ver tu evolución.', category: 'evolution', icon: 'trending', rarity: 'common', target: 2, unit: 'días', metric: 'weightDays' },
  { id: 'weigh-in-10', name: 'Diez Pesajes', description: 'Registra tu peso 10 veces.', category: 'evolution', icon: 'scale', rarity: 'uncommon', target: 10, unit: 'registros', metric: 'weightEntries' },
  { id: 'intermediate-goal', name: 'Objetivo Intermedio', description: 'Alcanza el 10 % del camino hacia tu objetivo de peso.', category: 'evolution', icon: 'target', rarity: 'uncommon', target: 10, unit: '%', requires: 'weight_goal', metric: 'maxGoalProgressPct' },
  { id: 'quarter-way', name: 'Cuarto del Camino', description: 'Completa el 25 % de tu objetivo de peso.', category: 'evolution', icon: 'route', rarity: 'uncommon', target: 25, unit: '%', requires: 'weight_goal', metric: 'maxGoalProgressPct' },
  { id: 'halfway', name: 'Mitad del Camino', description: 'Completa el 50 % de tu objetivo de peso.', category: 'evolution', icon: 'route', rarity: 'rare', target: 50, unit: '%', requires: 'weight_goal', metric: 'maxGoalProgressPct' },
  { id: 'last-stretch', name: 'Último Tramo', description: 'Completa el 75 % de tu objetivo de peso.', category: 'evolution', icon: 'mountain', rarity: 'epic', target: 75, unit: '%', requires: 'weight_goal', metric: 'maxGoalProgressPct' },
  { id: 'goal-reached', name: 'Objetivo Alcanzado', description: 'Alcanza el peso objetivo que configuraste.', category: 'evolution', icon: 'trophy', rarity: 'epic', target: 100, unit: '%', requires: 'weight_goal', metric: 'maxGoalProgressPct' },
  { id: 'new-stage', name: 'Nueva Etapa', description: 'Establece un nuevo objetivo después de alcanzar el anterior.', category: 'evolution', icon: 'sparkles', rarity: 'epic', target: 1, requires: 'weight_goal', metric: 'newStageAfterGoal' },
  { id: 'steady-weight', name: 'Equilibrio', description: 'Con objetivo de mantenimiento, registra 4 pesajes en 28 días dentro de una franja de 3 kg.', category: 'evolution', icon: 'heart', rarity: 'rare', target: 1, requires: 'maintain_goal', metric: 'maintainStable' },

  // ── Hidratación
  { id: 'first-drop', name: 'Primera Gota', description: 'Registra agua por primera vez.', category: 'hydration', icon: 'droplet', rarity: 'common', target: 1, metric: 'waterDays' },
  { id: 'hydration-on', name: 'Hidratación en Marcha', description: 'Alcanza tu objetivo diario de agua en 3 días.', category: 'hydration', icon: 'droplet', rarity: 'common', target: 3, unit: 'días', metric: 'waterGoalDays' },
  { id: 'hydrated-week', name: 'Semana Hidratada', description: 'Cumple tu objetivo de agua 5 días de una misma semana.', category: 'hydration', icon: 'waves', rarity: 'uncommon', target: 5, unit: 'días', metric: 'maxWaterGoalDaysInWeek' },
  { id: 'hydration-habit', name: 'Hábito Consolidado', description: 'Cumple tu objetivo de agua en 20 días.', category: 'hydration', icon: 'waves', rarity: 'rare', target: 20, unit: 'días', metric: 'waterGoalDays' },
  { id: 'hundred-liters', name: 'Cien Litros', description: 'Registra un total de 100 litros de agua.', category: 'hydration', icon: 'droplet', rarity: 'rare', target: 100, unit: 'L', metric: 'totalWaterLiters' },
  { id: 'hydration-master', name: 'Maestro de la Constancia', description: 'Cumple tu objetivo de agua en 90 días.', category: 'hydration', icon: 'crown', rarity: 'epic', target: 90, unit: 'días', metric: 'waterGoalDays' },

  // ── Pasos
  { id: 'first-move', name: 'Primer Movimiento', description: 'Registra tus pasos por primera vez.', category: 'steps', icon: 'footprints', rarity: 'common', target: 1, metric: 'stepsDays' },
  { id: 'lets-walk', name: 'A Caminar', description: 'Alcanza tu objetivo diario de pasos.', category: 'steps', icon: 'footprints', rarity: 'common', target: 1, metric: 'stepsGoalDays' },
  { id: 'steady-pace', name: 'Ritmo Constante', description: 'Cumple tu objetivo de pasos en 5 días.', category: 'steps', icon: 'activity', rarity: 'uncommon', target: 5, unit: 'días', metric: 'stepsGoalDays' },
  { id: 'explorer', name: 'Explorador', description: 'Registra pasos durante 30 días.', category: 'steps', icon: 'map', rarity: 'rare', target: 30, unit: 'días', metric: 'stepsDays' },
  { id: 'personal-goal', name: 'Objetivo Personal', description: 'Cumple tu objetivo de pasos 4 días por semana durante 3 semanas seguidas.', category: 'steps', icon: 'target', rarity: 'rare', target: 3, unit: 'semanas', metric: 'stepsWeeksRun' },
  { id: 'long-road', name: 'Camino Largo', description: 'Acumula 500.000 pasos registrados.', category: 'steps', icon: 'route', rarity: 'epic', target: 500_000, unit: 'pasos', metric: 'totalSteps' },
  { id: 'million-steps', name: 'Un Millón de Pasos', description: 'Acumula 1.000.000 de pasos registrados.', category: 'steps', icon: 'crown', rarity: 'legendary', target: 1_000_000, unit: 'pasos', metric: 'totalSteps' },

  // ── Gimnasio
  { id: 'first-session', name: 'Primera Sesión', description: 'Completa tu primer entrenamiento.', category: 'gym', icon: 'dumbbell', rarity: 'common', target: 1, metric: 'workoutsCompleted' },
  { id: 'three-workouts', name: 'Tres Entrenamientos', description: 'Completa 3 sesiones.', category: 'gym', icon: 'dumbbell', rarity: 'common', target: 3, unit: 'sesiones', metric: 'workoutsCompleted' },
  { id: 'discipline', name: 'Disciplina en Construcción', description: 'Completa 10 sesiones.', category: 'gym', icon: 'layers', rarity: 'uncommon', target: 10, unit: 'sesiones', metric: 'workoutsCompleted' },
  { id: 'plan-done', name: 'Plan Cumplido', description: 'Completa un entrenamiento creado desde una plantilla.', category: 'gym', icon: 'clipboard', rarity: 'common', target: 1, metric: 'templateWorkouts' },
  { id: 'muscle-explorer', name: 'Explorador Muscular', description: 'Entrena 8 grupos musculares distintos.', category: 'gym', icon: 'map', rarity: 'uncommon', target: 8, unit: 'grupos', metric: 'musclesTrained' },
  { id: 'smart-return', name: 'Regreso Inteligente', description: 'Retoma los entrenamientos después de 14 días o más de pausa.', category: 'gym', icon: 'repeat', rarity: 'uncommon', target: 1, metric: 'workoutComebacks' },
  { id: 'twenty-five', name: 'Veinticinco Sesiones', description: 'Registra 25 entrenamientos.', category: 'gym', icon: 'medal', rarity: 'rare', target: 25, unit: 'sesiones', metric: 'workoutsCompleted' },
  { id: 'routine-set', name: 'Rutina Establecida', description: 'Entrena al menos 2 veces por semana durante 4 semanas seguidas.', category: 'gym', icon: 'calendar', rarity: 'rare', target: 4, unit: 'semanas', metric: 'workoutWeeksRun2' },
  { id: 'ten-hours', name: 'Diez Horas de Entreno', description: 'Acumula 10 horas de entrenamiento registradas.', category: 'gym', icon: 'clock', rarity: 'rare', target: 10, unit: 'h', metric: 'trainingHours' },
  { id: 'fifty', name: 'Medio Centenar', description: 'Completa 50 sesiones.', category: 'gym', icon: 'trophy', rarity: 'epic', target: 50, unit: 'sesiones', metric: 'workoutsCompleted' },
  { id: 'hundred', name: 'Cien Sesiones', description: 'Alcanza 100 entrenamientos.', category: 'gym', icon: 'crown', rarity: 'legendary', target: 100, unit: 'sesiones', metric: 'workoutsCompleted' },

  // ── Fuerza
  { id: 'progression', name: 'Progresión Registrada', description: 'Mejora una marca personal registrada (siempre con buena técnica).', category: 'strength', icon: 'trending', rarity: 'uncommon', target: 1, metric: 'personalBests' },
  { id: 'solid-session', name: 'Sesión Sólida', description: 'Completa 15 series en un mismo entrenamiento.', category: 'strength', icon: 'zap', rarity: 'uncommon', target: 15, unit: 'series', metric: 'maxSetsInSession' },
  { id: 'ten-tons', name: 'Diez Toneladas', description: 'Acumula 10.000 kg de volumen total (peso × repeticiones).', category: 'strength', icon: 'layers', rarity: 'uncommon', target: 10_000, unit: 'kg', metric: 'totalVolumeKg' },
  { id: 'ten-prs', name: 'Diez Marcas Personales', description: 'Registra 10 mejoras de marca personal.', category: 'strength', icon: 'medal', rarity: 'rare', target: 10, unit: 'marcas', metric: 'personalBests' },
  { id: 'hundred-tons', name: 'Cien Toneladas', description: 'Acumula 100.000 kg de volumen total.', category: 'strength', icon: 'mountain', rarity: 'epic', target: 100_000, unit: 'kg', metric: 'totalVolumeKg' },
  { id: 'steady-strength', name: 'Fuerza Constante', description: 'Registra 25 mejoras de marca personal.', category: 'strength', icon: 'trophy', rarity: 'epic', target: 25, unit: 'marcas', metric: 'personalBests' },

  // ── Recuperación
  { id: 'active-pause', name: 'Pausa Activa', description: 'Registra una sesión de movilidad o recuperación.', category: 'recovery', icon: 'leaf', rarity: 'common', target: 1, metric: 'recoverySessions' },
  { id: 'body-cared', name: 'Cuerpo Atendido', description: 'Completa 5 sesiones de movilidad o recuperación.', category: 'recovery', icon: 'leaf', rarity: 'uncommon', target: 5, unit: 'sesiones', metric: 'recoverySessions' },
  { id: 'balanced-week', name: 'Semana Equilibrada', description: 'Una semana con al menos 3 entrenamientos, uno de ellos de movilidad o recuperación.', category: 'recovery', icon: 'moon', rarity: 'rare', target: 1, metric: 'balancedWeeks' },
  { id: 'mindful-recovery', name: 'Recuperación Consciente', description: 'Completa 20 sesiones de movilidad o recuperación.', category: 'recovery', icon: 'moon', rarity: 'epic', target: 20, unit: 'sesiones', metric: 'recoverySessions' },

  // ── Organización
  { id: 'weekly-plan', name: 'Semana Organizada', description: 'Configura tu plan semanal de entrenamiento.', category: 'organization', icon: 'calendar', rarity: 'common', target: 1, metric: 'planConfigured' },
  { id: 'first-template', name: 'Primera Plantilla', description: 'Crea una plantilla de entrenamiento.', category: 'organization', icon: 'clipboard', rarity: 'common', target: 1, metric: 'templates' },
  { id: 'your-way', name: 'A Tu Manera', description: 'Crea un ejercicio personalizado.', category: 'organization', icon: 'pencil', rarity: 'common', target: 1, metric: 'customExercises' },
  { id: 'journal', name: 'Diario Personal', description: 'Añade una nota a un día del calendario.', category: 'organization', icon: 'book', rarity: 'common', target: 1, metric: 'notes' },
  { id: 'know-yourself', name: 'Conócete', description: 'Guarda un cálculo de IMC.', category: 'organization', icon: 'scale', rarity: 'common', target: 1, metric: 'bmiRecords' },
  { id: 'energy-known', name: 'Energía Estimada', description: 'Guarda una estimación de calorías diarias.', category: 'organization', icon: 'zap', rarity: 'common', target: 1, metric: 'energyRecords' },
  { id: 'routine-library', name: 'Biblioteca de Rutinas', description: 'Crea 3 plantillas de entrenamiento.', category: 'organization', icon: 'layers', rarity: 'uncommon', target: 3, unit: 'plantillas', metric: 'templates' },
  { id: 'logbook', name: 'Bitácora', description: 'Escribe notas en 10 días distintos.', category: 'organization', icon: 'book', rarity: 'uncommon', target: 10, unit: 'notas', metric: 'notes' },

  // ── Superación personal
  { id: 'streak-7', name: 'Siete Seguidos', description: 'Registra algo durante 7 días seguidos.', category: 'self', icon: 'flame', rarity: 'uncommon', target: 7, unit: 'días', metric: 'longestStreak' },
  { id: 'full-day', name: 'Día Completo', description: 'En un mismo día: cumple tu objetivo de agua y de pasos, y entrena.', category: 'self', icon: 'sun', rarity: 'uncommon', target: 1, metric: 'fullDays' },
  { id: 'streak-14', name: 'Catorce Seguidos', description: 'Registra algo durante 14 días seguidos.', category: 'self', icon: 'flame', rarity: 'rare', target: 14, unit: 'días', metric: 'longestStreak' },
  { id: 'full-days-10', name: 'Diez Días Completos', description: 'Consigue 10 días completos (agua, pasos y entreno).', category: 'self', icon: 'sun', rarity: 'epic', target: 10, unit: 'días', metric: 'fullDays' },
  { id: 'streak-30', name: 'Treinta Seguidos', description: 'Registra algo durante 30 días seguidos.', category: 'self', icon: 'star', rarity: 'epic', target: 30, unit: 'días', metric: 'longestStreak' },

  // ── Objetivos mensuales
  { id: 'month-weighins', name: 'Mes Medido', description: 'Registra tu peso 8 veces en un mismo mes.', category: 'monthly', icon: 'scale', rarity: 'uncommon', target: 8, unit: 'pesajes', metric: 'bestMonthWeighIns' },
  { id: 'month-workouts', name: 'Mes Entrenado', description: 'Completa 12 entrenamientos en un mismo mes.', category: 'monthly', icon: 'dumbbell', rarity: 'rare', target: 12, unit: 'sesiones', metric: 'bestMonthWorkouts' },
  { id: 'month-water', name: 'Mes Hidratado', description: 'Cumple tu objetivo de agua 20 días de un mismo mes.', category: 'monthly', icon: 'waves', rarity: 'rare', target: 20, unit: 'días', metric: 'bestMonthWaterGoalDays' },
  { id: 'month-steps', name: 'Mes en Movimiento', description: 'Cumple tu objetivo de pasos 20 días de un mismo mes.', category: 'monthly', icon: 'footprints', rarity: 'rare', target: 20, unit: 'días', metric: 'bestMonthStepsGoalDays' },
  { id: 'month-progress', name: 'Mes de Progreso Personal', description: 'Cumple algún objetivo diario en 15 días de un mismo mes.', category: 'monthly', icon: 'star', rarity: 'rare', target: 15, unit: 'días', metric: 'bestMonthGoalDays' },

  // ── Largo plazo
  { id: 'sixty-days', name: 'Sesenta Días de Rumbo', description: 'Registra actividad en 60 días distintos.', category: 'longterm', icon: 'compass', rarity: 'epic', target: 60, unit: 'días', metric: 'activeDays' },
  { id: 'ninety-days', name: 'Noventa Días de Constancia', description: 'Registra actividad en 90 días distintos.', category: 'longterm', icon: 'shield', rarity: 'epic', target: 90, unit: 'días', metric: 'activeDays' },
  { id: 'six-months', name: 'Seis Meses en Construcción', description: 'Registra actividad en 6 meses distintos.', category: 'longterm', icon: 'mountain', rarity: 'epic', target: 6, unit: 'meses', metric: 'activeMonths' },
  { id: 'two-hundred-days', name: 'Doscientos Días Activos', description: 'Registra actividad en 200 días distintos.', category: 'longterm', icon: 'gem', rarity: 'legendary', target: 200, unit: 'días', metric: 'activeDays' },
  { id: 'first-year', name: 'Primer Año de Seguimiento', description: 'Registra actividad en 12 meses distintos.', category: 'longterm', icon: 'crown', rarity: 'legendary', target: 12, unit: 'meses', metric: 'activeMonths' },

  // ── Especiales
  { id: 'rumbo-explorer', name: 'Explorador de RUMBO', description: 'Usa peso, agua, pasos, entrenamiento, notas, IMC y calorías.', category: 'special', icon: 'sparkles', rarity: 'uncommon', target: 7, unit: 'funciones', metric: 'featuresUsed' },
  { id: 'habit-recovered', name: 'Hábito Recuperado', description: 'Tras una pausa de 7 días o más, registra durante 7 días seguidos.', category: 'special', icon: 'heart', rarity: 'rare', target: 1, metric: 'habitRecovered' },
  { id: 'ten-weeks', name: 'Diez Semanas de Seguimiento', description: 'Registra datos al menos 3 días por semana en 10 semanas.', category: 'special', icon: 'calendar', rarity: 'rare', target: 10, unit: 'semanas', metric: 'weeksWith3ActiveDays' },
  { id: 'three-per-week', name: 'Rutina de Tres Días por Semana', description: 'Entrena 3 veces por semana durante 4 semanas seguidas.', category: 'special', icon: 'zap', rarity: 'epic', target: 4, unit: 'semanas', metric: 'workoutWeeksRun3' },
  { id: 'hundred-weighins', name: 'Cien Registros de Peso', description: 'Registra tu peso 100 veces.', category: 'special', icon: 'gem', rarity: 'epic', target: 100, unit: 'registros', metric: 'weightEntries' },
];

export const ACHIEVEMENTS: AchievementDef[] = defs.map((d) => ({
  ...d,
  metric: typeof d.metric === 'function' ? d.metric : (m: Metrics) => m[d.metric as keyof Metrics],
}));

/** Meta achievement evaluated after the others. */
export const COLLECTOR: Omit<AchievementDef, 'metric'> = {
  id: 'collector',
  name: 'Coleccionista',
  description: 'Desbloquea 25 hitos.',
  category: 'special',
  icon: 'trophy',
  rarity: 'epic',
  target: 25,
  unit: 'hitos',
};

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length + 1;
