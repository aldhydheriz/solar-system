import { describe, expect, it } from 'vitest';
import { SATURN_RING_DEFAULT, resolveRingConfig } from './factory';
import { PLANETS } from './planetData';

const byName = (name: string) => PLANETS.find((p) => p.name === name)!;

describe('rings (Fase 2.3)', () => {
  it('Jupiter, Saturn, Uranus and Neptune have rings; the rest do not', () => {
    for (const name of ['Jupiter', 'Saturn', 'Uranus', 'Neptune']) {
      expect(resolveRingConfig(byName(name)), name).not.toBeNull();
    }
    for (const name of ['Mercury', 'Venus', 'Earth', 'Mars']) {
      expect(resolveRingConfig(byName(name)), name).toBeNull();
    }
  });

  it('new rings are faint, Saturn stays bold', () => {
    for (const name of ['Jupiter', 'Uranus', 'Neptune']) {
      const cfg = resolveRingConfig(byName(name))!;
      expect(cfg.opacity).toBeGreaterThan(0);
      expect(cfg.opacity).toBeLessThan(0.5);
    }
    expect(resolveRingConfig(byName('Saturn'))!.opacity).toBe(1);
  });

  it('inner edge clears the planet surface so rings never cover it', () => {
    for (const p of PLANETS) {
      const cfg = resolveRingConfig(p);
      if (!cfg) continue;
      expect(cfg.inner, p.name).toBeGreaterThan(1);
      expect(cfg.outer, p.name).toBeGreaterThan(cfg.inner);
    }
  });

  it('Uranus rings stand upright following the 97.8° axial tilt', () => {
    const uranus = byName('Uranus');
    expect(uranus.axialTilt).toBeCloseTo(97.8, 1);
    const cfg = resolveRingConfig(uranus)!;
    expect(cfg.followTilt).toBe(true);
    expect(cfg.tiltXDeg).toBe(90); // equatorial, rolled upright by followTilt
  });

  it('Saturn keeps its legacy look', () => {
    const cfg = resolveRingConfig(byName('Saturn'))!;
    expect(cfg).toEqual(SATURN_RING_DEFAULT);
    expect(cfg.tiltXDeg).toBe(75); // ≈ PI/2.4 as before
    expect(cfg.followTilt).toBe(false);
  });
});
