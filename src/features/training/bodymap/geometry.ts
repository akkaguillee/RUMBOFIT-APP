import type { BodyView, MuscleId } from '@/domain/training/anatomy';
import type { BodyFigure } from '@/domain/types';

/*
 * Body map drawing. One set of shapes describes the anatomy; the female and
 * neutral figures are the same shapes reshaped by proportion (narrower
 * shoulders and waist, wider hips, slimmer arms) plus a female chest, so
 * regions, ids and behaviour never diverge between figures.
 *
 * Points are [d, y] on the viewer's left half: `d` is the distance from the
 * body's midline and `y` the height, in a 200 × 440 box. Every shape is
 * mirrored to the other side. A third value of 1 marks a sharp corner.
 */

type Pt = readonly [number, number] | readonly [number, number, 1];
type Part = 'head' | 'torso' | 'arm' | 'leg';

interface Shape {
  part: Part;
  pts: readonly Pt[];
}

interface Line {
  part: Part;
  pts: readonly Pt[];
}

interface RegionDef {
  id: MuscleId;
  shapes: readonly Shape[];
  details?: readonly Line[];
}

export const VIEWBOX = { w: 200, h: 440 } as const;
const CX = VIEWBOX.w / 2;

// ── Silhouette ─────────────────────────────────────────────────────────

const HEAD: readonly Pt[] = [
  [0, 10],
  [9.5, 11.6],
  [15.5, 16.5],
  [18.6, 24.5],
  [19.4, 33.5],
  [18.8, 42],
  [16.8, 50],
  [13.6, 56.2],
];

const NECK: readonly Pt[] = [
  [12.4, 60],
  [12.6, 66.5],
  [14.6, 71.5],
  [21.5, 76],
  [31.5, 79.4],
  [40, 82],
];

const ARM_OUTLINE: readonly Pt[] = [
  [46, 82.4],
  [52.4, 84.6],
  [58, 89.6],
  [61.6, 97.4],
  [63.2, 106.4],
  [63.6, 115.6],
  [63.6, 124],
  [64.8, 132],
  [66.4, 141],
  [67.4, 150],
  [67.9, 158],
  [68.6, 165],
  [71.2, 174],
  [73.8, 185],
  [75.6, 197],
  [76.6, 208],
  [77, 216],
  [78, 221.4],
  [79.8, 229],
  [80.8, 237.4],
  [80.6, 246],
  [79, 253.6],
  [76.2, 259],
  [72.8, 260.4],
  [70.6, 256.6],
  [70, 249],
  [69.4, 241],
  [68.2, 233],
  [66.6, 226],
  [65.4, 220.4],
  [64.8, 216],
  [63, 207],
  [60.4, 196],
  [57.2, 185],
  [54.6, 175],
  [53.2, 168],
  [51.6, 161],
  [48.6, 152],
  [46.4, 141],
  [44.2, 132],
  [42.6, 124],
];

const TORSO_SIDE: readonly Pt[] = [
  [41.2, 117.5, 1],
  [40.6, 126],
  [39.6, 136],
  [37.4, 148],
  [35, 160],
  [33.8, 170],
  [34.2, 180],
  [36.2, 191],
  [39.4, 202],
  [42.4, 212],
];

const LEG_OUTLINE: readonly Pt[] = [
  [43.4, 222],
  [43.4, 236],
  [42.4, 252],
  [40.6, 268],
  [38, 284],
  [35, 297],
  [33.4, 306],
  [33, 316],
  [34.8, 328],
  [35.6, 340],
  [34.2, 354],
  [31, 368],
  [27.6, 381],
  [25.6, 392],
  [25.6, 400],
  [28.4, 409],
  [30.8, 418],
  [31.2, 425],
  [28.4, 430.4],
  [22, 431.6],
  [15.6, 430.6],
  [12, 427],
  [11, 419],
  [11.2, 409],
  [11.6, 400],
  [11.6, 392],
  [10.6, 380],
  [9, 366],
  [8, 352],
  [8.6, 338],
  [10.2, 326],
  [10.6, 316],
  [9.8, 304],
  [8.4, 290],
  [6.6, 274],
  [4.6, 258],
  [2.8, 243],
  [1.3, 232],
  [0, 228, 1],
];

