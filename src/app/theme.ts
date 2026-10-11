import { createContext, useContext } from 'react';

export type Theme = 'dark' | 'light';
export type Effects = 'auto' | 'full' | 'lite';
export type Accent = 'rojo' | 'naranja' | 'volt' | 'cian' | 'violeta' | 'fucsia';

export interface AccentOption {
  id: Accent;
  name: string;
  /** Spoken colour name, so the choice never depends on seeing the swatch. */
  color: string;
  /** Swatch gradient (light → deep), mirrors the CSS ramp in tokens.css. */
  swatch: [string, string];
}

export const ACCENTS: AccentOption[] = [
  { id: 'rojo', name: 'RUMBO', color: 'rojo', swatch: ['#ff5c68', '#b81f2f'] },
  { id: 'naranja', name: 'Ignición', color: 'naranja', swatch: ['#ffa04d', '#e8480a'] },
  { id: 'volt', name: 'Volt', color: 'lima', swatch: ['#e4ff70', '#9cc70c'] },
  { id: 'cian', name: 'Glaciar', color: 'cian', swatch: ['#7deaff', '#0ea5c6'] },
  { id: 'violeta', name: 'Ultra', color: 'violeta', swatch: ['#b79bff', '#6a35e0'] },
  { id: 'fucsia', name: 'Neón', color: 'fucsia', swatch: ['#ff7aac', '#cf1262'] },
];

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
