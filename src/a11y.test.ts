import { describe, expect, it } from 'vitest';
import { navRovingIndex, resolveInitialQuality, shouldAutoAdvanceTour } from './a11y';

describe('a11y helpers (Fase 4.1)', () => {
  it('forces low quality when reduced motion is preferred', () => {
    expect(resolveInitialQuality('high', true)).toBe('low');
    expect(resolveInitialQuality('low', true)).toBe('low');
  });

  it('respects saved quality when motion is fine', () => {
    expect(resolveInitialQuality('high', false)).toBe('high');
    expect(resolveInitialQuality('low', false)).toBe('low');
  });

  it('disables tour auto-advance under reduced motion', () => {
    expect(shouldAutoAdvanceTour(true)).toBe(false);
    expect(shouldAutoAdvanceTour(false)).toBe(true);
  });

  it('roves nav focus with wrap-around', () => {
    expect(navRovingIndex(0, 1, 10)).toBe(1);
    expect(navRovingIndex(9, 1, 10)).toBe(0);
    expect(navRovingIndex(0, -1, 10)).toBe(9);
    expect(navRovingIndex(4, -1, 10)).toBe(3);
  });

  it('clamps out-of-range nav index', () => {
    expect(navRovingIndex(99, 1, 10)).toBe(0);
    expect(navRovingIndex(-5, -1, 10)).toBe(9);
    expect(navRovingIndex(0, 1, 0)).toBe(0);
  });
});
