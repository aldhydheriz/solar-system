import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COMET_DIM_FACTOR, HALLEY, TAIL_COUNT, createComet, tailDirection, tailLength } from './comet';
import { orbitPosition } from './factory';
import { SUN_DATA } from './planetData';

describe('comet tail', () => {
  it('tail direction always points away from the Sun', () => {
    const samples = [
      new THREE.Vector3(26, 0, 0), // perihelion
      new THREE.Vector3(-494, 10, 0), // aphelion
      new THREE.Vector3(100, 60, -80),
      new THREE.Vector3(-150, -90, 200),
    ];
    for (const p of samples) {
      const d = tailDirection(p);
      expect(d.length()).toBeCloseTo(1, 6);
      // dot with radial-out must be 1: tail never points sunward
      const radial = p.clone().normalize();
      expect(d.dot(radial)).toBeCloseTo(1, 6);
    }
  });

  it('tail is long near perihelion and short at aphelion', () => {
    const peri = HALLEY.a * (1 - HALLEY.e);
    const apo = HALLEY.a * (1 + HALLEY.e);
    expect(tailLength(peri)).toBeGreaterThan(tailLength(apo));
    expect(tailLength(peri)).toBeLessThanOrEqual(130);
    expect(tailLength(apo)).toBeGreaterThanOrEqual(12);
  });

  it('head rides the high-eccentricity orbit (focus offset a*e)', () => {
    const out = new THREE.Vector3();
    orbitPosition(HALLEY.a, HALLEY.e, HALLEY.inclination, 0, out);
    expect(out.x).toBeCloseTo(HALLEY.a * (1 - HALLEY.e), 6);
    expect(HALLEY.e).toBeGreaterThan(0.5);
  });

  it('tail buffer has expected size and head-anchored first particle', () => {
    expect(TAIL_COUNT).toBeGreaterThanOrEqual(200);
    const scene = new THREE.Scene();
    const comet = createComet(scene);
    comet.update(1.5);
    const tail = comet.group.children.find((c) => c instanceof THREE.Points)! as THREE.Points;
    const arr = (tail.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    expect(arr.length).toBe(TAIL_COUNT * 3);
    // first particle sits at the head
    expect(arr[0]).toBeCloseTo(comet.head.position.x, 3);
    expect(arr[1]).toBeCloseTo(comet.head.position.y, 3);
    expect(arr[2]).toBeCloseTo(comet.head.position.z, 3);
    // last particle lies anti-sunward: dot((tail-head), radial) > 0
    const n = TAIL_COUNT - 1;
    const tip = new THREE.Vector3(arr[n * 3], arr[n * 3 + 1], arr[n * 3 + 2]);
    const radial = comet.head.position.clone().normalize();
    expect(tip.clone().sub(comet.head.position).dot(radial)).toBeGreaterThan(0);
  });
});

describe('comet orbit clearance', () => {
  it('perihelion clears the Sun surface with margin (no sun-grazing)', () => {
    const peri = HALLEY.a * (1 - HALLEY.e);
    expect(peri).toBeGreaterThan(SUN_DATA.radius + 10);
  });

  it('head never enters the Sun mesh over a full revolution', () => {
    const out = new THREE.Vector3();
    for (let k = 0; k < 72; k++) {
      const m = (k / 72) * Math.PI * 2;
      orbitPosition(HALLEY.a, HALLEY.e, HALLEY.inclination, m, out);
      expect(out.length()).toBeGreaterThan(SUN_DATA.radius);
    }
  });

  it('tail stays cartoon-free: capped well below half a Neptune orbit', () => {
    const peri = HALLEY.a * (1 - HALLEY.e);
    expect(tailLength(peri)).toBeLessThanOrEqual(100);
  });
});

describe('comet dim mode', () => {
  it('dim scales tail opacity down and restores it', () => {
    const scene = new THREE.Scene();
    const comet = createComet(scene);
    const tail = comet.group.children.find((c) => c instanceof THREE.Points)! as THREE.Points;
    const mat = tail.material as THREE.PointsMaterial;
    const bright = mat.opacity;
    comet.setDim(true);
    expect(mat.opacity).toBeCloseTo(bright * COMET_DIM_FACTOR, 6);
    comet.setDim(false);
    expect(mat.opacity).toBeCloseTo(bright, 6);
  });

  it('dim composes with low quality instead of clobbering it', () => {
    const scene = new THREE.Scene();
    const comet = createComet(scene);
    const tail = comet.group.children.find((c) => c instanceof THREE.Points)! as THREE.Points;
    const mat = tail.material as THREE.PointsMaterial;
    comet.setQuality(true);
    const lowBright = mat.opacity;
    comet.setDim(true);
    expect(mat.opacity).toBeCloseTo(lowBright * COMET_DIM_FACTOR, 6);
  });
});
