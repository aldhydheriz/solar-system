import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { MoonData, PlanetData, PositionMode, RingConfig, ScaleMode } from './planetTypes';
import { PLANETS, currentDistance, currentRadius, moonDistance, moonRadius } from './planetData';
import { applyEarthNightLights } from './earthNight';
import { hasEphemeris, realOrbitPoints, realScenePosition } from './ephemeris';

interface MoonEntry {
  mesh: THREE.Mesh;
  data: MoonData;
  angle: number;
}

export interface PlanetEntry {
  group: THREE.Group;
  mesh: THREE.Mesh;
  data: PlanetData;
  angle: number;
  moons: MoonEntry[];
  orbitLine: THREE.Line;
  moonOrbits: THREE.Line[];
  label: CSS2DObject;
  clouds: THREE.Mesh | null;
}

export interface SolarSystem {
  systemGroup: THREE.Group;
  planets: PlanetEntry[];
  orbitLines: THREE.Line[];
  scaleMode: ScaleMode;
  positionMode: PositionMode;
  labelsVisible: boolean;
  orbitsVisible: boolean;
  update(orbitTime: number, timeScale: number, delta: number, dateMs?: number): void;
  setScaleMode(mode: ScaleMode): void;
  setPositionMode(mode: PositionMode): void;
  setLabelsVisible(v: boolean): void;
  setOrbitsVisible(v: boolean): void;
}

/** Position on an inclined elliptical orbit. m = mean anomaly. */
export function orbitPosition(
  a: number,
  e: number,
  inclinationDeg: number,
  m: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const b = a * Math.sqrt(Math.max(0.05, 1 - e * e));
  const x = Math.cos(m) * a;
  const z = Math.sin(m) * b;
  // incline around X axis so the orbit tilts out of the ecliptic plane
  const inc = THREE.MathUtils.degToRad(inclinationDeg * 3); // 3x exaggerated for visibility
  const y = -z * Math.sin(inc);
  const z2 = z * Math.cos(inc);
  // shift focus so Sun stays near a focus, not the center, for eccentric orbits
  const c = a * e;
  return out.set(x - c, y, z2);
}