const SILHOUETTE: readonly { part: Part; pts: readonly Pt[] }[] = [
  { part: 'head', pts: HEAD },
  { part: 'torso', pts: NECK },
  { part: 'arm', pts: ARM_OUTLINE },
  { part: 'torso', pts: TORSO_SIDE },
  { part: 'leg', pts: LEG_OUTLINE },
];

// ── Shared regions ─────────────────────────────────────────────────────

const SIDE_DELT: Shape = {
  part: 'arm',
  pts: [
    [49, 83.6, 1],
    [54.8, 85.6],
    [59, 90],
    [61.8, 97.4],
    [63, 106],
    [63.1, 114.8],
    [62.6, 122.4],
    [59.6, 129.6, 1],
    [58.2, 121.6],
    [57.8, 112.8],
    [56.8, 103.8],
    [54.8, 95.4],
    [52, 89],
  ],
};

const FOREARM: Shape = {
  part: 'arm',
  pts: [
    [56, 170.2],
    [60.4, 167.4],
    [65.6, 167.2],
    [69.6, 171.4],
    [72, 180],
    [73.9, 191],
    [75.2, 201.6],
    [75.6, 210.4, 1],
    [71.2, 211.6],
    [66.6, 211],
    [63.6, 205.6],
    [60.4, 196.4],
    [57.6, 186.2],
    [55.6, 177],
  ],
};

const FOREARM_LINE: Line = {
  part: 'arm',
  pts: [
    [64.6, 168.6],
    [67.4, 180],
    [70, 193],
    [71.6, 205],
  ],
};

// ── Front ──────────────────────────────────────────────────────────────

const CHEST: Shape = {
  part: 'torso',
  pts: [
    [2.4, 85.6, 1],
    [9, 84.6],
    [18, 84.6],
    [27, 85.2],
    [34.4, 86.4],
    [38.6, 88.4, 1],
    [40.4, 93.6],
    [42.6, 100.6],
    [45.6, 108.6],
    [47.8, 114, 1],
    [43, 115.6],
    [36.8, 119],
    [30.4, 123.2],
    [23.4, 126],
    [16, 127.2],
    [9.6, 126.8],
    [4.8, 124.8],
    [2, 121.2, 1],
    [1.6, 110],
    [1.8, 97],
  ],
};

/** Pectorals under the breast: the same muscle with the chest contour of a female body. */
const CHEST_FEMALE: Shape = {
  part: 'torso',
  pts: [
    [2.6, 86.4, 1],
    [9, 85.6],
    [18, 85.8],
    [27, 86.6],
    [34.4, 88],
    [38.8, 90.4, 1],
    [41.6, 96.6],
    [44, 104.6],
    [45.2, 111.4, 1],
    [42.4, 117.8],
    [37.8, 124.2],
    [31.6, 129.2],
    [24.4, 131.6],
    [17, 131.4],
    [10.6, 129],
    [5.8, 125.2],
    [2.6, 120, 1],
    [1.9, 108],
    [2.1, 96],
  ],
};

const abs = (top: number): Shape => ({
  part: 'torso',
  pts: [
    [1.3, top, 1],
    [8.8, top - 0.8],
    [15.4, top + 0.6],
    [17, 138.4],
    [17, 150.6],
    [16.4, 163.4],
    [15.4, 176.4],
    [13.8, 188.4],
    [11, 199.4],
    [7.6, 208.4],
    [4.2, 215],
    [1.3, 217, 1],
  ],
});

