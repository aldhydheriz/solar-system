import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyEarthNightLights, nightMixFactor } from './earthNight';

describe('nightMixFactor', () => {
  it('day side (facing sun) stays dark: mix ≈ 0', () => {
    expect(nightMixFactor(1)).toBeCloseTo(0, 6);
    expect(nightMixFactor(0.5)).toBeCloseTo(0, 6);
  });

  it('night side (away from sun) glows: mix ≈ 1', () => {
    expect(nightMixFactor(-1)).toBeCloseTo(1, 6);
    expect(nightMixFactor(-0.6)).toBeCloseTo(1, 6);
  });

  it('terminator fades smoothly between edges', () => {
    const mid = nightMixFactor(-0.05); // halfway between 0.15 and -0.25
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    // monotonic: more negative ndl → more night
    expect(nightMixFactor(0.1)).toBeLessThan(nightMixFactor(-0.1));
    expect(nightMixFactor(-0.1)).toBeLessThan(nightMixFactor(-0.2));
  });
});

describe('applyEarthNightLights', () => {
  it('injects night shader chunk + uniforms into the material', () => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x4d7dd1 });
    const nightMap = new THREE.DataTexture(new Uint8Array([255, 220, 150, 255]), 1, 1);
    applyEarthNightLights(mat, nightMap);

    expect(typeof mat.customProgramCacheKey?.()).toBe('string');
    expect(mat.customProgramCacheKey?.()).toBe('earth-night-lights');

    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <common>\n#include <worldpos_vertex>',
      fragmentShader: '#include <common>\n#include <emissivemap_fragment>',
    };
    mat.onBeforeCompile?.(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as never);

    expect(shader.uniforms.uNightMap.value).toBe(nightMap);
    expect(shader.uniforms.uNightIntensity.value).toBeGreaterThan(0);
    expect(shader.vertexShader).toContain('vEarthWorldNormal');
    expect(shader.fragmentShader).toContain('uNightMap');
    expect(shader.fragmentShader).toContain('nightMix');
    // day side must stay normal: emissive is fully masked by nightMix
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance = nightTex.rgb');
  });
});
