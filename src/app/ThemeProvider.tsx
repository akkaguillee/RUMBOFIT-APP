import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { isAccent, ThemeContext, type Accent, type Effects, type Theme, type ThemeCtx } from './theme';

const THEME_KEY = 'rumbo.theme';
const EFFECTS_KEY = 'rumbo.effects';
const ACCENT_KEY = 'rumbo.accent';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice simply won't persist */
  }
}

/** New installs start in dark mode; a stored choice always wins. */
function initialTheme(): Theme {
  const stored = read(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

function initialAccent(): Accent {
  const stored = read(ACCENT_KEY);
  return isAccent(stored) ? stored : 'rojo';
}

type Origin = { x: number; y: number };

/**
 * Runs a DOM change inside a View Transition that reveals the new look with a
 * circle growing from `origin`. Falls back to a soft cross-fade.
 */
function reveal(change: () => void, origin?: Origin) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!reduce && doc.startViewTransition && origin) {
    const { x, y } = origin;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = doc.startViewTransition(() => flushSync(change));
    vt.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 620, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => undefined);
    return;
  }
  const root = document.documentElement;
  if (!reduce) {
    root.classList.add('theme-animating');
    window.setTimeout(() => root.classList.remove('theme-animating'), 560);
  }
  change();
}

function isLowPower(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) <= 4 && (nav.deviceMemory ?? 8) <= 4;
}

function applyEffects(effects: Effects) {
  const lite = effects === 'lite' || (effects === 'auto' && isLowPower());
  document.documentElement.classList.toggle('lite', lite);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [effects, setEffectsState] = useState<Effects>(() => (read(EFFECTS_KEY) as Effects) || 'auto');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // The pre-paint script set an inline background; keep it in sync for overscroll areas.
    document.documentElement.style.background = theme === 'dark' ? '#08090d' : '#f8f5f3';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#08090d' : '#f8f5f3');
  }, [theme]);

  useEffect(() => applyEffects(effects), [effects]);

  const commit = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    write(THEME_KEY, next);
    setThemeState(next);
  }, []);

  const setTheme = useCallback((next: Theme, origin?: Origin) => reveal(() => commit(next), origin), [commit]);

  const [accent, setAccentState] = useState<Accent>(initialAccent);
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  const setAccent = useCallback((next: Accent, origin?: Origin) => {
    reveal(() => {
      document.documentElement.dataset.accent = next;
      write(ACCENT_KEY, next);
      setAccentState(next);
    }, origin);
  }, []);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      setTheme: (t) => setTheme(t),
      toggle: (origin) => setTheme(theme === 'dark' ? 'light' : 'dark', origin),
      effects,
      setEffects: (e) => {
        write(EFFECTS_KEY, e);
        setEffectsState(e);
      },
      accent,
      setAccent,
    }),
    [theme, setTheme, effects, accent, setAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

