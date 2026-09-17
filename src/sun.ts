import * as THREE from 'three';
import { SUN_DATA } from './planets';
import sunMapUrl from './assets/textures/sunmap.jpg';

export interface Sun {
  group: THREE.Group;
  sun: THREE.Mesh;
  update(time: number, speed: number, delta?: number): void;
  /** Low mode: static material (animated shader off). */
  setQuality(low: boolean): void;
  /** Dim mode: tame the glow sprites for glare-sensitive eyes. */
  setDim(dim: boolean): void;
}

/** Dim factor applied to glow sprites when Dim mode is on. */
export const SUN_DIM_FACTOR = 0.45;

/** GLSL smoothstep mirror for the sunspot mask (reversed edges). */
function sstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * CPU mirror of the fragment-shader brightness contract. `day` is the base
 * map brightness, `gran`/`spot` are 0..1 noise samples, `limb` is
 * dot(N, V) (1 = disc center, 0 = edge). Returns a multiplier.
 */
export function shadeSunSample(day: number, gran: number, spot: number, limb: number): number {
  const flicker = 0.92 + 0.16 * gran;
  const spotMask = sstep(0.42, 0.3, spot);
  const spotted = 1 - 0.62 * spotMask;
  const limbDark = 0.55 + 0.45 * Math.pow(Math.max(limb, 0), 0.55);
  return day * flicker * spotted * limbDark;
}

export const SUN_VERTEX_SHADER = /* glsl */ `
varying vec2 vSunUv;
varying vec3 vSunNormal;
varying vec3 vSunViewDir;
void main() {
  vSunUv = uv;
  vSunNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vSunViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const SUN_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
varying vec2 vSunUv;
varying vec3 vSunNormal;
varying vec3 vSunViewDir;

float sunHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float sunNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(sunHash(i), sunHash(i + vec2(1.0, 0.0)), f.x),
    mix(sunHash(i + vec2(0.0, 1.0)), sunHash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float sunFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * sunNoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}
void main() {
  vec3 day = texture2D(uMap, vSunUv).rgb;
  vec2 p = vSunUv * vec2(6.0, 3.0);
  // boiling granulation cells, drifting slowly
  float gran = sunFbm(p + vec2(uTime * 0.05, uTime * 0.02));
  // large cool cells -> sunspots
  float spots = sunFbm(p * 0.35 - vec2(uTime * 0.01, 0.0));
  float spotMask = smoothstep(0.42, 0.30, spots);
  vec3 col = day * (0.92 + 0.16 * gran);
  col = mix(col, col * vec3(0.45, 0.32, 0.30), spotMask * 0.85);
  float limb = clamp(dot(normalize(vSunNormal), normalize(vSunViewDir)), 0.0, 1.0);
  col *= 0.55 + 0.45 * pow(limb, 0.55);
  col += vec3(1.0, 0.45, 0.12) * pow(1.0 - limb, 2.0) * 0.35;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createSun(scene: THREE.Scene, opts?: { map?: THREE.Texture }): Sun {
  const group = new THREE.Group();

  const sunTex = opts?.map ?? new THREE.TextureLoader().load(sunMapUrl);
  sunTex.colorSpace = THREE.SRGBColorSpace;

  const staticMat = new THREE.MeshBasicMaterial({ map: sunTex, color: 0xffffff, fog: false });
  const animatedMat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: sunTex },
      uTime: { value: 0 },
    },
    vertexShader: SUN_VERTEX_SHADER,
    fragmentShader: SUN_FRAGMENT_SHADER,
    fog: false,
  });

  // Fase 4.2: 48 segs (was 64) — limb still smooth, ~44% fewer tris.
  const sunGeo = new THREE.SphereGeometry(SUN_DATA.radius, 48, 48);
  const sun = new THREE.Mesh<THREE.SphereGeometry, THREE.Material>(sunGeo, animatedMat);
  group.add(sun);

  const glowLayer = createGlowSprite();
  group.add(glowLayer);

  const atmosphere = createAtmosphere();
  group.add(atmosphere);

  scene.add(group);
  scene.userData.sun = sun;

  let lowQuality = false;
  let dimmed = false;

  return {
    group,
    sun,
    update(time: number, speed: number, delta = 1 / 60) {
      sun.rotation.y += SUN_DATA.rotationSpeed * speed * delta * 60;
      if (!lowQuality) {
        (animatedMat.uniforms.uTime as { value: number }).value = time;
      }
      const dim = dimmed ? SUN_DIM_FACTOR : 1;
      (glowLayer.material as THREE.SpriteMaterial).opacity = (0.9 + Math.sin(time * 1.2) * 0.1) * dim;
      (atmosphere.material as THREE.SpriteMaterial).opacity = (0.55 + Math.sin(time * 1.8) * 0.08) * dim;
    },
    setQuality(low: boolean) {
      lowQuality = low;
      sun.material = low ? staticMat : animatedMat;
    },
    setDim(dim: boolean) {
      dimmed = dim;
    },
  };
}

function spriteTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size: number): THREE.Texture {
  if (typeof document === 'undefined') {
    // headless (vitest node env): 1px white texture, tinted by sprite color
    const data = new Uint8Array([255, 255, 255, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  return new THREE.CanvasTexture(canvas);
}

function createGlowSprite(): THREE.Sprite {
  const texture = spriteTexture((ctx) => {
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, 'rgba(255, 220, 120, 1)');
    gradient.addColorStop(0.08, 'rgba(255, 170, 60, 0.95)');
    gradient.addColorStop(0.12, 'rgba(255, 130, 30, 0.8)');
    gradient.addColorStop(0.2, 'rgba(255, 100, 20, 0.45)');
    gradient.addColorStop(0.35, 'rgba(255, 80, 10, 0.2)');
    gradient.addColorStop(0.6, 'rgba(255, 60, 5, 0.06)');
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
  }, 512);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(SUN_DATA.radius * 7, SUN_DATA.radius * 7, 1);
  return sprite;
}

function createAtmosphere(): THREE.Sprite {
  const texture = spriteTexture((ctx) => {
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, 'rgba(255, 200, 100, 0.6)');
    gradient.addColorStop(0.5, 'rgba(255, 140, 40, 0.25)');
    gradient.addColorStop(0.7, 'rgba(255, 120, 20, 0.12)');
    gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
  }, 512);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(SUN_DATA.radius * 2.4, SUN_DATA.radius * 2.4, 1);
  return sprite;
}
