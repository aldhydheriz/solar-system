import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KUIPER_BELT, MAIN_BELT, createBelt, createKuiperBelt } from './belt';
import { PLANETS } from './planetData';
import { orbitPosition } from './factory';

const byName = (name: string) => PLANETS.find((p) => p.name === name)!;

describe('pluto + charon (Fase 2.5)', () => {
  it('Pluto exists as the 9th world with Charon', () => {
    expect(PLANETS.length).toBe(9);
    const pluto = byName('Pluto');
    expect(pluto).toBeDefined();
    expect(pluto.moons.map((m) => m.name)).toContain('Charon');
  });

  it('Pluto uses a bundled texture like the other planets', () => {
    const pluto = byName('Pluto');
    expect(pluto.texture).toBeDefined();
    expect(pluto.texture).toContain('plutomap1k');
    // Charon stays color-only like most moons (only the Moon has a texture)
    const charon = pluto.moons.find((m) => m.name === 'Charon')!;
    expect(charon.texture).toBeUndefined();
  });

  it('Pluto sits beyond Neptune with real dwarf-planet elements', () => {
    const pluto = byName('Pluto');
    const neptune = byName('Neptune');
    expect(pluto.distance).toBeGreaterThan(neptune.distance);
    expect(pluto.realDistance).toBeGreaterThan(neptune.realDistance);
    expect(pluto.eccentricity).toBeCloseTo(0.244, 3);
    expect(pluto.inclination).toBeCloseTo(17.16, 2);
    expect(pluto.stats.period).toMatch(/248/);
  });

  it('Pluto is smaller than Mercury and visible in both scale modes', () => {
    const pluto = byName('Pluto');
    const mercury = byName('Mercury');
    expect(pluto.radius).toBeLessThan(mercury.radius);
    expect(pluto.realRadius).toBeLessThanOrEqual(mercury.realRadius);
    expect(pluto.radius).toBeGreaterThan(0);
    expect(pluto.realRadius).toBeGreaterThan(0);
  });

  it('Pluto perihelion dips inside Neptune (crossing orbit like the real one)', () => {
    const pluto = byName('Pluto');
    const neptune = byName('Neptune');
    const out = new THREE.Vector3();
    orbitPosition(pluto.distance, pluto.eccentricity, 0, 0, out);
    expect(out.x).toBeCloseTo(pluto.distance * (1 - pluto.eccentricity), 6);
    expect(out.x).toBeLessThan(neptune.distance);
  });
});

describe('kuiper belt (Fase 2.5)', () => {
  it('Kuiper belt surrounds Pluto and sits outside Neptune', () => {
    const pluto = byName('Pluto');
    const neptune = byName('Neptune');
    expect(KUIPER_BELT.inner).toBeGreaterThan(neptune.distance);
    expect(KUIPER_BELT.inner).toBeLessThan(pluto.distance);
    expect(KUIPER_BELT.outer).toBeGreaterThan(pluto.distance * (1 + pluto.eccentricity) - 10);
  });

  it('main belt unchanged, kuiper is slower and thicker', () => {
    expect(MAIN_BELT.inner).toBe(132);
    expect(MAIN_BELT.outer).toBe(152);
    expect(KUIPER_BELT.baseSpeed).toBeLessThan(MAIN_BELT.baseSpeed);
    expect(KUIPER_BELT.thickness).toBeGreaterThan(MAIN_BELT.thickness);
  });

  it('createBelt stays backward compatible, kuiper updates without errors', () => {
    const scene = new THREE.Scene();
    const main = createBelt(scene, 10);
    const kuiper = createKuiperBelt(scene, 10);
    expect(main.group).toBeDefined();
    expect(kuiper.group).toBeDefined();
    main.update(1.5);
    kuiper.update(1.5);
    main.setVisible(false);
    kuiper.setVisible(false);
    expect(main.visible).toBe(false);
    expect(kuiper.visible).toBe(false);
    expect(main.group.visible).toBe(false);
    expect(kuiper.group.visible).toBe(false);
  });
});
