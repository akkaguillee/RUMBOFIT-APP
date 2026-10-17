/** RUMBO identity as the app defines it (src/styles/tokens.css, src/app/theme.ts). */
export const V = {
  bg: '#0d0c14',
  bgDeep: '#08070d',
  bgLight: '#f2f0f9',
  acc: '#8b5cf6',
  accHi: '#9f7aff',
  accLo: '#6c3be8',
  lav: '#c9b8ff',
  lavText: '#c4b5fd',
  deep: '#4c1d95',
  text: '#ffffff',
  text2: 'rgba(255,255,255,0.74)',
  ink: '#15121a',
} as const;

/** The six interface colours (Perfil › Apariencia and the top bar), main accent of each. */
export const ACCENT: Record<string, string> = {
  violeta: '#8b5cf6',
  rojo: '#e53945',
  naranja: '#ff6a1a',
  volt: '#c8f53a',
  cian: '#22d3ee',
  fucsia: '#f0287a',
};

export const GRAD = `linear-gradient(100deg, ${V.lav} 0%, ${V.accHi} 45%, ${V.accLo} 100%)`;
export const BUTTON = `linear-gradient(180deg, ${V.accHi}, ${V.accLo})`;
export const FONT = {
  sans: 'Inter, system-ui, sans-serif',
  display: 'Krophed, Inter, sans-serif',
  hand: '"Baby Girl", Inter, cursive',
};
