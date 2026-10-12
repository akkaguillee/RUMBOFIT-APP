/** Technique guide for a catalog exercise: how to do it, what to avoid, effort. */
export interface ExerciseGuide {
  /** 3–5 short, ordered execution steps (Spanish, imperative). */
  steps: string[];
  /** 2–3 common mistakes to avoid. */
  mistakes: string[];
  /** Breathing cue, when useful. */
  breathing?: string;
  level: 'basic' | 'intermediate' | 'advanced';
  /** Metabolic equivalent used for energy estimates (Compendium of Physical Activities). */
  met: number;
}

/** Filled in by the exercise-content work; keyed by catalog exercise id. */
export const EXERCISE_GUIDES: Record<string, ExerciseGuide> = {};

export function guideFor(exerciseId: string): ExerciseGuide | undefined {
  return EXERCISE_GUIDES[exerciseId];
}
