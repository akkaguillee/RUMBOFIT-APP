import { formatInt, formatVolume } from '../units';
import type { TipContext } from './context';
import type { TipContent, TipRule } from './types';

/**
 * The built-in daily tips. Each rule only applies when the data it talks about
 * exists, and every number in the copy comes from the user's own records.
 *
 * Copy rules: tú, sentence case, concrete and kind. Never extreme restriction,
 * compensating food with exercise, guilt or promises of results. Short enough to
 * read at a glance: one idea, one concrete action. Rules without `gentle` are
 * never offered to minors or with health flags; those profiles only get general
 * wellbeing tips (`isSafeTip` double-checks every output), and with health flags
 * nothing that reads like a training prescription either.
 *
 * Priority bands: 90+ moments, 60–89 today's data, 35–59 profile answers, < 35 general.
 */

const has = <T>(list: readonly T[] | undefined, ...values: T[]) => !!list && values.some((v) => list.includes(v));

const days = (n: number) => (n === 1 ? '1 día' : `${n} días`);
const vol = (ctx: TipContext, ml: number) => formatVolume(ml, ctx.units);

/** "a, b y c" (or "a, b o c"). */
const listEs = (items: string[], conj: 'y' | 'o' = 'y') =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${conj} ${items[items.length - 1]}`;

/** Typical walking cadence (steps per minute), the same the Pasos tab uses for its estimates. */
const CADENCE = 100;

const weighsForGoal = (c: TipContext) => c.direction !== 'none' || c.goal === 'maintain' || c.goal === 'recomp';
const daysAway = (c: TipContext) => (c.records.recordedToday ? c.records.gapBeforeToday : c.records.daysSinceLast) ?? 0;
/** Pregnancy, an eating disorder or a medical condition: training is theirs to agree with a professional, not ours to prescribe. */
const flagged = (c: TipContext) => c.healthFlags.length > 0;
/** The week the weight goal is reached, its own celebration speaks for it. */
const celebratingGoal = (c: TipContext) => c.weight.goalReached && c.weight.reachedDaysAgo !== null && c.weight.reachedDaysAgo <= 7;
const highStress = (c: TipContext) => c.wellbeing.stress === 'high' || has(c.motivation.blockers, 'stress') || has(c.wellbeing.improve, 'stress');
const poorSleep = (c: TipContext) => c.wellbeing.sleepHours === 'lt6' || c.wellbeing.rest === 'poor';

/** Quick staples for planning, adapted to the eating pattern and allergies the user told us about. */
function staples(c: TipContext): string {
  const avoid = c.food.restrictions ?? [];
  const plantOnly = c.food.pattern === 'vegan';
  const protein = !plantOnly && !avoid.includes('egg') ? 'huevos' : !avoid.includes('soy') ? 'tofu' : null;
  return listEs([...(protein ? [protein] : []), 'legumbre cocida', 'verdura congelada', 'fruta']);
}

/** Protein examples for the plate guide, within the eating pattern and allergies the user told us about. */
function proteins(c: TipContext): string {
  const avoid = c.food.restrictions ?? [];
  const p = c.food.pattern;
  const plant = p === 'vegan' || p === 'vegetarian';
  return listEs(
    [
      'legumbre',
      ...(p !== 'vegan' && !avoid.includes('egg') ? ['huevo'] : []),
      ...(plant && !avoid.includes('soy') ? ['tofu'] : []),
      ...(!plant && !avoid.includes('fish') ? ['pescado'] : []),
      ...(!plant && p !== 'pescatarian' ? ['carne'] : []),
    ],
    'o',
  );
}

function timeTip(c: TipContext): TipContent {
  const minutes = c.motivation.dailyMinutes;
  if (minutes === 10) {
    return {
      title: 'Tus 10 minutos cuentan',
      body: 'Con 10 minutos basta para algo útil: un paseo rápido, unas sentadillas o estirar. Lo importante es que sea fácil de repetir mañana.',
    };
  }
  if (minutes === 20) {
    return {
      title: 'Tus 20 minutos cuentan',
      body: 'Veinte minutos dan para un circuito corto de cuerpo completo o un paseo a buen ritmo. Mejor algo breve cada día que una sesión larga de vez en cuando.',
    };
  }
  if (minutes !== undefined) {
    return {
      title: 'Ponle hora, como a una cita',
      body: `Reserva tus ${minutes} minutos a una hora fija: lo que tiene hora y lugar se cumple mucho más que lo que queda para «cuando pueda».`,
      action: { label: 'Ver tu plan', to: '/entreno' },
    };
  }
  return {
    title: 'Muévete en bloques',
    body: 'Varios bloques de 10 minutos al día marcan la diferencia: caminar durante una llamada, subir por las escaleras o estirar antes de dormir.',
  };
}

export const RULES: TipRule[] = [
  // ── Moments (90+) ──────────────────────────────────────────────────
  {
    id: 'comeback-return',
    topic: 'comeback',
    gentle: true,
    when: (c) => c.records.any && !c.records.recordedToday && (c.records.daysSinceLast ?? 0) >= 3,
    // Still true after the first record of the day (then in the past tense); the extra tip acknowledges the record.
    holds: (c) => daysAway(c) >= 3,
    priority: () => 95,
    build: (c) =>
      c.records.recordedToday
        ? {
            title: 'No necesitas hacerlo todo hoy',
            body: `Habían pasado ${days(daysAway(c))} desde tu último registro y no pasa nada. No hace falta ponerte al día: una o dos cosas fáciles hoy bastan para retomar el ritmo.`,
            action: { label: 'Ver tu semana', to: '/calendario' },
          }
        : {
            title: 'No necesitas hacerlo todo hoy',
            body: `Han pasado ${days(daysAway(c))} desde tu último registro y no pasa nada. Elige una cosa fácil, como un vaso de agua o un paseo corto, y regístrala: retomar ya es avanzar.`,
            action: { label: 'Registrar agua', to: '/habitos' },
          },
  },
  {
    id: 'comeback-done',
    topic: 'comeback',
    gentle: true,
    event: 'comeback',
    when: (c) => c.records.recordedToday && (c.records.gapBeforeToday ?? 0) >= 3,
    priority: () => 93,
    build: (c) => ({
      title: 'Ya estás de vuelta',
      body: `Tu primer registro tras ${days(c.records.gapBeforeToday ?? 0)} ya cuenta. No hace falta ponerte al día: mañana basta con repetir algo igual de sencillo.`,
      action: { label: 'Ver tu semana', to: '/calendario' },
    }),
  },
  {
    id: 'weight-goal-reached',
    topic: 'celebrate',
    weight: true,
    event: 'weightGoal',
    // Celebrated in the week it happens, not every week while the weight stays there.
    when: (c) => c.weight.goalReached && c.weight.reachedDaysAgo !== null && c.weight.reachedDaysAgo <= 7,
    priority: () => 96,
    build: () => ({
      title: 'Has llegado a tu objetivo de peso',
      body: 'Tómate un momento para valorarlo. Ahora lo importante es sostenerlo con calma; cuando quieras, puedes cambiar tu objetivo a mantenimiento.',
      action: { label: 'Revisar tu objetivo', to: '/perfil#goal' },
    }),
  },
  {
    id: 'goals-all-met',
    topic: 'celebrate',
    gentle: true,
    event: 'allGoals',
    when: (c) => c.goalsToday.allMet,
    priority: () => 92,
    build: (c) => ({
      title: 'Objetivos de hoy cumplidos',
      body: `${c.training.plannedToday ? 'Agua, pasos y entreno' : 'Agua y pasos'}: todo hecho. Disfruta del resto del día; descansar bien también forma parte del progreso.`,
      action: { label: 'Ver tu semana', to: '/calendario' },
    }),
  },
  {
    id: 'workout-done',
    topic: 'training',
    gentle: true,
    event: 'workout',
    when: (c) => c.training.doneToday,
    priority: () => 90,
    build: () => ({
      title: 'Entreno completado',
      body: 'Buen trabajo. Bebe agua, come con normalidad y procura dormir bien: es durante la recuperación cuando tu cuerpo asimila el esfuerzo.',
      action: { label: 'Ver tu historial', to: '/entreno?tab=historial' },
    }),
  },

  // ── Today's data (60–89) ───────────────────────────────────────────
  {
    id: 'training-active',
    topic: 'training',
    gentle: true,
    when: (c) => c.training.activeSession,
    priority: () => 86,
    build: () => ({
      title: 'Tienes un entreno en marcha',
      body: 'Cuando acabes, pulsa «Finalizar» para guardar tus series y el tiempo. Si terminas antes de lo previsto, lo que hayas hecho también cuenta.',
      action: { label: 'Volver al entreno', to: '/entreno/sesion' },
    }),
  },
  {
    id: 'start-first-record',
    topic: 'start',
    gentle: true,
    when: (c) => !c.records.any,
    priority: () => 85,
    build: () => ({
      title: 'Tu primer registro',
      body: 'Empieza por lo más fácil: un vaso de agua o tus pasos de hoy. Con unos días de datos, tus consejos se ajustarán mucho más a ti.',
      action: { label: 'Registrar agua', to: '/habitos' },
    }),
  },
  {
    id: 'progress-gradual',
    topic: 'progress',
    weight: true,
    when: (c) => c.weight.fast,
    priority: () => 80,
    build: (c) => ({
      title: 'Mejor un ritmo gradual',
      body: `Tu peso está ${c.direction === 'up' ? 'subiendo' : 'bajando'} más deprisa de lo que suele recomendarse. Un ritmo gradual es más fácil de sostener: ${
        c.direction === 'up' ? 'haz los cambios poco a poco' : 'come lo suficiente y descansa bien'
      } y, si tienes dudas, consulta con un profesional.`,
      action: { label: 'Ver tu estimación', to: '/progresos?tab=calorias' },
    }),
  },
  {
    id: 'recovery-rest',
    topic: 'recovery',
    gentle: true,
    when: (c) =>
      c.training.consecutiveDays >= 3 ||
      c.training.completedLast7 >= 6 ||
      (c.activity.level === 'very_active' && c.training.completedLast7 >= 4),
    priority: () => 76,
    build: (c) => ({
      title: 'Descansar también es avanzar',
      body: `${
        c.training.consecutiveDays >= 3
          ? `Llevas ${c.training.consecutiveDays} días seguidos entrenando.`
          : `Llevas ${c.training.completedLast7} entrenos en los últimos 7 días.`
      } Un día de descanso o una sesión suave, como caminar o movilidad, te ayuda a recuperarte y a rendir mejor después.`,
      action: { label: 'Ver tu plan', to: '/entreno' },
    }),
  },
  {
    id: 'training-planned',
    topic: 'training',
    gentle: true,
    when: (c) => c.training.plannedToday && !c.training.doneToday && !c.training.activeSession,
    // Starting the session doesn't make today's tip obsolete; finishing it does.
    holds: (c) => c.training.plannedToday && !c.training.doneToday,
    priority: () => 72,
    build: (c) => {
      if (c.training.activeSession) {
        return {
          title: 'Hoy tienes entreno',
          body: 'Tu sesión ya está en marcha. Cuando acabes, pulsa «Finalizar» para guardar tus series; si vas justo de tiempo o de energía, una versión más corta también cuenta.',
          action: { label: 'Volver al entreno', to: '/entreno/sesion' },
        };
      }
      const body = flagged(c)
        ? 'Hoy es uno de tus días de entreno. Ve a tu ritmo y para si algo no te sienta bien; si un profesional te ha dado pautas, síguelas.'
        : c.training.hasPlan && c.training.plannedLabel
          ? `Tu plan de hoy es «${c.training.plannedLabel}». Si vas justo de tiempo o de energía, una versión más corta también cuenta.`
          : 'Hoy es uno de tus días de entreno. Si vas justo de tiempo o de energía, una sesión corta también cuenta.';
      return { title: 'Hoy tienes entreno', body, action: { label: 'Ir a entrenar', to: '/entreno' } };
    },
  },
  {
    id: 'streak-strong',
    topic: 'consistency',
    gentle: true,
    when: (c) => c.streak.current >= 7,
    priority: () => 70,
    build: (c) => ({
      title: `${c.streak.current} días seguidos`,
      body: 'Registrar algo cada día ya forma parte de tu rutina. Si algún día no puedes, no pasa nada: lo que cuenta es volver al siguiente.',
      action: { label: 'Ver tus hitos', to: '/hitos' },
    }),
  },
  {
    id: 'consistency-not-two',
    topic: 'consistency',
    gentle: true,
    when: (c) =>
      (c.records.any && c.records.daysSinceLast === 2) ||
      c.motivation.hardest === 'consistency' ||
      has(c.motivation.dropReasons, 'perfectionism') ||
      c.goal === 'consistency' ||
      c.goal === 'habits',
    holds: (c) => c.records.any,
    priority: (c) => (c.records.daysSinceLast === 2 ? 68 : 44),
    // Same title in both versions, so the first record of the day only updates the text.
    build: (c) => ({
      title: 'Fallar un día es normal',
      body:
        c.records.daysSinceLast === 2
          ? 'Ayer no hubo registros y no pasa nada. Lo que ayuda es no dejar pasar otro: hoy basta con algo corto, como un vaso de agua o un paseo.'
          : 'Lo que marca la diferencia es no encadenar dos. Si un día no puedes, retoma al siguiente, aunque sea con una versión corta de tu rutina.',
    }),
  },
  {
    id: 'progress-nonlinear',
    topic: 'progress',
    weight: true,
    // At the goal, a stable weight is the point: nothing to reassure about.
    when: (c) => c.direction !== 'none' && !c.weight.goalReached && (c.weight.trend === 'stable' || c.weight.trend === 'against'),
    priority: () => 66,
    build: (c) => ({
      title: 'El progreso no siempre es lineal',
      body: `${
        c.weight.trend === 'stable'
          ? 'Tu peso apenas se ha movido en dos semanas'
          : `Estas dos semanas tu peso ha ${c.direction === 'up' ? 'bajado' : 'subido'} un poco`
      }, y es habitual: el agua, la sal, el sueño o el estrés influyen. Mira la tendencia de tres o cuatro semanas antes de cambiar nada.`,
      action: { label: 'Ver tu evolución', to: '/progresos' },
    }),
  },
  {
    id: 'water-today',
    topic: 'water',
    gentle: true,
    when: (c) => c.water.tracking && c.water.todayMl < c.water.goalMl,
    // Reaching the goal doesn't swap today's tip for an unrelated one: it says so. Every goal met is its own moment.
    holds: (c) => c.water.tracking && !c.goalsToday.allMet,
    priority: () => 63,
    build: (c) => {
      const { todayMl, goalMl } = c.water;
      if (todayMl >= goalMl) {
        return {
          title: 'Objetivo de agua cumplido',
          body: `Llevas ${vol(c, todayMl)} de ${vol(c, goalMl)}. A partir de aquí, bebe según tu sed, sobre todo si hace calor o entrenas.`,
        };
      }
      const action = { label: 'Registrar agua', to: '/habitos' } as const;
      return todayMl > 0
        ? {
            title: `Te faltan ${vol(c, goalMl - todayMl)} de agua`,
            body: `Llevas ${vol(c, todayMl)} de ${vol(c, goalMl)}. Ten la botella a la vista y bebe a sorbos a lo largo del día.`,
            action,
          }
        : {
            title: 'Empieza con un vaso de agua',
            body: `Tu objetivo de hoy es ${vol(c, goalMl)}. Ten la botella a la vista y ve sumando a sorbos a lo largo del día.`,
            action,
          };
    },
  },
  {
    id: 'streak-building',
    topic: 'consistency',
    gentle: true,
    when: (c) => c.streak.current >= 3 && c.streak.current < 7,
    priority: () => 62,
    build: (c) => ({
      title: 'Vas cogiendo ritmo',
      body: `Llevas ${c.streak.current} días seguidos registrando algo. Asocia el registro a algo que ya haces, como el café de la mañana, y saldrá casi solo.`,
    }),
  },
  {
    id: 'steps-today',
    topic: 'steps',
    gentle: true,
    when: (c) => c.steps.tracking && c.steps.today < c.steps.goal,
    holds: (c) => c.steps.tracking && !c.goalsToday.allMet,
    priority: () => 61,
    build: (c) => {
      if (c.steps.today >= c.steps.goal) {
        return {
          title: 'Objetivo de pasos cumplido',
          body: `Llevas ${formatInt(c.steps.today)} de ${formatInt(c.steps.goal)} pasos. Lo de hoy ya está hecho: si te apetece moverte más, que sea por gusto.`,
        };
      }
      const left = c.steps.goal - c.steps.today;
      const minutes = Math.max(5, Math.round(left / CADENCE / 5) * 5);
      const how =
        minutes <= 45
          ? `Unos ${minutes} minutos caminando te acercan a tu objetivo de ${formatInt(c.steps.goal)}.`
          : `Varios paseos cortos a lo largo del día te acercan a tu objetivo de ${formatInt(c.steps.goal)}.`;
      return {
        title: c.steps.today > 0 ? `Te faltan ${formatInt(left)} pasos` : 'Suma pasos a tu manera',
        body: `${how} Hablar por teléfono mientras caminas o bajarte una parada antes también suma.`,
        action: { label: 'Registrar pasos', to: '/habitos?tab=pasos' },
      };
    },
  },
  {
    id: 'progress-on-track',
    topic: 'progress',
    weight: true,
    when: (c) => c.weight.trend === 'favorable' && !c.weight.fast && !celebratingGoal(c),
    priority: () => 60,
    build: (c) =>
      c.weight.goalReached
        ? {
            // Past the goal and still moving the same way: never encourage going further.
            title: 'Ya estás en tu objetivo',
            body: `Tu peso ya ha llegado al objetivo que te marcaste, así que no hace falta seguir ${
              c.direction === 'up' ? 'subiendo' : 'bajando'
            }. Ahora lo importante es sostenerlo con calma.`,
            action: { label: 'Revisar tu objetivo', to: '/perfil#goal' },
          }
        : {
            title: 'Vas en buena dirección',
            body: 'Tu tendencia de las dos últimas semanas avanza hacia tu objetivo. Mantén lo que te está funcionando: no hace falta acelerar.',
            action: { label: 'Ver tu evolución', to: '/progresos' },
          },
  },

  // ── Profile answers and recent patterns (35–59) ────────────────────
  {
    id: 'steps-week',
    topic: 'steps',
    gentle: true,
    when: (c) => c.steps.goalDaysLast7 >= 5,
    priority: () => 58,
    build: (c) => ({
      title: c.steps.goalDaysLast7 >= 7 ? 'Pasos cumplidos toda la semana' : `Objetivo de pasos: ${c.steps.goalDaysLast7} de 7 días`,
      body: `Has llegado a tu objetivo de pasos ${c.steps.goalDaysLast7 >= 7 ? 'cada día' : 'casi cada día'}. ${
        c.gentle ? 'Mantener un ritmo que te siente bien es lo que más cuenta.' : 'Si te resulta cómodo, puedes subirlo un poco; si no, mantenerlo también es avanzar.'
      }`,
      action: { label: 'Ver tus pasos', to: '/habitos?tab=pasos' },
    }),
  },
  {
    id: 'weighing-trend',
    topic: 'weighing',
    weight: true,
    when: (c) => c.weight.weighInsLast7 >= 6,
    priority: () => 56,
    build: (c) => ({
      title: 'La báscula no lo cuenta todo',
      body: `El peso puede variar ${c.units === 'imperial' ? 'más de dos libras' : 'más de un kilo'} de un día a otro por el agua y la comida. Fíjate en la tendencia semanal, no en el número de cada mañana.`,
      action: { label: 'Ver la tendencia', to: '/progresos' },
    }),
  },
  {
    id: 'sleep-routine',
    topic: 'sleep',
    gentle: true,
    when: () => true,
    priority: (c) => (poorSleep(c) ? 54 : c.wellbeing.regularSchedule === 'no' || has(c.wellbeing.improve, 'sleep', 'screens') ? 46 : 16),
    build: (c) =>
      has(c.wellbeing.improve, 'screens') || (poorSleep(c) && c.wellbeing.regularSchedule !== 'no')
        ? {
            title: 'Cuida la última hora del día',
            body: 'Baja la luz y aparca las pantallas un rato antes de dormir. Evita la cafeína por la tarde: su efecto puede durar varias horas.',
          }
        : {
            title: 'Horarios de sueño regulares',
            body: 'Acostarte y levantarte a horas parecidas, también el fin de semana, ayuda a dormir mejor. Si una noche duermes poco, entrena más suave al día siguiente.',
          },
  },
  {
    id: 'stress-walk',
    topic: 'stress',
    gentle: true,
    when: (c) => highStress(c) || c.wellbeing.stress === 'medium',
    priority: (c) => (highStress(c) ? 52 : 30),
    build: () => ({
      title: 'Camina para despejarte',
      body: 'Un paseo de 10 a 20 minutos, mejor al aire libre, puede ayudarte a bajar revoluciones. Prueba a respirar más despacio mientras caminas.',
      action: { label: 'Registrar pasos', to: '/habitos?tab=pasos' },
    }),
  },
  {
    id: 'wellbeing-professional',
    topic: 'wellbeing',
    gentle: true,
    when: (c) => c.gentle,
    priority: () => 52,
    build: (c) =>
      c.minor
        ? {
            title: 'Cuidarte con buena compañía',
            body: 'A tu edad, lo que más ayuda es comer con regularidad, dormir bien y moverte cada día. Si te preocupa tu cuerpo o tu alimentación, háblalo con tu familia y con un profesional sanitario.',
          }
        : {
            title: 'Con el apoyo de un profesional',
            body: 'En tu situación, cualquier cambio en tu alimentación o en tu actividad es mejor pautarlo con un profesional sanitario. Aquí puedes registrar tus hábitos con calma.',
          },
  },
  {
    id: 'water-habit',
    topic: 'water',
    gentle: true,
    when: (c) => !c.water.tracking,
    priority: (c) => (c.food.water === 'low' || has(c.wellbeing.improve, 'water') || c.motivation.firstFocus === 'water' ? 52 : 22),
    build: () => ({
      title: 'El agua también cuenta',
      body: 'Deja una botella a la vista y bebe a lo largo del día. Registrar lo que bebes en Hábitos te ayuda a ver si llegas a tu objetivo.',
      action: { label: 'Registrar agua', to: '/habitos' },
    }),
  },
  {
    id: 'time-micro',
    topic: 'time',
    gentle: true,
    when: (c) => has(c.motivation.blockers, 'time') || has(c.motivation.dropReasons, 'busy') || (c.motivation.dailyMinutes ?? 99) <= 20,
    priority: () => 50,
    build: timeTip,
  },
  {
    id: 'weighing-conditions',
    topic: 'weighing',
    weight: true,
    when: (c) => weighsForGoal(c) && (c.weight.count === 0 ? c.daysSinceStart >= 1 : (c.weight.daysSinceWeighIn ?? 0) >= 7),
    priority: () => 50,
    build: (c) =>
      c.weight.count === 0
        ? {
            title: 'Tu punto de partida',
            body: 'Si quieres seguir tu peso, pésate de vez en cuando por la mañana, después de ir al baño y antes de desayunar. Así las comparaciones son más fiables.',
            action: { label: 'Ir a Progresos', to: '/progresos' },
          }
        : {
            title: 'Cuándo pesarte',
            body: `Tu último registro de peso fue hace ${days(c.weight.daysSinceWeighIn ?? 0)}. Si quieres retomarlo, pésate por la mañana, antes de desayunar: una o dos veces por semana es suficiente.`,
            action: { label: 'Ir a Progresos', to: '/progresos' },
          },
  },
  {
    id: 'food-impulse',
    topic: 'food',
    when: (c) => has(c.food.difficulties, 'impulse'),
    priority: () => 50,
    build: () => ({
      title: 'Lo que está a la vista se come',
      body: 'Deja fruta lavada a mano y guarda en un armario lo que sueles picar sin pensar. Cambiar el entorno funciona mejor que tirar de fuerza de voluntad.',
    }),
  },
  {
    id: 'food-portions',
    topic: 'food',
    when: (c) => has(c.food.difficulties, 'portions'),
    priority: () => 50,
    build: () => ({
      title: 'Escucha tu saciedad',
      body: 'Come despacio y para cuando estés a gusto. Servir el plato en la cocina, en lugar de dejar la fuente en la mesa, ayuda a ajustar la cantidad sin contar nada.',
    }),
  },
  {
    id: 'food-planning',
    topic: 'food',
    when: (c) => has(c.food.difficulties, 'planning', 'consistency') || c.food.schedule === 'irregular' || c.food.schedule === 'skips',
    priority: () => 48,
    build: (c) =>
      c.food.schedule === 'skips' && !has(c.food.difficulties, 'planning', 'consistency')
        ? {
            title: 'Comer con regularidad',
            body: 'Si a menudo pasas muchas horas sin comer, puedes llegar con mucha hambre a la siguiente comida. Llevar encima algo sencillo, como una pieza de fruta, ayuda.',
          }
        : {
            title: 'Planifica solo lo justo',
            body: `No hace falta organizar toda la semana. Decide dos o tres comidas por adelantado y ten a mano básicos fáciles: ${staples(c)}.`,
          },
  },
  {
    id: 'food-plate',
    topic: 'food',
    when: (c) => has(c.food.difficulties, 'choosing') || c.food.improve === 'yes' || c.food.improve === 'a_bit' || c.motivation.firstFocus === 'food',
    priority: (c) => (has(c.food.difficulties, 'choosing') ? 48 : 34),
    build: (c) => ({
      title: 'Un plato de referencia',
      body: `Una guía sencilla, sin contar nada: medio plato de verdura, un cuarto de proteína (${proteins(c)}) y el otro cuarto de cereales o patata.`,
    }),
  },
  {
    id: 'mindset-beyond-scale',
    topic: 'mindset',
    gentle: true,
    when: (c) => c.motivation.hardest === 'results' || has(c.motivation.blockers, 'results') || has(c.motivation.dropReasons, 'no_results'),
    priority: () => 48,
    build: () => ({
      title: 'El progreso no es solo un número',
      body: 'La energía, el descanso, cómo te sientes o cuánto aguantas caminando también son progreso. Apúntalos en las notas del calendario para no perderlos de vista.',
      action: { label: 'Abrir el calendario', to: '/calendario' },
    }),
  },
  {
    id: 'start-basics',
    topic: 'start',
    when: (c) => has(c.motivation.blockers, 'knowledge') || c.motivation.hardest === 'start' || (c.daysSinceStart < 14 && c.records.totalActiveDays < 5),
    priority: (c) => (has(c.motivation.blockers, 'knowledge') ? 48 : 30),
    build: () => ({
      title: 'Lo básico primero',
      body: 'Dormir bien, moverte cada día, entrenar fuerza dos o tres veces por semana e incluir proteína en tus comidas. Con eso ya tienes una base muy sólida.',
    }),
  },
  {
    id: 'profile-review',
    topic: 'profile',
    gentle: true,
    when: (c) => c.profileData.daysSinceUpdate !== null && c.profileData.daysSinceUpdate >= 90 && c.daysSinceStart >= 90,
    priority: () => 47,
    build: (c) => ({
      title: '¿Siguen al día tus datos?',
      body: `Hace ${Math.floor((c.profileData.daysSinceUpdate ?? 90) / 30)} meses que no actualizas tu perfil. Si han cambiado tu rutina, tu actividad o tu objetivo, revisarlo ayuda a que las estimaciones y los consejos se ajusten a ti.`,
      action: { label: 'Revisar tu perfil', to: '/perfil' },
    }),
  },
  {
    id: 'mindset-small',
    topic: 'mindset',
    gentle: true,
    when: (c) =>
      c.motivation.style === 'small' ||
      c.motivation.hardest === 'start' ||
      has(c.motivation.blockers, 'motivation') ||
      has(c.motivation.dropReasons, 'fatigue', 'perfectionism', 'boredom'),
    priority: () => 46,
    build: () => ({
      title: 'Empieza muy pequeño',
      body: 'Diez minutos también cuentan. La motivación suele llegar después de empezar, no antes: ponte en marcha y deja que el impulso haga el resto.',
    }),
  },
  {
    id: 'mindset-challenge',
    topic: 'mindset',
    when: (c) => c.motivation.style === 'challenging' || has(c.motivation.motivators, 'challenges'),
    priority: () => 46,
    build: (c) => ({
      title: 'Un reto para esta semana',
      body: c.steps.tracking
        ? `Elige un reto medible para los próximos 7 días, como llegar a tus ${formatInt(c.steps.goal)} pasos cinco días. Que sea exigente pero realista: cumplirlo te dará impulso.`
        : 'Elige un reto medible para los próximos 7 días, como cumplir los días de tu plan o tu objetivo de agua cinco días. Que sea exigente pero realista.',
      action: { label: 'Ver tus hitos', to: '/hitos' },
    }),
  },
  {
    id: 'food-eating-out',
    topic: 'food',
    when: (c) => c.food.eatingOut === 'several' || c.food.eatingOut === 'daily' || has(c.motivation.blockers, 'social'),
    priority: () => 46,
    build: () => ({
      title: 'Mira la carta antes',
      body: 'Decidir con calma antes de llegar evita elegir con prisa o con hambre. Busca un plato con verdura y proteína, y disfruta de la comida sin agobios.',
    }),
  },
  {
    id: 'training-plan',
    topic: 'training',
    gentle: true,
    when: (c) =>
      !flagged(c) &&
      !c.training.hasPlan &&
      c.training.completedTotal === 0 &&
      (c.training.plannedPerWeek > 0 || (c.activity.trainingDaysPerWeek ?? 0) > 0 || has(['strength', 'fitness', 'recomp', 'gain'], c.goal)),
    priority: () => 45,
    build: () => ({
      title: 'Organiza tu semana',
      body: 'Un plan semanal sencillo te quita la decisión de cada día. Empieza solo con los días que de verdad puedes entrenar; ya habrá tiempo de añadir más.',
      action: { label: 'Crear tu plan', to: '/entreno' },
    }),
  },
  {
    id: 'training-technique',
    topic: 'training',
    gentle: true,
    when: (c) => !flagged(c) && (c.activity.experience === 'beginner' || (c.training.completedTotal > 0 && c.training.completedTotal < 6)),
    priority: (c) => (c.activity.experience === 'beginner' ? 44 : 34),
    build: () => ({
      title: 'Técnica antes que carga',
      body: 'Usa pesos con los que podrías hacer dos o tres repeticiones más. Aprender bien cada movimiento ahora te permitirá progresar sin molestias.',
    }),
  },
  {
    id: 'steps-breaks',
    topic: 'steps',
    gentle: true,
    when: (c) => c.activity.posture === 'sitting' || c.activity.job === 'desk' || c.activity.job === 'student',
    priority: () => 42,
    build: () => ({
      title: 'Pausas activas',
      body: 'Si pasas muchas horas en la silla, levántate cada hora un par de minutos: estirarte, ir a por agua o subir unas escaleras suma más de lo que parece.',
    }),
  },
  {
    id: 'profile-preferences',
    topic: 'profile',
    gentle: true,
    when: (c) => !c.profileData.personalised,
    priority: () => 40,
    build: () => ({
      title: 'Cuéntanos un poco más',
      body: 'Si respondes unas preguntas sobre tu rutina, tu descanso y lo que más te cuesta, tus consejos diarios se ajustarán mucho más a ti.',
      action: { label: 'Completar preferencias', to: '/perfil#preferencias' },
    }),
  },

  // ── General (< 35) ─────────────────────────────────────────────────
  {
    id: 'general-today',
    topic: 'mindset',
    gentle: true,
    when: () => true,
    priority: () => 10,
    build: () => ({
      title: 'Hoy también cuenta',
      body: 'No necesitas un día perfecto. Un paseo, un registro o una comida tranquila ya te acercan a lo que buscas.',
    }),
  },
];
