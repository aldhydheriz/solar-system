export type QualityModeLike = 'high' | 'low';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the OS/browser asks for reduced motion. Safe in non-DOM envs (vitest node). */
export function prefersReducedMotion(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Resolve the startup graphics quality.
 * Reduced-motion users get `low` (no bloom) unless they explicitly saved `high`
 * — actually no: roadmap 4.1 says reduced-motion kills bloom, so force `low`.
 * Pure function so it's unit-testable; the DOM check lives in prefersReducedMotion().
 */
export function resolveInitialQuality(saved: QualityModeLike, reducedMotion: boolean): QualityModeLike {
  if (reducedMotion) return 'low';
  return saved;
}

/** Auto-advance tour only when motion is OK. Reduced-motion tour is manual (Prev/Next). */
export function shouldAutoAdvanceTour(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

/**
 * Roving index for arrow-key navigation inside #planet-nav.
 * Pure + tested: wraps around, clamps out-of-range starts.
 */
export function navRovingIndex(current: number, dir: 1 | -1, length: number): number {
  if (length <= 0) return 0;
  const safe = Number.isFinite(current) ? Math.min(Math.max(current, 0), length - 1) : 0;
  return (safe + dir + length) % length;
}
