import { describe, expect, it } from 'vitest';
import { TOUR_STEP_MS, tourOrder, tourStartIndex, tourStep, tourStopAt, tourTextFor } from './tour';

describe('narrated tour', () => {
  it('visits all 9 planets Mercury … Pluto without error', () => {
    const order = tourOrder();
    expect(order).toHaveLength(9);
    expect(order[0]).toBe('Mercury');
    expect(order[order.length - 1]).toBe('Pluto');
    // every stop resolves to a caption + speech text
    for (let i = 0; i < order.length; i++) {
      const stop = tourStopAt(i);
      expect(stop).not.toBeNull();
      expect(stop!.name).toBe(order[i]);
      expect(stop!.position).toBe(i + 1);
      expect(stop!.progress).toBe(`${i + 1} / 9`);
      expect(stop!.text.length).toBeGreaterThan(10);
    }
  });

  it('starts from current selection, else Mercury', () => {
    expect(tourStartIndex(null)).toBe(0);
    expect(tourStartIndex('Earth')).toBe(2);
    expect(tourStartIndex('Pluto')).toBe(8);
    expect(tourStartIndex('Vulcan')).toBe(0);
  });

  it('wraps around at both ends', () => {
    expect(tourStep(8, 1)!.name).toBe('Mercury');
    expect(tourStep(0, -1)!.name).toBe('Pluto');
    expect(tourStep(2, 1)!.name).toBe('Mars');
  });

  it('caption text names the planet with its stats', () => {
    const text = tourTextFor('Jupiter')!;
    expect(text).toContain('Jupiter');
    expect(text).toContain('778.5M km');
    expect(tourTextFor('Vulcan')).toBeNull();
  });

  it('step interval is long enough to read + hear', () => {
    expect(TOUR_STEP_MS).toBeGreaterThanOrEqual(5000);
  });
});
