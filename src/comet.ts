import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { orbitPosition } from './factory';
import type { ScaleMode } from './planetTypes';

/** Orbital elements for 1P/Halley (stylized scene units).
 * Perihelion a*(1-e) ≈ 49 clears the Sun mesh (radius 20) with margin;
 * the real 0.59 AU perihelion ≈ 50 units at Earth-orbit 85 ≈ 1 AU.
 * Aphelion ≈ 491 stays inside the far plane. */
export const HALLEY = {
  name: 'Halley',
  a: 270, // semi-major axis (Neptune ≈ 310, aphelion ≈ 491 stays inside far plane)
  e: 0.82, // high eccentricity, perihelion ≈ 49 well outside Sun radius 20
  inclination: 18, // real 162° retrograde ≈ 18° tilted; orbitPosition exaggerates 3x for visibility
  speed: 0.035, // slower than Neptune (0.05): ~7y scaled period
  radius: 1.4,
} as const;

export const TAIL_COUNT = 500;

/** Direction the tail must point: radially away from the Sun. Pure for testing. */
export function tailDirection(cometPos: THREE.Vector3, sunPos?: THREE.Vector3): THREE.Vector3 {
  const sun = sunPos ?? new THREE.Vector3(0, 0, 0);
  return cometPos.clone().sub(sun).normalize();
}

/** Tail length grows near perihelion (sublimation) and shrinks far away. Pure for testing. */
export function tailLength(distance: number): number {
  return THREE.MathUtils.clamp(120 * (50 / Math.max(distance, 1)), 12, 95);
}

export interface Comet {
  group: THREE.Group;
  head: THREE.Mesh;
  update(orbitTime: number): void;
  setLabelsVisible(v: boolean): void;
  setOrbitsVisible(v: boolean): void;
  setScaleMode(mode: ScaleMode): void;
  setQuality(low: boolean): void;
  setDim(dim: boolean): void;
}

/** Tail/coma brightness factor when Dim mode is on (glare relief). */
export const COMET_DIM_FACTOR = 0.45;

function makeComaTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    // headless (vitest node env): 1px white texture, tinted by sprite color
    const data = new Uint8Array([255, 255, 255, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(220, 240, 255, 1)');
  g.addColorStop(0.25, 'rgba(160, 210, 255, 0.55)');
  g.addColorStop(0.6, 'rgba(120, 180, 255, 0.15)');
  g.addColorStop(1, 'rgba(120, 180, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createOrbitLine(): THREE.Line {
  const b = HALLEY.a * Math.sqrt(1 - HALLEY.e * HALLEY.e);
  const curve = new THREE.EllipseCurve(0, 0, HALLEY.a, b, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(256);
  const inc = THREE.MathUtils.degToRad(HALLEY.inclination * 3);
  const c = HALLEY.a * HALLEY.e;
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((p) => new THREE.Vector3(p.x - c, -p.y * Math.sin(inc), p.y * Math.cos(inc)))
  );
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.25 }));
}

