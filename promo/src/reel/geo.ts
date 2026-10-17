import type { Layout } from './layout';

/** Where things sit in the opening and the closing, per format. */
export function hookGeo(L: Layout) {
  if (L.format === '4x5') {
    return {
      logoY: 132,
      titleY: 214,
      titleSize: 78,
      rumbiBig: { x: 540, y: 660, s: 470 },
      rumbiRest: { x: 540, y: 640, s: 230 },
      dot: { x: 250, y: 930 },
      // The person's path: from the dot, across the frame and out on the right.
      path: 'M 250 930 C 420 900 470 1010 640 990 C 800 972 860 900 1160 930',
    };
  }
  return {
    logoY: 306,
    titleY: 404,
    titleSize: 96,
    rumbiBig: { x: 540, y: 900, s: 600 },
    rumbiRest: { x: 540, y: 868, s: 300 },
    dot: { x: 250, y: 1218 },
    path: 'M 250 1218 C 430 1180 480 1302 650 1282 C 810 1262 870 1170 1170 1210',
  };
}

export function finaleGeo(L: Layout) {
  if (L.format === '4x5') {
    return { runner: { x: 540, y: 330, w: 300 }, word: { x: 540, y: 560, w: 520 }, slogan: 680, cta: 830, rumbi: { x: 740, y: 474, s: 120 } };
  }
  return { runner: { x: 540, y: 600, w: 340 }, word: { x: 540, y: 860, w: 580 }, slogan: 1000, cta: 1150, rumbi: { x: 776, y: 768, s: 130 } };
}
