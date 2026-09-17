import { PLANETS, SUN_DATA, currentRadius } from './planetData';
import type { ScaleMode } from './planetTypes';

/** Max rendered circle diameter in px for the bigger body. */
export const COMPARE_MAX_PX = 160;
/** Min rendered circle diameter in px so tiny bodies stay visible/clickable. */
export const COMPARE_MIN_PX = 6;

export interface CompareResult {
  aName: string;
  bName: string;
  aRadius: number;
  bRadius: number;
  /** bigger radius / smaller radius, always >= 1 */
  ratio: number;
  biggerName: string;
}

/** All bodies selectable in Compare mode: Sun + 9 planets. */
export function listCompareNames(): string[] {
  return [SUN_DATA.name, ...PLANETS.map((p) => p.name)];
}

/** Scene radius for a body in the given scale mode, or null when unknown. */
export function getCompareRadius(name: string, mode: ScaleMode): number | null {
  if (name === SUN_DATA.name) return SUN_DATA.radius;
  const hit = PLANETS.find((p) => p.name.toLowerCase() === name.toLowerCase());
  return hit ? currentRadius(hit, mode) : null;
}

/** Pure ratio math for two bodies. Returns null when either name is unknown. */
export function comparePair(aName: string, bName: string, mode: ScaleMode): CompareResult | null {
  const aRadius = getCompareRadius(aName, mode);
  const bRadius = getCompareRadius(bName, mode);
  if (aRadius === null || bRadius === null || aRadius <= 0 || bRadius <= 0) return null;
  const biggerName = aRadius >= bRadius ? aName : bName;
  const ratio = Math.max(aRadius, bRadius) / Math.min(aRadius, bRadius);
  return { aName, bName, aRadius, bRadius, ratio, biggerName };
}

/**
 * Pixel diameters preserving the true radius ratio.
 * Bigger body gets COMPARE_MAX_PX, smaller is scaled linearly (clamped to MIN_PX).
 */
export function compareCircleSizes(aRadius: number, bRadius: number): { aPx: number; bPx: number } {
  const max = Math.max(aRadius, bRadius);
  if (max <= 0) return { aPx: COMPARE_MIN_PX, bPx: COMPARE_MIN_PX };
  const scale = COMPARE_MAX_PX / max;
  const clamp = (v: number): number => Math.min(COMPARE_MAX_PX, Math.max(COMPARE_MIN_PX, v));
  return { aPx: clamp(aRadius * scale), bPx: clamp(bRadius * scale) };
}