export function createComet(scene: THREE.Scene): Comet {
  const group = new THREE.Group();
  scene.add(group);

  const orbitLine = createOrbitLine();
  group.add(orbitLine);

  // nucleus: small dark rocky body
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(HALLEY.radius, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x8a8078, roughness: 1, metalness: 0 })
  );
  group.add(head);

  // coma glow
  const coma = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeComaTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  coma.scale.set(HALLEY.radius * 7, HALLEY.radius * 7, 1);
  head.add(coma);

  const labelDiv = typeof document === 'undefined' ? null : document.createElement('div');
  let label: THREE.Object3D;
  if (labelDiv) {
    labelDiv.className = 'planet-label';
    labelDiv.textContent = HALLEY.name;
    const css = new CSS2DObject(labelDiv);
    css.position.set(0, HALLEY.radius + 3, 0);
    label = css;
  } else {
    // headless test env: plain placeholder keeps setLabelsVisible working
    label = new THREE.Object3D();
    label.name = 'Halley-label';
    label.position.set(0, HALLEY.radius + 3, 0);
  }
  head.add(label);

  // tail: one Points cloud, positions rewritten every frame along the anti-sun direction
  const tailGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(TAIL_COUNT * 3);
  const colors = new Float32Array(TAIL_COUNT * 3);
  // deterministic cone offsets so the tail has volume (seeded PRNG, no per-frame alloc)
  let seed = 1337;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const spread: Float32Array = new Float32Array(TAIL_COUNT * 3);
  const headColor = new THREE.Color(0xd8ecff);
  const tailColor = new THREE.Color(0x000000); // additive blending: fades to invisible
  for (let i = 0; i < TAIL_COUNT; i++) {
    const t = i / (TAIL_COUNT - 1);
    spread[i * 3] = (rand() - 0.5) * 2;
    spread[i * 3 + 1] = (rand() - 0.5) * 2;
    spread[i * 3 + 2] = (rand() - 0.5) * 2;
    const c = headColor.clone().lerp(tailColor, Math.pow(t, 0.7));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  tailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  tailGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const tailMat = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const tail = new THREE.Points(tailGeo, tailMat);
  tail.frustumCulled = false; // positions update on CPU; avoid disappearing at apoapsis
  group.add(tail);

  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  // orthonormal basis around dir for the cone spread (reused, no alloc)
  const up = new THREE.Vector3();
  const side = new THREE.Vector3();
  const p = new THREE.Vector3();
  const angle = Math.random() * Math.PI * 2;
  let lowQ = false;
  let dimmed = false;

  function refreshTailOpacity(): void {
    tailMat.opacity = (lowQ ? 0.5 : 0.85) * (dimmed ? COMET_DIM_FACTOR : 1);
  }

  function update(orbitTime: number): void {
    const m = angle + orbitTime * HALLEY.speed * 2;
    orbitPosition(HALLEY.a, HALLEY.e, HALLEY.inclination, m, pos);
    head.position.copy(pos);

    const dist = pos.length();
    dir.copy(tailDirection(pos)); // ion tail: straight away from Sun
    const len = tailLength(dist);

    // coma brighter + bigger near perihelion
    const glow = THREE.MathUtils.clamp(60 / Math.max(dist, 1), 0.35, 2.2);
    coma.scale.set(HALLEY.radius * 7 * glow, HALLEY.radius * 7 * glow, 1);
    (coma.material as THREE.SpriteMaterial).opacity =
      THREE.MathUtils.clamp(glow, 0.35, 1) * (dimmed ? COMET_DIM_FACTOR : 1);

    up.set(0, 1, 0);
    if (Math.abs(dir.dot(up)) > 0.9) up.set(1, 0, 0);
    side.crossVectors(dir, up).normalize();
    up.crossVectors(side, dir).normalize();

    const attr = tailGeo.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < TAIL_COUNT; i++) {
      const t = i / (TAIL_COUNT - 1);
      // denser near the head (t^1.35), slender cone, faint slow shimmer —
      // a traveling-wave wobble here reads as a wagging worm, so keep it subtle
      const along = Math.pow(t, 1.35) * len;
      const cone = t * (1.2 + t * 5); // tail widens gently with distance from head
      const wobble = Math.sin(orbitTime * 1.2 + i * 0.12) * 0.12 * t;
      p.copy(pos)
        .addScaledVector(dir, along)
        .addScaledVector(side, (spread[i * 3] + wobble) * cone * 0.5)
        .addScaledVector(up, spread[i * 3 + 1] * cone * 0.5);
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    attr.needsUpdate = true;
  }

  update(0);

  return {
    group,
    head,
    update,
    setLabelsVisible(v: boolean): void {
      label.visible = v;
    },
    setOrbitsVisible(v: boolean): void {
      orbitLine.visible = v;
    },
    setScaleMode(): void {
      // comet orbit is identical in both scale modes by design (single eccentric path)
    },
    setQuality(low: boolean): void {
      lowQ = low;
      tailMat.size = low ? 1.6 : 2.2;
      coma.visible = !low;
      refreshTailOpacity();
    },
    setDim(dim: boolean): void {
      dimmed = dim;
      refreshTailOpacity();
    },
  };
}
