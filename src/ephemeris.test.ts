import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  J2000_MS,
  elementsAt,
  hasEphemeris,
  heliocentric,
  realOrbitPoints,
  realScenePosition,
  solveKepler,
} from './ephemeris';
import { PLANETS, currentDistance } from './planetData';

function angDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

describe('ephemeris (Fase 3.1)', () => {
  it('covers all 9 planets incl. Pluto', () => {
    for (const p of PLANETS) expect(hasEphemeris(p.name), p.name).toBe(true);
  });

  it('Kepler solver satisfies M = E - e·sinE', () => {
    for (const [Mdeg, e] of [
      [0, 0.205],
      [19.4, 0.093],
      [100, 0.017],
      [250, 0.249],
      [350, 0.048],
    ] as const) {
      const M = THREE.MathUtils.degToRad(Mdeg);
      const E = solveKepler(M, e);
      expect(E - e * Math.sin(E)).toBeCloseTo(M, 9);
    }
  });

  it('Earth at J2000 sits near mean longitude ~100.5° (just before perihelion)', () => {
    const h = heliocentric('Earth', J2000_MS);
    expect(angDiff(h.longitudeDeg, 100.46)).toBeLessThan(5);
    expect(h.radiusAU).toBeCloseTo(0.9833, 2);
  });

  it('J2000 longitudes match reference within ±5° (roadmap acceptance)', () => {
    // Referensi: bujur heliosentris benar J2000 (olah JPL Horizons,
    // dibulatkan; toleransi ±5° sesuai roadmap).
    const ref: Record<string, number> = {
      Mercury: 253.8,
      Venus: 182.6,
      Earth: 100.4,
      Mars: 359.5,
      Jupiter: 36.4,
      Saturn: 45.6,
      Uranus: 316.4,
      Neptune: 303.9,
      Pluto: 250.5,
    };
    for (const [name, lon] of Object.entries(ref)) {
      const h = heliocentric(name, J2000_MS);
      expect(angDiff(h.longitudeDeg, lon), name).toBeLessThan(5);
    }
  });

  it('Earth returns to ~same longitude after one sidereal year', () => {
    const year = 365.256 * 86400e3;
    const a = heliocentric('Earth', J2000_MS).longitudeDeg;
    const b = heliocentric('Earth', J2000_MS + year).longitudeDeg;
    expect(angDiff(a, b)).toBeLessThan(5);
  });

  it('Mars advances ~~300° in one Earth year (687d period)', () => {
    const year = 365.25 * 86400e3;
    const a = heliocentric('Mars', J2000_MS).longitudeDeg;
    const b = heliocentric('Mars', J2000_MS + year).longitudeDeg;
    // 365/687*360 ≈ 191° maju
    const prog = (((b - a) % 360) + 360) % 360;
    expect(prog).toBeGreaterThan(150);
    expect(prog).toBeLessThan(230);
  });

  it('realScenePosition keeps ecliptic direction, scales semi-major to scene size', () => {
    const out = new THREE.Vector3();
    const sceneA = 85; // Earth stylized distance
    realScenePosition('Earth', J2000_MS, sceneA, out);
    const h = heliocentric('Earth', J2000_MS);
    const el = elementsAt('Earth', J2000_MS);
    // arah: atan2(z,x) scene == bujur ekliptika
    const sceneLon = ((THREE.MathUtils.radToDeg(Math.atan2(out.z, out.x)) % 360) + 360) % 360;
    expect(angDiff(sceneLon, h.longitudeDeg)).toBeLessThan(0.01);
    // jarak scene == sceneA * (r/a)
    expect(out.length()).toBeCloseTo(sceneA * (h.radiusAU / el.a), 6);
  });

  it('real position sticks to the true orbit ellipse (Pluto regression)', () => {
    // Dulu garis orbit real = elips sederhana tanpa node → Pluto melenceng
    // ~107 unit (a=375) dan terlihat "terlempar". Sekarang garis = elips JPL
    // sejati, jadi jarak planet-ke-garis ≈ 0 untuk kesembilan planet.
    const now = Date.now();
    for (const p of PLANETS) {
      const sceneA = currentDistance(p, 'stylized');
      const pos = new THREE.Vector3();
      realScenePosition(p.name, now, sceneA, pos);
      // sample rapat: ujung polyline 256-segmen berdeviasi wajar di perihelion
      const pts = realOrbitPoints(p.name, now, sceneA, 1440);
      let best = Infinity;
      for (const q of pts) best = Math.min(best, q.distanceTo(pos));
      expect(best, `${p.name} off-orbit`).toBeLessThan(sceneA * 0.01);
    }
  });

  it('true ellipse perihelion/aphelion match a(1∓e) scaled', () => {
    const now = Date.now();
    for (const p of PLANETS) {
      const sceneA = currentDistance(p, 'stylized');
      const el = elementsAt(p.name, now);
      const pts = realOrbitPoints(p.name, now, sceneA, 720);
      let min = Infinity;
      let max = 0;
      for (const q of pts) {
        const r = q.length();
        if (r < min) min = r;
        if (r > max) max = r;
      }
      expect(min, `${p.name} perihelion`).toBeCloseTo(sceneA * (1 - el.e), 6);
      expect(max, `${p.name} aphelion`).toBeCloseTo(sceneA * (1 + el.e), 6);
    }
  });
});