const ABS_LINES: readonly Line[] = [
  {
    part: 'torso',
    pts: [
      [1.3, 144],
      [8, 142.6],
      [16.4, 143.6],
    ],
  },
  {
    part: 'torso',
    pts: [
      [1.3, 158.6],
      [8, 157.4],
      [16.2, 158.4],
    ],
  },
  {
    part: 'torso',
    pts: [
      [1.3, 174],
      [8, 173],
      [15.2, 174],
    ],
  },
];

const FRONT: readonly RegionDef[] = [
  {
    id: 'traps',
    shapes: [
      {
        part: 'torso',
        pts: [
          [13, 66.4],
          [15.4, 71.2],
          [22, 75.5],
          [31.6, 78.6],
          [39.2, 81.3, 1],
          [30.4, 81.8],
          [21.4, 80.2],
          [16, 77],
          [13.8, 72.6],
        ],
      },
    ],
  },
  {
    id: 'front-delts',
    shapes: [
      {
        part: 'arm',
        pts: [
          [39.6, 85.4, 1],
          [44, 83.8],
          [47.8, 84.6],
          [51.2, 88.8],
          [53.6, 95.6],
          [55.4, 104],
          [56.4, 113],
          [56.8, 121.6],
          [57.6, 128.8, 1],
          [54.6, 124.4],
          [50.4, 117.4],
          [47, 109.4],
          [43.8, 100.6],
          [41.2, 92.6],
        ],
      },
    ],
  },
  { id: 'side-delts', shapes: [SIDE_DELT] },
  { id: 'chest', shapes: [CHEST] },
  {
    id: 'biceps',
    shapes: [
      {
        part: 'arm',
        pts: [
          [51.2, 131.6],
          [54, 128.4],
          [57.2, 130.4],
          [60.6, 132.8],
          [63.6, 140],
          [65, 148.4],
          [65.4, 156],
          [64.4, 162],
          [61.4, 166, 1],
          [58.4, 163.6],
          [56, 157],
          [53.6, 149],
          [52.2, 141],
          [51.6, 135.4],
        ],
      },
    ],
  },
  {
    id: 'triceps',
    shapes: [
      {
        part: 'arm',
        pts: [
          [43.8, 126.2, 1],
          [47.4, 128.4],
          [48.6, 134.4],
          [50.2, 142.4],
          [52.2, 151.4],
          [54.6, 159.6, 1],
          [52.6, 158],
          [50.2, 150.6],
          [48, 141.6],
          [45.8, 132.8],
        ],
      },
    ],
  },
  {
    id: 'lats',
    shapes: [
      {
        part: 'torso',
        pts: [
          [40.6, 121.4, 1],
          [40.2, 128],
          [39.2, 136],
          [37.9, 144.4, 1],
          [36.8, 139],
          [37, 131],
          [38.4, 125],
        ],
      },
    ],
  },
  { id: 'forearms', shapes: [FOREARM], details: [FOREARM_LINE] },
  { id: 'abs', shapes: [abs(129.6)], details: ABS_LINES },
  {
    id: 'obliques',
    shapes: [
      {
        part: 'torso',
        pts: [
          [18.4, 139.6],
          [23, 135.4],
          [29, 133.2],
          [34.6, 134.4, 1],
          [35.8, 140.6],
          [35.4, 149.6],
          [34.4, 158.4],
          [33.4, 167],
          [32.9, 175],
          [33.5, 184],
          [35, 191, 1],
          [29.6, 193.8],
          [23.2, 197.8],
          [15.4, 201.2, 1],
          [16.6, 189],
          [17.8, 176],
          [18.2, 163],
          [18.2, 151],
        ],
      },
    ],
  },
  {
    id: 'adductors',
    shapes: [
      {
        part: 'leg',
        pts: [
          [2.6, 229.6],
          [9.4, 222.8],
          [18.6, 220.4],
          [26.4, 221.4, 1],
          [23.6, 236.6],
          [20, 251],
          [16.2, 264.6],
          [13.2, 277],
          [11.6, 286.4, 1],
          [9.2, 277.4],
          [6.8, 264],
          [4.8, 250.6],
          [3.2, 239],
        ],
      },
    ],
  },
  {
    id: 'quads',
    shapes: [
      {
        part: 'leg',
        pts: [
          [33.6, 201],
          [38, 206.6],
          [41.2, 215],
          [42.4, 226],
          [42.4, 238],
          [41.4, 252],
          [39.6, 268],
          [37, 284],
          [33.6, 296.6],
          [30.4, 301.6],
          [25.6, 303.6],
          [20.4, 303.6],
          [15.6, 302.4],
          [12.6, 298.6],
          [11.8, 291],
          [13.2, 283],
          [16.2, 271.6],
          [20, 258.6],
          [23.8, 244],
          [27.4, 229],
          [30.6, 214.6],
        ],
      },
    ],
    details: [
      {
        part: 'leg',
        pts: [
          [35.4, 214],
          [34, 244],
          [31.6, 272],
          [28.4, 298],
        ],
      },
      {
        part: 'leg',
        pts: [
          [23.6, 262],
          [22.4, 280],
          [20.4, 300],
        ],
      },
    ],
  },
  {
    id: 'calves',
    shapes: [
      {
        part: 'leg',
        pts: [
          [10.6, 330.4],
          [13, 328.4],
          [15.2, 335.6],
          [15.8, 348],
          [15.2, 361],
          [13.8, 374],
          [12.6, 382, 1],
          [11, 372],
          [9.6, 358],
          [9.4, 344],
        ],
      },
      {
        part: 'leg',
        pts: [
          [30.8, 327.4],
          [34, 334.4],
          [34.4, 346],
          [32.4, 358],
          [29.4, 369.6, 1],
          [28.6, 360],
          [29.2, 348],
          [29.8, 337],
        ],
      },
    ],
  },
];

