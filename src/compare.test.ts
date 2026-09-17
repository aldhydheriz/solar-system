import { describe, expect, it } from 'vitest';
import {
  COMPARE_MAX_PX,
  COMPARE_MIN_PX,
  compareCircleSizes,
  comparePair,
  getCompareRadius,
  listCompareNames,
} from './compare';

describe('compare mode', () => {
  it('lists Sun + 9 planets', () => {
    const names = listCompareNames();
    expect(names[0]).toBe('Sun');
    expect(names).toContain('Earth');
    expect(names).toContain('Pluto');
    expect(names).toHaveLength(10);
  });

  it('Earth vs Jupiter is proportional in stylized mode', () => {
    const r = comparePair('Earth', 'Jupiter', 'stylized');
    expect(r).not.toBeNull();
    // planets.json: Earth radius 3.8, Jupiter 12
    expect(r!.aRadius).toBeCloseTo(3.8, 6);
    expect(r!.bRadius).toBeCloseTo(12, 6);
    expect(r!.ratio).toBeCloseTo(12 / 3.8, 6);
    expect(r!.biggerName).toBe('Jupiter');
  });

  it('Earth vs Jupiter is proportional in real mode', () => {
    const r = comparePair('Earth', 'Jupiter', 'real');
    expect(r).not.toBeNull();
    // planets.json: Earth realRadius 1.1, Jupiter 12.0
    expect(r!.aRadius).toBeCloseTo(1.1, 6);
    expect(r!.bRadius).toBeCloseTo(12.0, 6);
    expect(r!.ratio).toBeCloseTo(12.0 / 1.1, 6);
    expect(r!.biggerName).toBe('Jupiter');
  });

  it('same body has ratio 1 and symmetric pixels', () => {
    const r = comparePair('Mars', 'Mars', 'stylized');
    expect(r!.ratio).toBeCloseTo(1, 9);
    const px = compareCircleSizes(r!.aRadius, r!.bRadius);
    expect(px.aPx).toBeCloseTo(px.bPx, 9);
    expect(px.aPx).toBeCloseTo(COMPARE_MAX_PX, 9);
  });

  it('unknown names return null', () => {
    expect(comparePair('Earth', 'Vulcan', 'stylized')).toBeNull();
    expect(comparePair('Krypton', 'Jupiter', 'real')).toBeNull();
    expect(getCompareRadius('Vulcan', 'stylized')).toBeNull();
  });

  it('circle pixels preserve the true ratio', () => {
    const r = comparePair('Earth', 'Jupiter', 'stylized')!;
    const px = compareCircleSizes(r.aRadius, r.bRadius);
    expect(px.bPx).toBeCloseTo(COMPARE_MAX_PX, 9);
    expect(px.aPx / px.bPx).toBeCloseTo(r.aRadius / r.bRadius, 6);
    expect(px.aPx).toBeGreaterThanOrEqual(COMPARE_MIN_PX);
  });

  it('tiny vs giant clamps but keeps order', () => {
    const px = compareCircleSizes(0.01, 100);
    expect(px.bPx).toBe(COMPARE_MAX_PX);
    expect(px.aPx).toBe(COMPARE_MIN_PX);
    expect(px.aPx).toBeLessThan(px.bPx);
  });

  it('Sun is bigger than Jupiter', () => {
    const r = comparePair('Sun', 'Jupiter', 'stylized')!;
    expect(r.biggerName).toBe('Sun');
    expect(r.ratio).toBeCloseTo(20 / 12, 6);
  });
});
