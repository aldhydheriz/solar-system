import * as THREE from 'three';

interface Asteroid {
  a: number; // semi-major axis
  angle: number;
  speed: number;
  size: number;
  yOff: number;
}

export interface Belt {
  group: THREE.Group;
  visible: boolean;
  update(orbitTime: number): void;
  setVisible(v: boolean): void;
}

export interface BeltOptions {
  /** inner edge of the belt (scene units) */
  inner: number;
  /** outer edge of the belt (scene units) */
  outer: number;
  /** vertical spread of rocks */
  thickness: number;
  /** rock color */
  color: number;
  /** reference radius for Kepler-ish speed law */
  refRadius: number;
  /** base speed at refRadius */
  baseSpeed: number;
  /** rock size range */
  minSize: number;
  maxSize: number;
}

export const MAIN_BELT: BeltOptions = {
  inner: 132,
  outer: 152,
  thickness: 4,
  color: 0x8a7f72,
  refRadius: 140,
  baseSpeed: 0.35,
  minSize: 0.12,
  maxSize: 0.57,
};

/**
 * Kuiper Belt beyond Neptune (Fase 2.5): surrounds Pluto's eccentric orbit
 * (Pluto a=375, e=0.244 → perihelion ≈283, aphelion ≈467).
 * Scene range 350–490 fits both stylized and real distance modes.
 */
export const KUIPER_BELT: BeltOptions = {
  inner: 350,
  outer: 490,
  thickness: 16,
  color: 0x9aa5b1,
  refRadius: 415,
  baseSpeed: 0.07,
  minSize: 0.15,
  maxSize: 0.7,
};

/**
 * Main asteroid belt between Mars and Jupiter (2.2–3.2 AU).
 * Scene range ~132–152 fits both stylized and real distance modes.
 */
export function createBelt(scene: THREE.Scene, count = 2500, opts: BeltOptions = MAIN_BELT): Belt {
  const group = new THREE.Group();
  scene.add(group);

  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: opts.color,
    roughness: 0.95,
    metalness: 0.05,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(mesh);

  const rocks: Asteroid[] = [];
  const span = opts.outer - opts.inner;
  for (let i = 0; i < count; i++) {
    const a = opts.inner + Math.random() * span;
    rocks.push({
      a,
      angle: Math.random() * Math.PI * 2,
      // Kepler-ish: inner rocks orbit faster
      speed: opts.baseSpeed * Math.pow(opts.refRadius / a, 1.5),
      size: opts.minSize + Math.random() * (opts.maxSize - opts.minSize),
      yOff: (Math.random() - 0.5) * opts.thickness,
    });
  }

  const dummy = new THREE.Object3D();
  let visible = true;
  // Fase 4.2: skip the 6k matrix recompute + buffer upload when paused
  // (orbitTime frozen) — same image, ~0 CPU instead of a full rewrite.
  let lastOrbitTime = NaN;

  function setVisible(v: boolean): void {
    visible = v;
    belt.visible = v;
    group.visible = v;
  }

  function update(orbitTime: number): void {
    if (!visible) return;
    if (orbitTime === lastOrbitTime) return;
    lastOrbitTime = orbitTime;
    for (let i = 0; i < count; i++) {
      const r = rocks[i];
      const m = r.angle + orbitTime * r.speed * 2;
      dummy.position.set(Math.cos(m) * r.a, r.yOff, Math.sin(m) * r.a);
      dummy.scale.setScalar(r.size);
      dummy.rotation.set(m, m * 1.3, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  update(0);

  const belt: Belt = { group, visible, update, setVisible };
  return belt;
}

/** Second belt outside Neptune surrounding Pluto (Fase 2.5). Shares the Belt toggle. */
export function createKuiperBelt(scene: THREE.Scene, count = 3500): Belt {
  return createBelt(scene, count, KUIPER_BELT);
}