/** Muscles outside the map's groups (serratus, tibialis…), drawn for anatomy only. */
const FRONT_INERT: readonly Shape[] = [
  {
    part: 'leg',
    pts: [
      [17.4, 326],
      [23.2, 323.6],
      [27.2, 330],
      [27.6, 344],
      [26, 360],
      [23.6, 376],
      [20.8, 389],
      [18.6, 388],
      [17.8, 374],
      [17, 356],
      [16.6, 340],
    ],
  },
  {
    part: 'leg',
    pts: [
      [21.6, 304.6],
      [26.6, 307.2],
      [27.8, 312.6],
      [25.6, 318.4],
      [21.6, 320],
      [17.6, 318.4],
      [15.4, 312.6],
      [16.6, 307.2],
    ],
  },
];

const FRONT_LINES: readonly Line[] = [
  {
    part: 'head',
    pts: [
      [13.6, 56.2],
      [9, 60.4],
      [3.6, 62.6],
      [0, 63],
    ],
  },
];

// ── Back ───────────────────────────────────────────────────────────────

const BACK: readonly RegionDef[] = [
  {
    id: 'traps',
    shapes: [
      {
        part: 'torso',
        pts: [
          [1, 53.6, 1],
          [6.2, 55.2],
          [10.8, 61.6],
          [14.2, 69.6],
          [22, 74.6],
          [32, 78.4],
          [40.4, 81.8, 1],
          [34.4, 86.6],
          [27, 92.4],
          [20.4, 98.6, 1],
          [16, 110],
          [11.4, 123],
          [6.6, 136.4],
          [1, 151, 1],
        ],
      },
    ],
  },
  { id: 'side-delts', shapes: [SIDE_DELT] },
  {
    id: 'rear-delts',
    shapes: [
      {
        part: 'arm',
        pts: [
          [40.4, 85.6, 1],
          [44.6, 84],
          [47.8, 84.6],
          [51.2, 88.8],
          [53.6, 95.6],
          [55.4, 104],
          [56.4, 113],
          [56.8, 121.6],
          [57.6, 128.8, 1],
          [54, 124],
          [49.4, 116.6],
          [45.6, 108.4],
          [42.8, 99.6],
          [41.2, 92],
        ],
      },
    ],
  },
  {
    id: 'triceps',
    shapes: [
      {
        part: 'arm',
        pts: [
          [45.2, 126.4],
          [49.6, 124],
          [53.6, 126.4],
          [57, 129.6],
          [60, 131.6],
          [62.4, 137],
          [63.8, 145],
          [64.2, 153],
          [63, 159.6],
          [59.6, 163.4, 1],
          [56.4, 162.2],
          [53.2, 156.4],
          [50.2, 148],
          [47.6, 139],
          [45.8, 131.6],
        ],
      },
    ],
    details: [
      {
        part: 'arm',
        pts: [
          [55.6, 129],
          [57, 140],
          [58, 151],
          [58.8, 160],
        ],
      },
    ],
  },
  {
    id: 'lats',
    shapes: [
      {
        part: 'torso',
        pts: [
          [41.2, 116.6, 1],
          [36.6, 120.4],
          [30.4, 123.6],
          [24, 126.4],
          [18.6, 128.6],
          [13.4, 133.4],
          [9, 142],
          [6.4, 150],
          [6.2, 156, 1],
          [10.6, 165.4],
          [16.8, 173.4],
          [23.6, 180],
          [30.4, 183.6],
          [33.2, 178.6, 1],
          [33, 170],
          [34.2, 160],
          [36.6, 148],
          [38.8, 136],
          [39.4, 128.6],
        ],
      },
    ],
  },
  { id: 'forearms', shapes: [FOREARM], details: [FOREARM_LINE] },
  {
    id: 'lower-back',
    shapes: [
      {
        part: 'torso',
        pts: [
          [1.2, 156, 1],
          [4.2, 160.6],
          [8.4, 168.6],
          [13.4, 176.4],
          [17.4, 184],
          [18.4, 192.6],
          [15.8, 199.2],
          [9.6, 203.4],
          [1.2, 204.2, 1],
        ],
      },
    ],
  },
  {
    id: 'obliques',
    shapes: [
      {
        part: 'torso',
        pts: [
          [34, 185, 1],
          [35.2, 190.6],
          [36.6, 197.2, 1],
          [30.6, 197.4],
          [24.4, 194.6],
          [22.6, 190.6],
          [28.2, 187.6],
        ],
      },
    ],
  },
  {
    id: 'glutes',
    shapes: [
      {
        part: 'torso',
        pts: [
          [1.4, 210, 1],
          [6.6, 205.6],
          [13.6, 202.4],
          [21.6, 200.6],
          [29.4, 201.4],
          [35.6, 204.6],
          [40, 210.6],
          [42, 219],
          [41.8, 229],
          [39.6, 237.6],
          [35, 243.6],
          [27.4, 247.2],
          [18, 248],
          [9.2, 246.6],
          [3.6, 243.2],
          [1.6, 236],
          [1.4, 224],
        ],
      },
    ],
    details: [
      {
        part: 'torso',
        pts: [
          [20.4, 204.6],
          [29, 207],
          [36.6, 212.6],
          [40.6, 219],
        ],
      },
    ],
  },
  {
    id: 'adductors',
    shapes: [
      {
        part: 'leg',
        pts: [
          [5.2, 251.6, 1],
          [10, 252.6],
          [10.2, 262],
          [9.8, 273],
          [9.6, 284.6, 1],
          [7.8, 279],
          [6.4, 267.6],
          [5.4, 258],
        ],
      },
    ],
  },
  {
    id: 'hamstrings',
    shapes: [
      {
        part: 'leg',
        pts: [
          [12.6, 252.6],
          [21, 251.4],
          [30, 250],
          [38.6, 248, 1],
          [40, 259],
          [38.8, 273],
          [36, 287],
          [32.4, 299],
          [29, 307.6, 1],
          [25.4, 302.6],
          [21.2, 297.6],
          [17.2, 302.6],
          [13.8, 307.6, 1],
          [11.8, 298],
          [11.4, 284],
          [11.8, 268],
        ],
      },
    ],
    details: [
      {
        part: 'leg',
        pts: [
          [23.2, 254],
          [23.6, 272],
          [22.4, 288],
          [21.2, 297.6],
        ],
      },
    ],
  },
  {
    id: 'calves',
    shapes: [
      {
        part: 'leg',
        pts: [
          [11, 318.6],
          [15.4, 315],
          [20.2, 317.4, 1],
          [25.2, 315],
          [30, 317.4],
          [33, 326.6],
          [33.6, 339],
          [32, 352],
          [28.8, 364],
          [25.2, 374.6],
          [22, 383.6, 1],
          [19.2, 378],
          [16.2, 369],
          [12.6, 356],
          [10.4, 343],
          [10.2, 330],
        ],
      },
    ],
    details: [
      {
        part: 'leg',
        pts: [
          [20.2, 318],
          [20.6, 336],
          [20.4, 352],
          [19.4, 366],
        ],
      },
    ],
  },
];