export function createSolarSystem(scene: THREE.Scene): SolarSystem {
  const planets: PlanetEntry[] = [];
  const orbitLines: THREE.Line[] = [];

  const systemGroup = new THREE.Group();
  scene.add(systemGroup);

  let scaleMode: ScaleMode = 'stylized';
  // Fase 3.1: real = inklinasi benar (1x) + posisi JPL; artistic = 3x + fase acak.
  let positionMode: PositionMode = 'artistic';
  // tanggal sim terakhir (diisi update(), dipakai rebuild garis orbit real)
  let lastDateMs = Date.now();
  let labelsVisible = true;
  let orbitsVisible = true;

  const loader = new THREE.TextureLoader();

  PLANETS.forEach((data) => {
    const { group: planetGroup, mesh, clouds } = createPlanet(data, scaleMode, loader);
    const orbitLine = createOrbitLine(data, scaleMode, positionMode, lastDateMs);

    systemGroup.add(orbitLine);
    systemGroup.add(planetGroup);

    planetGroup.userData.planetData = data;
    mesh.userData.planetData = data;

    const moons: MoonEntry[] = (data.moons ?? []).map((m) => {
      const mesh = createMoonMesh(m, scaleMode, loader);
      mesh.userData.moonData = m;
      mesh.userData.planetData = data;
      planetGroup.add(mesh);
      return { mesh, data: m, angle: Math.random() * Math.PI * 2 };
    });

    const moonOrbits: THREE.Line[] = [];
    (data.moons ?? []).forEach((m) => {
      const line = createMoonOrbit(m, scaleMode);
      planetGroup.add(line);
      moonOrbits.push(line);
    });

    const label = createLabel(data, currentRadius(data, scaleMode));
    planetGroup.add(label);

    const entry: PlanetEntry = {
      group: planetGroup,
      mesh,
      data,
      angle: Math.random() * Math.PI * 2,
      moons,
      orbitLine,
      moonOrbits,
      label,
      clouds,
    };
    planets.push(entry);
    orbitLines.push(orbitLine);
  });

  const tmp = new THREE.Vector3();

  function setScaleMode(mode: ScaleMode): void {
    scaleMode = mode;
    solarSystem.scaleMode = mode;
    planets.forEach((p) => {
      const r = currentRadius(p.data, mode);
      const k = r / p.data.radius;
      p.mesh.scale.setScalar(k);
      // rescale rings + clouds (they carry userData.kind), skip moons
      p.group.children.forEach((child) => {
        const kind = (child.userData as { kind?: string }).kind;
        if (kind === 'rings' || kind === 'clouds') child.scale.setScalar(k);
      });
      // rebuild planet orbit line
      const newLine = createOrbitLine(p.data, mode, positionMode, lastDateMs);
      systemGroup.remove(p.orbitLine);
      p.orbitLine.geometry.dispose();
      (p.orbitLine.material as THREE.Material).dispose();
      systemGroup.add(newLine);
      p.orbitLine = newLine;
      // rebuild moon geometry + moon orbit lines
      p.moons.forEach((mn) => {
        mn.mesh.geometry.dispose();
        mn.mesh.geometry = buildMoonGeometry(mn.data, mode, loader);
      });
      p.moonOrbits.forEach((line) => {
        p.group.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
      p.moonOrbits.length = 0;
      (p.data.moons ?? []).forEach((m) => {
        const line = createMoonOrbit(m, mode);
        p.group.add(line);
        p.moonOrbits.push(line);
      });
      // move label above the resized planet
      p.label.position.set(0, r + Math.max(2, r * 0.35), 0);
    });
    orbitLines.length = 0;
    planets.forEach((p) => orbitLines.push(p.orbitLine));
  }

  function setLabelsVisible(v: boolean): void {
    labelsVisible = v;
    solarSystem.labelsVisible = v;
    planets.forEach((p) => {
      p.label.visible = v;
    });
  }

  function setOrbitsVisible(v: boolean): void {
    orbitsVisible = v;
    solarSystem.orbitsVisible = v;
    planets.forEach((p) => {
      p.orbitLine.visible = v;
      p.moonOrbits.forEach((line) => {
        line.visible = v;
      });
    });
  }

  function setPositionMode(mode: PositionMode): void {
    if (positionMode === mode) return;
    positionMode = mode;
    solarSystem.positionMode = mode;
    // real: garis = elips JPL sejati (Ω/I/ω penuh) sehingga planet menempel;
    // artistic: elips sederhana 3x agar terlihat.
    planets.forEach((p) => {
      const newLine = createOrbitLine(p.data, scaleMode, mode, lastDateMs);
      newLine.visible = orbitsVisible;
      systemGroup.remove(p.orbitLine);
      p.orbitLine.geometry.dispose();
      (p.orbitLine.material as THREE.Material).dispose();
      systemGroup.add(newLine);
      p.orbitLine = newLine;
    });
    orbitLines.length = 0;
    planets.forEach((p) => orbitLines.push(p.orbitLine));
  }

  const solarSystem: SolarSystem = {
    systemGroup,
    planets,
    orbitLines,
    scaleMode,
    positionMode,
    labelsVisible,
    orbitsVisible,
    update(orbitTime: number, timeScale: number, delta: number, dateMs?: number) {
      const frame = delta * 60;
      if (dateMs !== undefined) lastDateMs = dateMs;
      const real = positionMode === 'real' && dateMs !== undefined;
      planets.forEach((p) => {
        const a = currentDistance(p.data, scaleMode);
        if (real && hasEphemeris(p.data.name)) {
          realScenePosition(p.data.name, dateMs, a, tmp);
          p.group.position.copy(tmp);
        } else {
          const m = p.angle + orbitTime * p.data.speed * 2;
          orbitPosition(a, p.data.eccentricity, p.data.inclination, m, tmp);
          p.group.position.copy(tmp);
        }
        p.mesh.rotation.y += p.data.rotationSpeed * timeScale * frame;
        if (p.clouds) p.clouds.rotation.y += p.data.rotationSpeed * 1.3 * timeScale * frame;
        p.moons.forEach((mn) => {
          const md = moonDistance(mn.data, scaleMode);
          const ma = mn.angle + orbitTime * mn.data.speed * 2;
          mn.mesh.position.set(Math.cos(ma) * md, 0, Math.sin(ma) * md);
          mn.mesh.rotation.y += 0.005 * timeScale * frame;
        });
      });
    },
    setScaleMode,
    setPositionMode,
    setLabelsVisible,
    setOrbitsVisible,
  };

  return solarSystem;
}

function texturedMaterial(
  mapUrl: string,
  loader: THREE.TextureLoader,
  opts?: { roughness?: number }
): THREE.MeshStandardMaterial {
  const map = srgb(loader.load(mapUrl));
  return new THREE.MeshStandardMaterial({
    map,
    roughness: opts?.roughness ?? 0.9,
    metalness: 0.05,
    // emissiveMap = same texture so hover-highlight keeps surface detail
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: 0.08,
  });
}

function srgb(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPlanet(
  data: PlanetData,
  mode: ScaleMode,
  loader: THREE.TextureLoader
): { group: THREE.Group; mesh: THREE.Mesh; clouds: THREE.Mesh | null } {
  const group = new THREE.Group();
  const r = currentRadius(data, mode);

  const mat = data.texture
    ? texturedMaterial(data.texture, loader)
    : new THREE.MeshStandardMaterial({
        color: data.color,
        roughness: 0.8,
        metalness: 0.1,
        emissive: new THREE.Color(data.color).multiplyScalar(0.08),
      });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, 40, 40), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (data.nightTexture) {
    // Fase 2.2: city lights on the night side (shader mix by sun direction).
    const nightMap = srgb(loader.load(data.nightTexture));
    applyEarthNightLights(mat as THREE.MeshStandardMaterial, nightMap);
  }
  if (mode === 'real') mesh.scale.setScalar(r / data.radius);
  mesh.rotation.z = THREE.MathUtils.degToRad(data.axialTilt);
  group.add(mesh);

  let clouds: THREE.Mesh | null = null;
  if (data.cloudsTexture) {
    const cloudMap = srgb(loader.load(data.cloudsTexture));
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(data.radius * 1.02, 40, 40),
      new THREE.MeshStandardMaterial({
        map: cloudMap,
        transparent: true,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
      })
    );
    clouds.userData.kind = 'clouds';
    if (mode === 'real') clouds.scale.setScalar(r / data.radius);
    group.add(clouds);
  }

  if (resolveRingConfig(data)) {
    const ringGroup = createRingSystem(data, 1);
    ringGroup.userData.kind = 'rings';
    ringGroup.scale.setScalar(mode === 'real' ? r : data.radius);
    group.add(ringGroup);
  }

  return { group, mesh, clouds };
}

function buildMoonGeometry(m: MoonData, mode: ScaleMode, loader: THREE.TextureLoader): THREE.SphereGeometry {
  void loader;
  // Fase 4.2: 16 segs (was 24) — moons are tiny on screen, ~55% fewer tris.
  return new THREE.SphereGeometry(moonRadius(m, mode), 16, 16);
}

function createMoonMesh(m: MoonData, mode: ScaleMode, loader: THREE.TextureLoader): THREE.Mesh {
  const mat = m.texture
    ? texturedMaterial(m.texture, loader)
    : new THREE.MeshStandardMaterial({
        color: m.color,
        roughness: 0.9,
        metalness: 0.05,
        emissive: new THREE.Color(m.color).multiplyScalar(0.08),
      });
  const mesh = new THREE.Mesh(buildMoonGeometry(m, mode, loader), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Procedural ring texture: soft bands + Cassini division. */
function makeRingTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 8;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  let seed = 42;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1);
    // base bands
    let alpha = 0.25 + 0.65 * Math.abs(Math.sin(t * 21 + 1.2)) * (0.5 + 0.5 * Math.sin(t * 7.3));
    // Cassini division: transparent gap
    if (t > 0.6 && t < 0.68) alpha *= 0.08;
    if (t < 0.06) alpha *= t / 0.06; // soft inner edge
    if (t > 0.97) alpha *= (1 - t) / 0.03; // soft outer edge
    const shade = 190 + Math.floor(rand() * 50);
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      img.data[i] = shade;
      img.data[i + 1] = shade - 25;
      img.data[i + 2] = shade - 70;
      img.data[i + 3] = Math.max(0, Math.min(255, Math.floor(alpha * 255)));
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let ringTexture: THREE.CanvasTexture | null = null;

/** Legacy Saturn look, kept as the fallback default (75° ≈ PI/2.4 tilt, full opacity). */
export const SATURN_RING_DEFAULT: RingConfig = {
  inner: 1.3,
  outer: 2.2,
  opacity: 1,
  tiltXDeg: 75,
  followTilt: false,
};

/** Ring config for a planet, or null when ringless. Pure — unit-testable. */
export function resolveRingConfig(data: PlanetData): RingConfig | null {
  return data.rings ?? null;
}

/** Generic ring system reusing the procedural Saturn ring texture (Fase 2.3). */
function createRingSystem(data: PlanetData, unitRadius: number): THREE.Group {
  const cfg = resolveRingConfig(data) ?? SATURN_RING_DEFAULT;
  const group = new THREE.Group();

  const ringInner = unitRadius * cfg.inner;
  const ringOuter = unitRadius * cfg.outer;

  const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 128, 1);
  // radial UVs: u = fraction across ring, v = middle of texture strip
  const posAttr = ringGeo.attributes.position;
  const uvAttr = ringGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const rad = Math.sqrt(x * x + y * y);
    const t = (rad - ringInner) / (ringOuter - ringInner);
    uvAttr.setXY(i, t, 0.5);
  }
  uvAttr.needsUpdate = true;

  if (!ringTexture) ringTexture = makeRingTexture();

  const ringMat = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    opacity: cfg.opacity,
  });

  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = THREE.MathUtils.degToRad(cfg.tiltXDeg);
  ring.receiveShadow = true;
  group.add(ring);

  // Uranus: ring plane rolls with the planet axial tilt → upright rings.
  if (cfg.followTilt) group.rotation.z = THREE.MathUtils.degToRad(data.axialTilt);

  return group;
}

