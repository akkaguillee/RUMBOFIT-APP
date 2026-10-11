import type { Exercise, ExerciseMeasure, MuscleGroup } from '../types';

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string; short: string }[] = [
  { id: 'chest', label: 'Pecho', short: 'Pecho' },
  { id: 'back', label: 'Espalda', short: 'Espalda' },
  { id: 'shoulders', label: 'Hombros', short: 'Hombros' },
  { id: 'biceps', label: 'Bíceps', short: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps', short: 'Tríceps' },
  { id: 'forearms', label: 'Antebrazos', short: 'Antebrazos' },
  { id: 'core', label: 'Core y abdominales', short: 'Core' },
  { id: 'quads', label: 'Cuádriceps', short: 'Cuádriceps' },
  { id: 'hamstrings', label: 'Isquiotibiales', short: 'Isquios' },
  { id: 'glutes', label: 'Glúteos', short: 'Glúteos' },
  { id: 'calves', label: 'Gemelos', short: 'Gemelos' },
  { id: 'adductors', label: 'Aductores y abductores', short: 'Aductores' },
  { id: 'full_body', label: 'Cuerpo completo', short: 'Full body' },
  { id: 'cardio', label: 'Cardio', short: 'Cardio' },
  { id: 'mobility', label: 'Movilidad', short: 'Movilidad' },
  { id: 'recovery', label: 'Recuperación', short: 'Recuperación' },
];

export const muscleLabel = (id: MuscleGroup) => MUSCLE_GROUPS.find((m) => m.id === id)?.label ?? id;
export const muscleShort = (id: MuscleGroup) => MUSCLE_GROUPS.find((m) => m.id === id)?.short ?? id;

export const MEASURE_LABELS: Record<ExerciseMeasure, string> = {
  weight_reps: 'Peso y repeticiones',
  reps: 'Repeticiones',
  time: 'Tiempo',
  distance_time: 'Distancia y tiempo',
};

type Def = Omit<Exercise, 'custom'>;

const e = (
  id: string,
  name: string,
  muscle: MuscleGroup,
  equipment: string,
  measure: ExerciseMeasure,
  tip: string,
  extra: Partial<Pick<Exercise, 'secondary' | 'caution'>> = {},
): Def => ({ id, name, muscle, equipment, measure, tip, ...extra });

/**
 * Initial catalog. It is a curated starting point (not every exercise that
 * exists); users can add their own custom exercises.
 */
export const EXERCISE_CATALOG: Def[] = [
  // Pecho
  e('bench-press', 'Press banca', 'chest', 'Barra', 'weight_reps', 'Escápulas retraídas y pies firmes. Baja la barra controlada hasta el pecho.', {
    secondary: ['triceps', 'shoulders'],
    caution: 'Usa un compañero o topes de seguridad con cargas altas.',
  }),
  e('incline-db-press', 'Press inclinado con mancuernas', 'chest', 'Mancuernas', 'weight_reps', 'Banco a 30–45°. Codos ligeramente por debajo de los hombros.', {
    secondary: ['shoulders', 'triceps'],
  }),
  e('db-bench-press', 'Press plano con mancuernas', 'chest', 'Mancuernas', 'weight_reps', 'Recorrido completo sin chocar las mancuernas arriba.', {
    secondary: ['triceps'],
  }),
  e('cable-fly', 'Aperturas en polea', 'chest', 'Polea', 'weight_reps', 'Codos semiflexionados y fijos; junta las manos frente al pecho.'),
  e('pec-deck', 'Contractor de pecho', 'chest', 'Máquina', 'weight_reps', 'Ajusta el asiento para que los agarres queden a la altura del pecho.'),
  e('push-up', 'Flexiones', 'chest', 'Peso corporal', 'reps', 'Cuerpo alineado de cabeza a talones. Pecho cerca del suelo.', {
    secondary: ['triceps', 'core'],
  }),
  e('dips-chest', 'Fondos en paralelas', 'chest', 'Paralelas', 'reps', 'Inclina ligeramente el torso hacia delante para enfatizar el pecho.', {
    secondary: ['triceps'],
    caution: 'Evita bajar más allá de lo que tus hombros toleren cómodamente.',
  }),
  e('machine-chest-press', 'Press de pecho en máquina', 'chest', 'Máquina', 'weight_reps', 'Espalda apoyada y empuje sin bloquear los codos de golpe.'),

  // Espalda
  e('lat-pulldown', 'Jalón al pecho', 'back', 'Polea', 'weight_reps', 'Lleva la barra a la parte alta del pecho tirando con los codos.', {
    secondary: ['biceps'],
  }),
  e('seated-cable-row', 'Remo con cable', 'back', 'Polea', 'weight_reps', 'Torso estable; junta las escápulas al final del recorrido.', {
    secondary: ['biceps'],
  }),
  e('db-row', 'Remo con mancuerna', 'back', 'Mancuerna', 'weight_reps', 'Espalda neutra y codo pegado al cuerpo.', { secondary: ['biceps'] }),
  e('pull-up', 'Dominadas', 'back', 'Barra fija', 'reps', 'Parte de brazos extendidos y sube hasta pasar la barbilla.', {
    secondary: ['biceps'],
  }),
  e('barbell-row', 'Remo con barra', 'back', 'Barra', 'weight_reps', 'Cadera atrás y espalda neutra; tira hacia el ombligo.', {
    secondary: ['biceps', 'hamstrings'],
    caution: 'Mantén la espalda neutra; reduce la carga si pierdes la postura.',
  }),
  e('deadlift', 'Peso muerto', 'back', 'Barra', 'weight_reps', 'Barra pegada a las piernas, espalda neutra y empuje con las piernas.', {
    secondary: ['glutes', 'hamstrings'],
    caution: 'Técnicamente exigente: aprende el patrón con cargas ligeras o con supervisión.',
  }),
  e('t-bar-row', 'Remo en T', 'back', 'Barra / máquina', 'weight_reps', 'Pecho apoyado si la máquina lo permite; tira con los codos.'),
  e('straight-arm-pulldown', 'Pullover en polea', 'back', 'Polea', 'weight_reps', 'Brazos casi extendidos; lleva la barra hasta los muslos.'),
  e('back-extension', 'Hiperextensiones', 'back', 'Banco romano', 'reps', 'Movimiento controlado sin hiperextender la zona lumbar.', {
    secondary: ['glutes', 'hamstrings'],
  }),

  // Hombros
  e('overhead-press', 'Press militar', 'shoulders', 'Barra', 'weight_reps', 'Glúteos y abdomen activos; empuja la barra en línea recta.', {
    secondary: ['triceps'],
  }),
  e('db-shoulder-press', 'Press de hombro con mancuernas', 'shoulders', 'Mancuernas', 'weight_reps', 'Sentado con respaldo; no arquees la zona lumbar.', {
    secondary: ['triceps'],
  }),
  e('lateral-raise', 'Elevaciones laterales', 'shoulders', 'Mancuernas', 'weight_reps', 'Sube hasta la altura de los hombros con los codos ligeramente flexionados.'),
  e('rear-delt-fly', 'Pájaros (aperturas posteriores)', 'shoulders', 'Mancuernas', 'weight_reps', 'Torso inclinado y movimiento lento hacia los lados.'),
  e('face-pull', 'Face pull', 'shoulders', 'Polea', 'weight_reps', 'Tira de la cuerda hacia la cara separando las manos.', { secondary: ['back'] }),
  e('cable-lateral-raise', 'Elevación lateral en polea', 'shoulders', 'Polea', 'weight_reps', 'Tensión constante; evita balancear el torso.'),

  // Bíceps
  e('biceps-curl', 'Curl de bíceps', 'biceps', 'Mancuernas', 'weight_reps', 'Codos fijos junto al torso; baja de forma controlada.'),
  e('hammer-curl', 'Curl martillo', 'biceps', 'Mancuernas', 'weight_reps', 'Agarre neutro (palmas enfrentadas).', { secondary: ['forearms'] }),
  e('barbell-curl', 'Curl con barra', 'biceps', 'Barra', 'weight_reps', 'Sin balanceo; recorrido completo.'),
  e('preacher-curl', 'Curl predicador', 'biceps', 'Banco Scott', 'weight_reps', 'No bloquees bruscamente los codos abajo.'),
  e('cable-curl', 'Curl en polea', 'biceps', 'Polea', 'weight_reps', 'Tensión constante durante todo el recorrido.'),

  // Tríceps
  e('triceps-pushdown', 'Extensión de tríceps en polea', 'triceps', 'Polea', 'weight_reps', 'Codos pegados al cuerpo; extiende por completo.'),
  e('overhead-triceps', 'Extensión de tríceps por encima de la cabeza', 'triceps', 'Mancuerna / polea', 'weight_reps', 'Codos apuntando al frente; baja detrás de la cabeza.'),
  e('skull-crusher', 'Press francés', 'triceps', 'Barra Z', 'weight_reps', 'Baja la barra hacia la frente con control.', {
    caution: 'Empieza con poco peso: el codo es una articulación sensible.',
  }),
  e('close-grip-bench', 'Press banca agarre cerrado', 'triceps', 'Barra', 'weight_reps', 'Manos a la anchura de los hombros; codos cerca del cuerpo.', {
    secondary: ['chest'],
  }),
  e('bench-dips', 'Fondos en banco', 'triceps', 'Banco', 'reps', 'Espalda cerca del banco; baja hasta unos 90° de codo.'),

  // Antebrazos
  e('wrist-curl', 'Curl de muñeca', 'forearms', 'Mancuerna', 'weight_reps', 'Antebrazo apoyado; solo se mueve la muñeca.'),
  e('farmer-walk', 'Paseo del granjero', 'forearms', 'Mancuernas', 'distance_time', 'Hombros atrás y pasos cortos y firmes.', { secondary: ['core'] }),
  e('dead-hang', 'Colgarse de la barra', 'forearms', 'Barra fija', 'time', 'Hombros activos; respira con normalidad.'),

  // Core
  e('plank', 'Plancha', 'core', 'Peso corporal', 'time', 'Cuerpo en línea recta; aprieta glúteos y abdomen.'),
  e('crunch', 'Crunch', 'core', 'Peso corporal', 'reps', 'Eleva los hombros sin tirar del cuello.'),
  e('leg-raise', 'Elevaciones de piernas', 'core', 'Peso corporal', 'reps', 'Zona lumbar pegada al suelo durante el movimiento.'),
  e('dead-bug', 'Dead bug', 'core', 'Peso corporal', 'reps', 'Brazo y pierna contrarios; espalda baja apoyada.'),
  e('pallof-press', 'Pallof press', 'core', 'Polea / banda', 'reps', 'Resiste la rotación manteniendo las manos en el centro.'),
  e('side-plank', 'Plancha lateral', 'core', 'Peso corporal', 'time', 'Cadera alta y cuerpo alineado.'),
  e('cable-crunch', 'Crunch en polea', 'core', 'Polea', 'weight_reps', 'Flexiona el tronco; la cadera permanece quieta.'),
  e('ab-wheel', 'Rueda abdominal', 'core', 'Rueda', 'reps', 'Avanza solo hasta donde puedas mantener la espalda neutra.', {
    caution: 'Exigente para la zona lumbar: progresa poco a poco.',
  }),

  // Cuádriceps
  e('squat', 'Sentadilla', 'quads', 'Barra', 'weight_reps', 'Rodillas en la línea de los pies y espalda neutra.', {
    secondary: ['glutes', 'hamstrings'],
    caution: 'Usa topes de seguridad en el rack con cargas altas.',
  }),
  e('leg-press', 'Prensa', 'quads', 'Máquina', 'weight_reps', 'Zona lumbar apoyada; no bloquees las rodillas.', { secondary: ['glutes'] }),
  e('leg-extension', 'Extensión de cuádriceps', 'quads', 'Máquina', 'weight_reps', 'Movimiento controlado, sin impulso.'),
  e('lunge', 'Zancadas', 'quads', 'Mancuernas', 'weight_reps', 'Paso largo y torso erguido; rodilla trasera cerca del suelo.', {
    secondary: ['glutes'],
  }),
  e('bulgarian-split-squat', 'Sentadilla búlgara', 'quads', 'Mancuernas', 'weight_reps', 'Pie trasero en el banco; baja en vertical.', {
    secondary: ['glutes'],
  }),
  e('goblet-squat', 'Sentadilla goblet', 'quads', 'Mancuerna / kettlebell', 'weight_reps', 'Peso pegado al pecho y codos entre las rodillas.'),
  e('hack-squat', 'Sentadilla hack', 'quads', 'Máquina', 'weight_reps', 'Espalda apoyada; profundidad controlada.'),

  // Isquiotibiales
  e('leg-curl', 'Curl femoral', 'hamstrings', 'Máquina', 'weight_reps', 'Cadera pegada al banco; sube y baja controlado.'),
  e('romanian-deadlift', 'Peso muerto rumano', 'hamstrings', 'Barra / mancuernas', 'weight_reps', 'Cadera atrás con rodillas semiflexionadas; espalda neutra.', {
    secondary: ['glutes', 'back'],
  }),
  e('good-morning', 'Buenos días', 'hamstrings', 'Barra', 'weight_reps', 'Flexión de cadera con espalda neutra y carga ligera.', {
    caution: 'Empieza con poca carga y aprende bien el patrón.',
  }),
  e('nordic-curl', 'Curl nórdico', 'hamstrings', 'Peso corporal', 'reps', 'Baja lo más lento posible; ayúdate con las manos.'),

  // Glúteos
  e('hip-thrust', 'Hip thrust', 'glutes', 'Barra', 'weight_reps', 'Barbilla recogida; extiende la cadera apretando glúteos.', {
    secondary: ['hamstrings'],
  }),
  e('glute-bridge', 'Puente de glúteo', 'glutes', 'Peso corporal', 'reps', 'Talones cerca de la cadera; sube sin arquear la espalda.'),
  e('cable-kickback', 'Patada de glúteo en polea', 'glutes', 'Polea', 'weight_reps', 'Torso estable; extiende la cadera hacia atrás.'),
  e('step-up', 'Subidas al cajón', 'glutes', 'Cajón', 'reps', 'Empuja con la pierna de arriba, no con la de abajo.', { secondary: ['quads'] }),

  // Gemelos
  e('standing-calf-raise', 'Elevaciones de gemelos', 'calves', 'Máquina / peso corporal', 'weight_reps', 'Pausa arriba y estira abajo.'),
  e('seated-calf-raise', 'Gemelo sentado', 'calves', 'Máquina', 'weight_reps', 'Recorrido completo y controlado.'),

  // Aductores / abductores
  e('hip-adduction', 'Aducción de cadera', 'adductors', 'Máquina', 'weight_reps', 'Junta las piernas de forma controlada.'),
  e('hip-abduction', 'Abducción de cadera', 'adductors', 'Máquina', 'weight_reps', 'Separa las piernas sin balancear el torso.', { secondary: ['glutes'] }),
  e('copenhagen-plank', 'Plancha Copenhague', 'adductors', 'Banco', 'time', 'Pierna superior en el banco; cuerpo alineado.', {
    secondary: ['core'],
  }),

  // Cuerpo completo
  e('kettlebell-swing', 'Swing con kettlebell', 'full_body', 'Kettlebell', 'weight_reps', 'Impulso desde la cadera, no desde los brazos.', {
    secondary: ['glutes', 'hamstrings'],
  }),
  e('burpee', 'Burpees', 'full_body', 'Peso corporal', 'reps', 'Ritmo constante; aterriza suave.'),
  e('thruster', 'Thruster', 'full_body', 'Barra / mancuernas', 'weight_reps', 'Sentadilla frontal seguida de press por encima de la cabeza.'),
  e('clean-press', 'Cargada y press', 'full_body', 'Barra / kettlebell', 'weight_reps', 'Técnica antes que carga.', {
    caution: 'Movimiento técnico: aprende con supervisión.',
  }),

  // Cardio
  e('treadmill', 'Cinta', 'cardio', 'Máquina', 'distance_time', 'Empieza con un calentamiento suave de 5 minutos.'),
  e('bike', 'Bicicleta', 'cardio', 'Máquina', 'distance_time', 'Ajusta el sillín a la altura de la cadera.'),
  e('elliptical', 'Elíptica', 'cardio', 'Máquina', 'distance_time', 'Postura erguida; usa también los brazos.'),
  e('rowing', 'Remo (ergómetro)', 'cardio', 'Máquina', 'distance_time', 'Piernas, tronco y brazos, en ese orden.'),
  e('walk', 'Caminata', 'cardio', 'Exterior', 'distance_time', 'Ritmo cómodo que te permita conversar.'),
  e('run', 'Carrera', 'cardio', 'Exterior', 'distance_time', 'Aumenta el volumen semanal de forma progresiva.'),
  e('stair-climber', 'Escaladora', 'cardio', 'Máquina', 'time', 'No te apoyes en exceso en las barandillas.'),
  e('jump-rope', 'Comba', 'cardio', 'Comba', 'time', 'Saltos bajos sobre la parte delantera del pie.'),
  e('swim', 'Natación', 'cardio', 'Piscina', 'distance_time', 'Alterna estilos para repartir el esfuerzo.'),

  // Movilidad
  e('hip-mobility', 'Movilidad de cadera', 'mobility', 'Peso corporal', 'time', 'Movimientos lentos y respiración profunda.'),
  e('thoracic-rotation', 'Rotaciones torácicas', 'mobility', 'Peso corporal', 'reps', 'Gira desde la parte alta de la espalda.'),
  e('shoulder-dislocates', 'Movilidad de hombro con banda', 'mobility', 'Banda', 'reps', 'Agarre amplio; sin dolor.'),
  e('ankle-mobility', 'Movilidad de tobillo', 'mobility', 'Peso corporal', 'reps', 'Rodilla hacia delante sin levantar el talón.'),
  e('yoga-flow', 'Yoga', 'mobility', 'Esterilla', 'time', 'Escucha a tu cuerpo y no fuerces las posturas.'),

  // Recuperación
  e('stretching', 'Estiramientos', 'recovery', 'Esterilla', 'time', 'Mantén cada estiramiento 20–30 s sin rebotes.'),
  e('foam-roll', 'Rodillo de espuma', 'recovery', 'Foam roller', 'time', 'Presión moderada; evita las articulaciones.'),
  e('easy-walk', 'Paseo de recuperación', 'recovery', 'Exterior', 'distance_time', 'Intensidad muy suave para activar la circulación.'),
  e('breathing', 'Respiración y relajación', 'recovery', 'Ninguno', 'time', 'Inhala 4 s, exhala 6 s.'),
];

const byId = new Map(EXERCISE_CATALOG.map((x) => [x.id, x]));

export function findCatalogExercise(id: string): Def | undefined {
  return byId.get(id);
}

export const RECOVERY_GROUPS: MuscleGroup[] = ['mobility', 'recovery'];
