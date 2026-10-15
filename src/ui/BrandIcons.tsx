// Minimal monochrome line glyphs for the social links, drawn on a 24 × 24 grid
// and rendered in currentColor (white on the dark tiles of «¿Quién soy?»).
import type { ReactElement } from 'react';

export type Brand = 'instagram' | 'tiktok' | 'youtube';

const glyphs: Record<Brand, ReactElement> = {
  instagram: (
    <>
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.25" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.1" cy="6.9" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  tiktok: (
    <>
      <path d="M13.6 3.5v10.9a3.6 3.6 0 1 1-3.6-3.6" />
      <path d="M13.6 3.5c.35 2.55 2.05 4.25 4.9 4.55" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.75" y="5.75" width="18.5" height="12.5" rx="4" />
      <path d="M10.4 9.35v5.3l4.5-2.65z" fill="currentColor" />
    </>
  ),
};

export function BrandIcon({ brand, size = 22 }: { brand: Brand; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyphs[brand]}
    </svg>
  );
}
