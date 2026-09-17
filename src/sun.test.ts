import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SUN_DIM_FACTOR, SUN_FRAGMENT_SHADER, createSun, shadeSunSample } from './sun';

function testMap(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([255, 200, 100, 255]), 1, 1);
  tex.needsUpdate = true;
  return tex;
}

describe('shadeSunSample (shader brightness contract)', () => {
  it('calm disc center renders the base map color', () => {
    // gran 0.5 -> flicker 1.0, spot 1 -> no mask, limb 1 -> no darkening
    expect(shadeSunSample(1, 0.5, 1, 1)).toBeCloseTo(1, 6);
  });

  it('sunspots darken the surface', () => {
    const calm = shadeSunSample(1, 0.5, 1, 1);
    const spot = shadeSunSample(1, 0.5, 0.2, 1);
    expect(spot).toBeLessThan(calm);
    expect(spot).toBeGreaterThan(0);
  });

  it('limb darkens toward the edge', () => {
    const center = shadeSunSample(1, 0.5, 1, 1);
    const edge = shadeSunSample(1, 0.5, 1, 0);
    expect(edge).toBeCloseTo(center * 0.55, 6);
    expect(shadeSunSample(1, 0.5, 1, 0.5)).toBeLessThan(center);
  });
});

describe('sun shader source', () => {
  it('animates over time with noise granulation + sunspots', () => {
    expect(SUN_FRAGMENT_SHADER).toContain('uTime');
    expect(SUN_FRAGMENT_SHADER).toContain('sunFbm');
    expect(SUN_FRAGMENT_SHADER).toContain('smoothstep(0.42, 0.30, spots)');
  });
});

describe('createSun quality + dim', () => {
  it('runs the animated shader on High, static material on Low', () => {
    const sun = createSun(new THREE.Scene(), { map: testMap() });
    expect(sun.sun.material).toBeInstanceOf(THREE.ShaderMaterial);

    sun.update(3.5, 1);
    const uniforms = (sun.sun.material as THREE.ShaderMaterial).uniforms;
    expect((uniforms.uTime as { value: number }).value).toBeCloseTo(3.5, 6);

    sun.setQuality(true); // Low: animation off
    expect(sun.sun.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    sun.update(9, 1);
    sun.setQuality(false); // back to High
    expect(sun.sun.material).toBeInstanceOf(THREE.ShaderMaterial);
    // uTime stayed frozen while low
    const u2 = (sun.sun.material as THREE.ShaderMaterial).uniforms;
    expect((u2.uTime as { value: number }).value).toBeCloseTo(3.5, 6);
  });

  it('dim mode tames the glow sprites', () => {
    const sun = createSun(new THREE.Scene(), { map: testMap() });
    const glow = sun.group.children[1] as THREE.Sprite;
    sun.update(0, 1);
    const bright = (glow.material as THREE.SpriteMaterial).opacity;
    sun.setDim(true);
    sun.update(0, 1);
    const dim = (glow.material as THREE.SpriteMaterial).opacity;
    expect(dim).toBeCloseTo(bright * SUN_DIM_FACTOR, 6);
  });
});
