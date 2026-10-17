// Demo data for the «Cada pequeño paso cuenta» captures. Everything here is
// fictional («Alex», invented weights, sessions and habits) and is written
// straight into the app's own IndexedDB in the capture browser, never anywhere else.

const DAY = 86_400_000;

function dateKey(offset, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday-based weekday index of a day offset. */
function weekday(offset, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return (d.getDay() + 6) % 7;
}

/** Weigh-ins over eight weeks: a gentle downward trend with real-life ups and downs. */
const WEIGHTS = [
  [-56, 81.0], [-52, 80.8], [-49, 81.1], [-45, 80.6], [-42, 80.4], [-38, 80.6], [-35, 80.0],
  [-31, 79.9], [-28, 80.2], [-24, 79.7], [-21, 79.4], [-17, 79.6], [-14, 79.2], [-10, 78.9],
  [-7, 79.1], [-3, 78.8], [0, 78.6],
];

const STEPS = [7420, 9130, 6210, 8040, 10230, 5480, 7900, 8650, 6930, 9480, 7710, 11020, 8390, 6840];

let uid = 0;
const id = () => `demo-${++uid}`;

function sets(kg, reps, n, at) {
  return Array.from({ length: n }, (_, i) => ({ uid: id(), kg, reps, kind: 'normal', done: true, completedAt: at + i * 150_000 }));
}

/** Three sessions a week (Mon, Wed, Fri) for six weeks, loads rising slowly. */
function workouts(now) {
  const out = [];
  for (let off = -42; off <= -1; off++) {
    const wd = weekday(off, now);
    if (![0, 2, 4].includes(wd)) continue;
    const week = Math.floor((off + 42) / 7);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, 18, 30).getTime();
    const a = wd !== 2;
    const exercises = a
      ? [
          { uid: id(), exerciseId: 'squat', restSec: 120, sets: sets(50 + week * 2.5, 8, 3, start) },
          { uid: id(), exerciseId: 'bench-press', restSec: 120, sets: sets(40 + week * 2.5, 8, 3, start + 600_000) },
          { uid: id(), exerciseId: 'seated-cable-row', restSec: 90, sets: sets(35 + week * 2.5, 10, 3, start + 1_200_000) },
          { uid: id(), exerciseId: 'plank', restSec: 60, sets: Array.from({ length: 2 }, () => ({ uid: id(), durationSec: 40 + week * 5, kind: 'normal', done: true, completedAt: start + 1_800_000 })) },
        ]
      : [
          { uid: id(), exerciseId: 'romanian-deadlift', restSec: 120, sets: sets(45 + week * 2.5, 8, 3, start) },
          { uid: id(), exerciseId: 'db-shoulder-press', restSec: 90, sets: sets(12 + Math.floor(week / 2) * 2, 10, 3, start + 600_000) },
          { uid: id(), exerciseId: 'lat-pulldown', restSec: 90, sets: sets(40 + week * 2.5, 10, 3, start + 1_200_000) },
          { uid: id(), exerciseId: 'hip-thrust', restSec: 90, sets: sets(50 + week * 5, 10, 3, start + 1_800_000) },
        ];
    const durationSec = 52 * 60 + (week % 3) * 180;
    out.push({
      name: a ? 'Cuerpo completo A' : 'Cuerpo completo B',
      date: dateKey(off, now),
      time: '18:30',
      status: 'completed',
      templateId: a ? 1 : 2,
      muscleGroups: a ? ['quads', 'chest', 'back', 'core'] : ['hamstrings', 'shoulders', 'back', 'glutes'],
      exercises,
      startedAt: start,
      accumulatedSec: durationSec,
      endedAt: start + durationSec * 1000,
      durationSec,
      rpe: 7.5,
      createdAt: start,
      updatedAt: start + durationSec * 1000,
    });
  }
  return out;
}

export function buildDemo(nowMs) {
  const now = new Date(nowMs);
  const t = (off, h = 8, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, h, m).getTime();
  const water = [];
  for (let off = -20; off <= 0; off++) {
    // Today stops at 1 L: the capture adds the next 250 ml with the app's own «+ 250» button.
    const glasses = off === 0 ? [[8, 15, 250], [10, 40, 500], [13, 5, 250]] : [[8, 0, 500], [11, 0, 500], [14, 30, 500], [18, 0, 330], [20, 30, 250]];
    for (const [h, m, ml] of glasses) water.push({ date: dateKey(off, now), time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, ml, createdAt: t(off, h, m) });
  }
  return {
    weights: WEIGHTS.map(([off, kg]) => ({ date: dateKey(off, now), time: '08:10', kg, createdAt: t(off, 8, 10), updatedAt: t(off, 8, 10) })),
    water,
    steps: STEPS.map((steps, i) => ({ date: dateKey(i - (STEPS.length - 1), now), steps, updatedAt: t(i - (STEPS.length - 1), 21) })),
    workouts: workouts(now),
    templates: [
      {
        id: 1,
        name: 'Cuerpo completo A',
        muscleGroups: ['quads', 'chest', 'back', 'core'],
        exercises: [
          { exerciseId: 'squat', sets: 3, reps: 8, kg: 62.5, restSec: 120 },
          { exerciseId: 'bench-press', sets: 3, reps: 8, kg: 52.5, restSec: 120 },
          { exerciseId: 'seated-cable-row', sets: 3, reps: 10, kg: 47.5, restSec: 90 },
          { exerciseId: 'plank', sets: 2, durationSec: 60, restSec: 60 },
        ],
        createdAt: t(-43),
        updatedAt: t(-43),
      },
      {
        id: 2,
        name: 'Cuerpo completo B',
        muscleGroups: ['hamstrings', 'shoulders', 'back', 'glutes'],
        exercises: [
          { exerciseId: 'romanian-deadlift', sets: 3, reps: 8, kg: 57.5, restSec: 120 },
          { exerciseId: 'db-shoulder-press', sets: 3, reps: 10, kg: 16, restSec: 90 },
          { exerciseId: 'lat-pulldown', sets: 3, reps: 10, kg: 52.5, restSec: 90 },
          { exerciseId: 'hip-thrust', sets: 3, reps: 10, kg: 75, restSec: 90 },
        ],
        createdAt: t(-43),
        updatedAt: t(-43),
      },
    ],
    plan: Array.from({ length: 7 }, (_, wd) =>
      wd === 0 || wd === 4
        ? { weekday: wd, label: 'Cuerpo completo A', muscleGroups: ['quads', 'chest', 'back', 'core'], templateId: 1, rest: false }
        : wd === 2
          ? { weekday: wd, label: 'Cuerpo completo B', muscleGroups: ['hamstrings', 'shoulders', 'back', 'glutes'], templateId: 2, rest: false }
          : { weekday: wd, label: 'Descanso', muscleGroups: [], rest: true },
    ),
  };
}

/** Runs in the page: replaces the demo tables in the app's IndexedDB. */
export async function writeDemo(demo) {
  const open = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('rumbo');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const db = await open();
  const tables = ['weights', 'water', 'steps', 'workouts', 'templates', 'plan'];
  await new Promise((resolve, reject) => {
    const tx = db.transaction(tables, 'readwrite');
    for (const name of tables) {
      const store = tx.objectStore(name);
      store.clear();
      for (const row of demo[name]) store.put(row);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export { DAY };
