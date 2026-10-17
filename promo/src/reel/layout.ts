import { createContext, useContext } from 'react';

/**
 * Layout tokens. The 9:16 master keeps every text inside the area Reels and
 * TikTok leave free (roughly y 220–1436 and x 90–940 of 1080 × 1920); the 4:5
 * cut re-frames the same scenes for the feed.
 */
export interface Layout {
  format: '9x16' | '4x5';
  W: number;
  H: number;
  /** Top of the headline block. */
  titleY: number;
  /** Bottom edge of the subtitle box. */
  subBottom: number;
  /** Width of the text column. */
  textW: number;
  phone: { x: number; y: number; w: number };
  /** Scale for type and mascot. */
  k: number;
}

export const L916: Layout = { format: '9x16', W: 1080, H: 1920, titleY: 236, subBottom: 1424, textW: 840, phone: { x: 540, y: 1004, w: 520 }, k: 1 };
export const L45: Layout = { format: '4x5', W: 1080, H: 1350, titleY: 72, subBottom: 1292, textW: 900, phone: { x: 540, y: 716, w: 404 }, k: 0.86 };

export const LayoutCtx = createContext<Layout>(L916);
export const useLayout = () => useContext(LayoutCtx);