const BACK_INERT: readonly Shape[] = [
  {
    part: 'torso',
    pts: [
      [20.6, 102.4],
      [27.6, 96],
      [35, 90.6],
      [40.6, 89.4],
      [41.4, 97],
      [41.2, 106],
      [39.8, 114],
      [35, 118.4],
      [28.4, 121.4],
      [22.4, 124],
      [18.4, 120.6],
      [18.6, 111],
    ],
  },
];

// ── Proportions ────────────────────────────────────────────────────────

/** Width of the female torso and legs relative to the base figure, by height. */
const FEMALE_WIDTH: readonly (readonly [number, number])[] = [
  [0, 0.95],
  [56, 0.95],
  [64, 0.9],
  [76, 0.9],
  [84, 0.88],
  [110, 0.9],
  [150, 0.9],
  [172, 0.865],
  [190, 0.95],
  [206, 1.04],
  [228, 1.06],
  [262, 1.03],
  [300, 0.96],
  [340, 0.93],
  [400, 0.92],
  [440, 0.92],
];

/** The arm's axis (shoulder, elbow, wrist, fingertips) and how far it moves in on a female figure. */
const ARM_AXIS: readonly (readonly [number, number])[] = [
  [92, 50],
  [165, 59.8],
  [216, 70.8],
  [260, 76.5],
];
const ARM_SHIFT: readonly (readonly [number, number])[] = [
  [80, 5.5],
  [165, 3.8],
  [216, 2.2],
  [260, 2],
];
const ARM_SLIM = 0.87;

