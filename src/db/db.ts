import Dexie, { type EntityTable } from 'dexie';
import type { GoalSnapshot } from '@/domain/achievements/metrics';
import type {
  AchievementUnlock,
  BmiRecord,
  CustomExercise,
  DayNote,
  EnergyRecord,
  GoalRecord,
  PlanDay,
  Profile,
  Setting,
  StepsEntry,
  WaterEntry,
  WeightEntry,
  Workout,
  WorkoutTemplate,
} from '@/domain/types';

export type StoredCustomExercise = CustomExercise & { archived?: boolean };

/**
 * Local-first storage in IndexedDB. Data never leaves the device.
 * The schema is versioned so it can evolve (or be mirrored to a backend
 * with per-user access policies) without losing existing records.
 */
export class RumboDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  goals!: EntityTable<GoalRecord, 'id'>;
  weights!: EntityTable<WeightEntry, 'id'>;
  water!: EntityTable<WaterEntry, 'id'>;
  steps!: EntityTable<StepsEntry, 'id'>;
  notes!: EntityTable<DayNote, 'date'>;
  bmi!: EntityTable<BmiRecord, 'id'>;
  energy!: EntityTable<EnergyRecord, 'id'>;
  exercises!: EntityTable<StoredCustomExercise, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  templates!: EntityTable<WorkoutTemplate, 'id'>;
  plan!: EntityTable<PlanDay, 'weekday'>;
  achievements!: EntityTable<AchievementUnlock, 'id'>;
  snapshots!: EntityTable<GoalSnapshot, 'date'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'rumbo') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      goals: '++id, startDate',
      weights: '++id, date',
      water: '++id, date',
      steps: '++id, &date',
      notes: 'date',
      bmi: '++id, date',
      energy: '++id, date',
      exercises: 'id, muscle',
      workouts: '++id, date, status, startedAt',
      templates: '++id',
      plan: 'weekday',
      achievements: 'id',
      snapshots: 'date',
      settings: 'key',
    });
  }
}

export const db = new RumboDB();

export const ALL_TABLES = [
  'profile',
  'goals',
  'weights',
  'water',
  'steps',
  'notes',
  'bmi',
  'energy',
  'exercises',
  'workouts',
  'templates',
  'plan',
  'achievements',
  'snapshots',
  'settings',
] as const;

export type TableName = (typeof ALL_TABLES)[number];
