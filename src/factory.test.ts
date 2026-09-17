import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { orbitPosition } from './factory';

const V = () => new THREE.Vector3();
const approx = (v: number) => expect(v);

describe('orbitPosition', () => {
  it('circular equatorial orbit passes through cardinal points', () => {
    const a = 100;
    const p0 = orbitPosition(a, 0, 0, 0, V());
    approx(p0.x).toBeCloseTo(a, 6);
    approx(p0.y).toBeCloseTo(0, 6);
    approx(p0.z).toBeCloseTo(0, 6);

    const p90 = orbitPosition(a, 0, 0, Math.PI / 2, V());
    approx(p90.x).toBeCloseTo(0, 6);
    approx(p90.z).toBeCloseTo(a, 6);

    const p180 = orbitPosition(a, 0, 0, Math.PI, V());
    approx(p180.x).toBeCloseTo(-a, 6);
    approx(p180.z).toBeCloseTo(0, 6);
  });

  it('Mercury eccentricity (e=0.205) shifts focus by a*e', () => {
    const a = 40;
    const e = 0.205;
    const p = orbitPosition(a, e, 0, 0, V());
    // perihelion: x = a - c where c = a*e; Sun sits at focus, not center
    approx(p.x).toBeCloseTo(a * (1 - e), 6);
    approx(p.z).toBeCloseTo(0, 6);
  });

  it('semi-minor axis follows b = a*sqrt(1-e^2)', () => {
    const a = 40;
    const e = 0.205;
    const b = a * Math.sqrt(1 - e * e);
    const p = orbitPosition(a, e, 0, Math.PI / 2, V());
    approx(p.x).toBeCloseTo(-a * e, 6); // focus offset still applies
    approx(Math.hypot(p.y, p.z)).toBeCloseTo(b, 6);
  });

  it('Mercury inclination (7°) tilts orbit out of ecliptic (3x exaggerated)', () => {
    const a = 40;
    const e = 0.205;
    const b = a * Math.sqrt(1 - e * e);
    const inc = THREE.MathUtils.degToRad(7 * 3);
    const p = orbitPosition(a, e, 7, Math.PI / 2, V());
    approx(p.y).toBeCloseTo(-b * Math.sin(inc), 6);
    approx(p.z).toBeCloseTo(b * Math.cos(inc), 6);
    expect(p.y).not.toBeCloseTo(0, 3);
  });

  it('zero inclination keeps orbit flat', () => {
    const p = orbitPosition(85, 0.017, 0, 1.234, V());
    approx(p.y).toBeCloseTo(0, 9);
  });

  it('full revolution returns to start and reuses out vector', () => {
    const out = V();
    const p0 = orbitPosition(110, 0.093, 1.85, 0.7, out);
    expect(p0).toBe(out);
    const p1 = orbitPosition(110, 0.093, 1.85, 0.7 + Math.PI * 2, V());
    approx(p1.x).toBeCloseTo(p0.x, 6);
    approx(p1.y).toBeCloseTo(p0.y, 6);
    approx(p1.z).toBeCloseTo(p0.z, 6);
  });
});
