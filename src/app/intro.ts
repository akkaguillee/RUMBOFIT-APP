export type IntroMode = 'full' | 'brief';

const INTRO_KEY = 'rumbo.intro';
const SEEN_KEY = 'rumbo.introSeen';
const SESSION_KEY = 'rumbo.introSession';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Full intro on the first visit, a brief one on later sessions, none on reloads or when disabled. */
export function introModeForThisLoad(): IntroMode | null {
  if (safe(() => localStorage.getItem(INTRO_KEY), null) === 'off') return null;
  if (safe(() => sessionStorage.getItem(SESSION_KEY), null)) return null;
  return safe(() => localStorage.getItem(SEEN_KEY), null) ? 'brief' : 'full';
}

export function markIntroSeen() {
  safe(() => {
    localStorage.setItem(SEEN_KEY, '1');
    sessionStorage.setItem(SESSION_KEY, '1');
  }, undefined);
}

export function introEnabled(): boolean {
  return safe(() => localStorage.getItem(INTRO_KEY), null) !== 'off';
}

export function setIntroEnabled(on: boolean) {
  safe(() => localStorage.setItem(INTRO_KEY, on ? 'on' : 'off'), undefined);
}
