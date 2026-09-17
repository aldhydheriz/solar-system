import * as THREE from 'three';

/**
 * Fase 2.2 — Earth night lights.
 *
 * Day side stays lit by the PointLight at the Sun; night side gets an extra
 * emissive term sampled from the `earthlights` texture. The mix factor is the
 * dot of the world normal with the direction toward the Sun (Sun at origin),
 * passed through a smoothstep so the terminator fades softly.
 *
 * GLSL used in the injected chunk:
 *   nightMix = smoothstep(0.15, -0.25, dot(N, sunDir))
 */

/** Terminator edges, mirrored in GLSL below. Keep in sync. */
export const NIGHT_EDGE_DAY = 0.15;
export const NIGHT_EDGE_NIGHT = -0.25;

/** Sun world position — the Sun mesh group sits at the scene origin. */
export const SUN_POSITION = new THREE.Vector3(0, 0, 0);

/** Emissive boost for the city lights on the night side. */
export const NIGHT_INTENSITY = 2.2;

function smoothstep(edge0: number, edge1: number, x: number): number {
  // GLSL smoothstep with edge0 > edge1 (reversed edges) — clamp + hermite.
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Night mix factor for a fragment: 0 on the day side, 1 on the night side.
 * Pure (no THREE scene needed) so it is unit-testable.
 */
export function nightMixFactor(normalDotSun: number): number {
  return smoothstep(NIGHT_EDGE_DAY, NIGHT_EDGE_NIGHT, normalDotSun);
}

/**
 * Patch an Earth MeshStandardMaterial so its emissive term becomes the night
 * lights texture masked by the night side. Day side emissive → ~0 (normal).
 */
export function applyEarthNightLights(material: THREE.MeshStandardMaterial, nightMap: THREE.Texture): void {
  nightMap.colorSpace = THREE.SRGBColorSpace;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNightMap = { value: nightMap };
    shader.uniforms.uNightIntensity = { value: NIGHT_INTENSITY };
    shader.uniforms.uSunPos = { value: SUN_POSITION.clone() };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vEarthWorldPos;
varying vec3 vEarthWorldNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vEarthWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vEarthWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uNightMap;
uniform float uNightIntensity;
uniform vec3 uSunPos;
varying vec3 vEarthWorldPos;
varying vec3 vEarthWorldNormal;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  vec4 nightTex = texture2D(uNightMap, vMapUv);
  vec3 sunDir = normalize(uSunPos - vEarthWorldPos);
  float ndl = dot(normalize(vEarthWorldNormal), sunDir);
  float nightMix = smoothstep(${NIGHT_EDGE_DAY.toFixed(2)}, ${NIGHT_EDGE_NIGHT.toFixed(2)}, ndl);
  totalEmissiveRadiance = nightTex.rgb * uNightIntensity * nightMix;
}`
      );
  };

  // Avoid program-cache collision with the other (non-patched) planets.
  material.customProgramCacheKey = () => 'earth-night-lights';
}