function lerpTable(table: readonly (readonly [number, number])[], y: number): number {
  if (y <= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i]!;
    const [y0, v0] = table[i - 1]!;
    if (y <= y1) {
      const t = (y - y0) / (y1 - y0);
      const s = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * s;
    }
  }
  return table[table.length - 1]![1];
}

/** Linear (not eased) so the arm axis stays straight between joints. */
function axisAt(y: number): number {
  const t = ARM_AXIS;
  if (y <= t[0]![0]) {
    const [y0, d0] = t[0]!;
    const [y1, d1] = t[1]!;
    return d0 + ((y - y0) * (d1 - d0)) / (y1 - y0);
  }
  for (let i = 1; i < t.length; i++) {
    const [y1, d1] = t[i]!;
    const [y0, d0] = t[i - 1]!;
    if (y <= y1) return d0 + ((y - y0) * (d1 - d0)) / (y1 - y0);
  }
  return t[t.length - 1]![1];
}

type Warp = (p: Pt, part: Part) => Pt;

function warpFor(figure: BodyFigure): Warp {
  const k = figure === 'female' ? 1 : figure === 'neutral' ? 0.5 : 0;
  if (k === 0) return (p) => p;
  return (p, part) => {
    const [d, y] = p;
    let nd = d;
    let ny = y;
    if (part === 'head') {
      nd = d * (1 - 0.05 * k);
      ny = 36 + (y - 36) * (1 - 0.03 * k);
    } else if (part === 'arm') {
      const axis = axisAt(y);
      const slim = 1 - (1 - ARM_SLIM) * k;
      nd = axis - lerpTable(ARM_SHIFT, y) * k + (d - axis) * slim;
    } else {
      nd = d * (1 + (lerpTable(FEMALE_WIDTH, y) - 1) * k);
    }
    return p.length === 3 ? [nd, ny, 1] : [nd, ny];
  };
}

