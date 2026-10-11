import { useMemo } from 'react';
import type { Units } from '@/domain/types';
import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  displayToMl,
  formatHeight,
  formatNumber,
  formatVolume,
  formatWeight,
  heightUnit,
  kgToDisplay,
  mlToDisplay,
  parseDecimal,
  round,
  volumeUnit,
  weightUnit,
  formatSigned,
} from '@/domain/units';

export function unitsApi(u: Units) {
  return {
    units: u,
    w: weightUnit(u),
    h: heightUnit(u),
    v: volumeUnit(u),
    weight: (kg: number, digits = 1) => formatWeight(kg, u, digits),
    weightValue: (kg: number, digits = 1) => formatNumber(kgToDisplay(kg, u), digits),
    weightDelta: (kg: number, digits = 1) => formatSigned(kgToDisplay(kg, u), digits, weightUnit(u)),
    height: (cm: number) => formatHeight(cm, u),
    volume: (ml: number) => formatVolume(ml, u),
    /** Input helpers: display string ↔ metric value. */
    weightToInput: (kg?: number) => (kg === undefined ? '' : String(round(kgToDisplay(kg, u), 1)).replace('.', ',')),
    heightToInput: (cm?: number) => (cm === undefined ? '' : String(round(cmToDisplay(cm, u), u === 'metric' ? 0 : 1)).replace('.', ',')),
    volumeToInput: (ml?: number) => (ml === undefined ? '' : String(round(mlToDisplay(ml, u), u === 'metric' ? 0 : 1)).replace('.', ',')),
    parseWeight: (s: string) => {
      const n = parseDecimal(s);
      return n === null ? null : round(displayToKg(n, u), 2);
    },
    parseHeight: (s: string) => {
      const n = parseDecimal(s);
      return n === null ? null : round(displayToCm(n, u), 1);
    },
    parseVolume: (s: string) => {
      const n = parseDecimal(s);
      return n === null ? null : Math.round(displayToMl(n, u));
    },
  };
}

export type UnitsApi = ReturnType<typeof unitsApi>;

export function useUnits(u: Units = 'metric'): UnitsApi {
  return useMemo(() => unitsApi(u), [u]);
}
