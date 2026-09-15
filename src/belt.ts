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
  update(orbitTime: number): void;
}

/**
 * Main asteroid belt between Mars and Jupiter (2.2–3.2 AU).
 * Scene range ~132–152 fits both stylized and real distance modes.
 */
export function createBelt(scene: THREE.Scene, count = 2500): Belt {
  const group = new THREE.Group();
  scene.add(group);

  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a7f72,
    roughness: 0.95,
    metalness: 0.05
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(mesh);

  const rocks: Asteroid[] = [];
  for (let i = 0; i < count; i++) {
    const a = 132 + Math.random() * 20;
    rocks.push({
      a,
      angle: Math.random() * Math.PI * 2,
      // Kepler-ish: inner rocks orbit faster
      speed: 0.35 * Math.pow(140 / a, 1.5),
      size: 0.12 + Math.random() * 0.45,
      yOff: (Math.random() - 0.5) * 4
    });
  }

  const dummy = new THREE.Object3D();

  function update(orbitTime: number): void {
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

  return { group, update };
}
