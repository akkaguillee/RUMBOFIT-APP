import { createContext, useContext } from 'react';

export type Theme = 'dark' | 'light';
export type Effects = 'auto' | 'full' | 'lite';

export interface ThemeCtx {
  theme: Theme;
  toggle: (origin?: { x: number; y: number }) => void;
  setTheme: (t: Theme) => void;
  effects: Effects;
  setEffects: (e: Effects) => void;
}

export const ThemeContext = createContext<ThemeCtx | null>(null);

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