// ── Paths ──────────────────────────────────────────────────────────────

const f = (n: number) => (Math.round(n * 10) / 10).toString();

type XY = readonly [number, number, boolean];

/** Smooth closed curve through the points (Catmull-Rom as cubic Béziers), sharp at corners. */
function closedPath(pts: readonly XY[]): string {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n]!;
  let d = `M${f(at(0)[0])} ${f(at(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = p1[2] ? [p1[0] + (p2[0] - p1[0]) / 3, p1[1] + (p2[1] - p1[1]) / 3] : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = p2[2] ? [p2[0] - (p2[0] - p1[0]) / 3, p2[1] - (p2[1] - p1[1]) / 3] : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0]!)} ${f(c1[1]!)} ${f(c2[0]!)} ${f(c2[1]!)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

function openPath(pts: readonly XY[]): string {
  const n = pts.length;
  const at = (i: number) => pts[Math.min(n - 1, Math.max(0, i))]!;
  let d = `M${f(at(0)[0])} ${f(at(0)[1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0]!)} ${f(c1[1]!)} ${f(c2[0]!)} ${f(c2[1]!)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

const toXY = (p: Pt, side: 1 | -1): XY => [CX - side * p[0], p[1], p.length === 3];

function mirrored(pts: readonly Pt[], part: Part, warp: Warp, build: (xy: readonly XY[]) => string): string {
  const w = pts.map((p) => warp(p, part));
  return build(w.map((p) => toXY(p, 1))) + build(w.map((p) => toXY(p, -1)));
}

/** One outline for the whole body: the left half, then its mirror back to the top of the head. */
function silhouettePath(warp: Warp): string {
  const left = SILHOUETTE.flatMap((s) => s.pts.map((p) => warp(p, s.part)));
  const right = left.slice(1, -1).reverse();
  return closedPath([...left.map((p) => toXY(p, 1)), ...right.map((p) => toXY(p, -1))]);
}

export interface RegionPath {
  id: MuscleId;
  d: string;
  detail?: string;
}

export interface ViewGeometry {
  silhouette: string;
  inert: string;
  lines: string;
  regions: RegionPath[];
}

function buildView(figure: BodyFigure, view: BodyView): ViewGeometry {
  const warp = warpFor(figure);
  const defs = view === 'front' ? FRONT : BACK;
  const regions = defs.map((r) => {
    const shapes = r.id === 'chest' && figure === 'female' ? [CHEST_FEMALE] : r.id === 'abs' && figure === 'female' ? [abs(133.4)] : r.shapes;
    return {
      id: r.id,
      d: shapes.map((s) => mirrored(s.pts, s.part, warp, closedPath)).join(''),
      detail: r.details?.length ? r.details.map((l) => mirrored(l.pts, l.part, warp, openPath)).join('') : undefined,
    };
  });
  return {
    silhouette: silhouettePath(warp),
    inert: (view === 'front' ? FRONT_INERT : BACK_INERT).map((s) => mirrored(s.pts, s.part, warp, closedPath)).join(''),
    lines: (view === 'front' ? FRONT_LINES : []).map((l) => mirrored(l.pts, l.part, warp, openPath)).join(''),
    regions,
  };
}

const cache = new Map<string, ViewGeometry>();

export function bodyGeometry(figure: BodyFigure, view: BodyView): ViewGeometry {
  const key = `${figure}:${view}`;
  let g = cache.get(key);
  if (!g) {
    g = buildView(figure, view);
    cache.set(key, g);
  }
  return g;
}