function createOrbitLine(
  data: PlanetData,
  mode: ScaleMode,
  positionMode: PositionMode = 'artistic',
  dateMs: number = Date.now()
): THREE.Line {
  // Mode real: elips JPL sejati — planet menempel persis (fix Pluto terlempar).
  if (positionMode === 'real' && hasEphemeris(data.name)) {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      realOrbitPoints(data.name, dateMs, currentDistance(data, mode))
    );
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
  }
  const a = currentDistance(data, mode);
  const b = a * Math.sqrt(Math.max(0.05, 1 - data.eccentricity * data.eccentricity));
  const curve = new THREE.EllipseCurve(0, 0, a, b, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(256);
  // artistic melebihkan inklinasi 3x agar terlihat; real pakai nilai benar
  const inc = THREE.MathUtils.degToRad(data.inclination * (positionMode === 'real' ? 1 : 3));
  const c = a * data.eccentricity;
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((p) => new THREE.Vector3(p.x - c, -p.y * Math.sin(inc), p.y * Math.cos(inc)))
  );

  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.12,
  });

  return new THREE.Line(geometry, material);
}

function createMoonOrbit(m: MoonData, mode: ScaleMode): THREE.Line {
  const r = moonDistance(m, mode);
  const curve = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(128);
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, 0, p.y)));
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
  });
  return new THREE.Line(geometry, material);
}

function createLabel(data: PlanetData, r: number): CSS2DObject {
  const div = document.createElement('div');
  div.className = 'planet-label';
  div.textContent = data.name;
  const obj = new CSS2DObject(div);
  obj.position.set(0, r + Math.max(2, r * 0.35), 0);
  return obj;
}
