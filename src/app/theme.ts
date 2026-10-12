import { createContext, useContext } from 'react';

export type Theme = 'dark' | 'light';
export type Effects = 'auto' | 'full' | 'lite';
export type Accent = 'rojo' | 'naranja' | 'volt' | 'cian' | 'violeta' | 'fucsia';

export interface AccentOption {
  id: Accent;
  name: string;
  /** Spoken colour name, so the choice never depends on seeing the swatch. */
  color: string;
  /** Flat swatch colour (the palette's --acc in tokens.css). */
  swatch: [string, string];
}

export const ACCENTS: AccentOption[] = [
  { id: 'rojo', name: 'ROJO RUMBO', color: 'rojo', swatch: ['#e53945', '#e53945'] },
  { id: 'naranja', name: 'NARANJA BRASA', color: 'naranja', swatch: ['#ff6a1a', '#ff6a1a'] },
  { id: 'volt', name: 'LIMA VOLT', color: 'lima', swatch: ['#c6f135', '#c6f135'] },
  { id: 'cian', name: 'CIAN GLACIAR', color: 'cian', swatch: ['#22d3ee', '#22d3ee'] },
  { id: 'violeta', name: 'VIOLETA ULTRA', color: 'violeta', swatch: ['#8b5cf6', '#8b5cf6'] },
  { id: 'fucsia', name: 'FUCSIA NEÓN', color: 'fucsia', swatch: ['#f0287a', '#f0287a'] },
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
