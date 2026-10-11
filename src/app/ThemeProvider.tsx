import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { ThemeContext, type Effects, type Theme, type ThemeCtx } from './theme';

const THEME_KEY = 'rumbo.theme';
const EFFECTS_KEY = 'rumbo.effects';

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#08090d' : '#f8f5f3');
  }, [theme]);

  useEffect(() => applyEffects(effects), [effects]);

  const commit = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    write(THEME_KEY, next);
    setThemeState(next);
  }, []);

  const setTheme = useCallback(
    (next: Theme, origin?: { x: number; y: number }) => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
      if (!reduce && doc.startViewTransition && origin) {
        // Circular liquid reveal of the new theme from the toggle button.
        const { x, y } = origin;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const vt = doc.startViewTransition(() => flushSync(() => commit(next)));
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
      commit(next);
    },
    [commit],
  );

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
    }),
    [theme, setTheme, effects],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

