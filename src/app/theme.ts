import { createContext, useContext } from 'react';

export type Theme = 'dark' | 'light';
export type Effects = 'auto' | 'full' | 'lite';
export type Accent = 'rojo' | 'naranja' | 'volt' | 'cian' | 'violeta' | 'fucsia';

export interface AccentOption {
  id: Accent;
  name: string;
  /** Spoken colour name, so the choice never depends on seeing the swatch. */
  color: string;
  /** Swatch gradient (the palette's --acc-hi → --acc-lo in tokens.css). */
  swatch: [string, string];
}

/** RUMBO's own violet first; the rest are alternatives the user can pick. */
export const ACCENTS: AccentOption[] = [
  { id: 'violeta', name: 'VIOLETA RUMBO', color: 'violeta', swatch: ['#9f7aff', '#6c3be8'] },
  { id: 'rojo', name: 'ROJO INTENSO', color: 'rojo', swatch: ['#f04a56', '#c92a37'] },
  { id: 'naranja', name: 'NARANJA BRASA', color: 'naranja', swatch: ['#ff8a3d', '#f2520a'] },
  { id: 'volt', name: 'LIMA VOLT', color: 'lima', swatch: ['#d6ff5c', '#b6e420'] },
  { id: 'cian', name: 'CIAN GLACIAR', color: 'cian', swatch: ['#5ce3fb', '#0fb8d6'] },
  { id: 'fucsia', name: 'FUCSIA NEÓN', color: 'fucsia', swatch: ['#ff4b90', '#d81566'] },
];

export const DEFAULT_ACCENT: Accent = 'violeta';

export const isAccent = (v: unknown): v is Accent => ACCENTS.some((a) => a.id === v);

export interface ThemeCtx {
  theme: Theme;
  toggle: (origin?: { x: number; y: number }) => void;
  setTheme: (t: Theme) => void;
  effects: Effects;
  setEffects: (e: Effects) => void;
  accent: Accent;
  setAccent: (a: Accent, origin?: { x: number; y: number }) => void;
}

export const ThemeContext = createContext<ThemeCtx | null>(null);

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
