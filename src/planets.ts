import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import mercuryMap from './assets/textures/mercurymap.jpg';
import venusMap from './assets/textures/venusmap.jpg';
import earthMap from './assets/textures/earthmap1k.jpg';
import earthCloudsMap from './assets/textures/earthcloudmaptrans.jpg';
import marsMap from './assets/textures/marsmap1k.jpg';
import jupiterMap from './assets/textures/jupitermap.jpg';
import saturnMap from './assets/textures/saturnmap.jpg';
import uranusMap from './assets/textures/uranusmap.jpg';
import neptuneMap from './assets/textures/neptunemap.jpg';
import moonMap from './assets/textures/moonmap1k.jpg';

export type ScaleMode = 'stylized' | 'real';

export interface MoonData {
  name: string;
  radius: number; // stylized scene units
  realRadius: number;
  distance: number; // orbit radius around planet, stylized
  realDistance: number;
  speed: number;
  color: number;
  texture?: string;
  infoDiameter: string;
  infoDistance: string;
  blurb: string;
}

export interface PlanetStats {
  diameter: string;
  distance: string;
  period: string;
  day: string;
  moons: string;
}

export interface PlanetData {
  name: string;
  radius: number; // stylized
  realRadius: number; // proportional to Sun (6x boost, min-clamped)
  distance: number; // stylized semi-major axis
  realDistance: number; // spread-out "true order" distances
  speed: number;
  rotationSpeed: number;
  color: number;
  texture?: string;
  cloudsTexture?: string;
  hasRings: boolean;
  /** orbit inclination in degrees (real values) */
  inclination: number;
  /** orbit eccentricity (real values) */
  eccentricity: number;
  /** axial tilt in degrees */
  axialTilt: number;
  moons: MoonData[];
  stats: PlanetStats;
  desc: string;
  // runtime cache (mutated by hover highlight)
  _baseEmissive?: THREE.Color;
  _isSun?: boolean;
}

/** Payload sent when a moon is selected (moons are not full PlanetData). */
export interface MoonPayload {
  _isMoon: true;
  _isSun?: false;
  name: string;
  color: number;
  parentName: string;
  diameter: string;
  distance: string;
  desc: string;
}

export type SelectPayload = PlanetData | MoonPayload;

export const SUN_DATA = {
  name: 'Sun',
  radius: 20,
  color: 0xffcc33,
  rotationSpeed: 0.0015,
  stats: {
    diameter: '1,392,700 km',
    distance: '0 km',
    period: '—',
    day: '~27 days',
    moons: '8 planets'
  },
  desc: "The star at the center of our Solar System, containing 99.86% of the system's mass. Its core burns at 15 million °C, fusing hydrogen into helium."
};

export const PLANETS: PlanetData[] = [
  {
    name: 'Mercury',
    radius: 2,
    realRadius: 0.5,
    distance: 40,
    realDistance: 45,
    speed: 0.4,
    rotationSpeed: 0.004,
    color: 0x9c8e85,
    texture: mercuryMap,
    hasRings: false,
    inclination: 7.0,
    eccentricity: 0.205,
    axialTilt: 0.03,
    moons: [],
    stats: { diameter: '4,879 km', distance: '57.9M km', period: '88 days', day: '59 days', moons: '0' },
    desc: 'The smallest planet and closest to the Sun. A cratered world with extreme temperature swings.'
  },
  {
    name: 'Venus',
    radius: 3.5,
    realRadius: 1.0,
    distance: 60,
    realDistance: 65,
    speed: 0.3,
    rotationSpeed: 0.002,
    color: 0xe8cda0,
    texture: venusMap,
    hasRings: false,
    inclination: 3.39,
    eccentricity: 0.007,
    axialTilt: 177.4,
    moons: [],
    stats: { diameter: '12,104 km', distance: '108.2M km', period: '225 days', day: '243 days', moons: '0' },
    desc: 'Hottest planet with a thick CO2 atmosphere and crushing pressure. Spins backwards.'
  },
  {
    name: 'Earth',
    radius: 3.8,
    realRadius: 1.1,
    distance: 85,
    realDistance: 90,
    speed: 0.25,
    rotationSpeed: 0.01,
    color: 0x4d7dd1,
    texture: earthMap,
    cloudsTexture: earthCloudsMap,
    hasRings: false,
    inclination: 0,
    eccentricity: 0.017,
    axialTilt: 23.4,
    moons: [
      { name: 'Moon', radius: 1.0, realRadius: 0.3, distance: 7.5, realDistance: 4.5, speed: 1.6, color: 0xcccccc, texture: moonMap, infoDiameter: '3,474 km', infoDistance: '384,400 km', blurb: "Stabilizes Earth's tilt and drives ocean tides." }
    ],
    stats: { diameter: '12,742 km', distance: '149.6M km', period: '365.25 days', day: '24 hours', moons: '1' },
    desc: 'Our home. The only known planet with life, liquid water oceans, and an oxygen atmosphere.'
  },
  {
    name: 'Mars',
    radius: 2.8,
    realRadius: 0.6,
    distance: 110,
    realDistance: 120,
    speed: 0.2,
    rotationSpeed: 0.009,
    color: 0xc1442e,
    texture: marsMap,
    hasRings: false,
    inclination: 1.85,
    eccentricity: 0.093,
    axialTilt: 25.2,
    moons: [
      { name: 'Phobos', radius: 0.45, realRadius: 0.2, distance: 5.2, realDistance: 2.8, speed: 2.6, color: 0xaa8a7a, infoDiameter: '22 km', infoDistance: '9,376 km', blurb: 'A cratered captured asteroid, slowly spiraling toward Mars.' },
      { name: 'Deimos', radius: 0.35, realRadius: 0.15, distance: 6.8, realDistance: 3.8, speed: 1.9, color: 0x99887d, infoDiameter: '12 km', infoDistance: '23,463 km', blurb: 'Tiny outer moon of Mars, one of the smallest known moons.' }
    ],
    stats: { diameter: '6,779 km', distance: '227.9M km', period: '687 days', day: '24.6 hours', moons: '2' },
    desc: 'The Red Planet. Home to Olympus Mons, the tallest volcano, and Valles Marineris canyon.'
  },
  {
    name: 'Jupiter',
    radius: 12,
    realRadius: 12.0,
    distance: 160,
    realDistance: 180,
    speed: 0.12,
    rotationSpeed: 0.02,
    color: 0xd8a06a,
    texture: jupiterMap,
    hasRings: false,
    inclination: 1.3,
    eccentricity: 0.049,
    axialTilt: 3.1,
    moons: [
      { name: 'Io', radius: 0.9, realRadius: 0.5, distance: 17, realDistance: 17, speed: 2.2, color: 0xe8d44d, infoDiameter: '3,643 km', infoDistance: '421,700 km', blurb: 'The most volcanically active world in the solar system.' },
      { name: 'Europa', radius: 0.8, realRadius: 0.45, distance: 20, realDistance: 20, speed: 1.7, color: 0xdde4e6, infoDiameter: '3,122 km', infoDistance: '671,000 km', blurb: 'Icy crust hiding a global salty ocean — a top bet for life.' },
      { name: 'Ganymede', radius: 1.3, realRadius: 0.7, distance: 24, realDistance: 24, speed: 1.3, color: 0xa89880, infoDiameter: '5,268 km', infoDistance: '1,070,400 km', blurb: 'Largest moon in the solar system, bigger than Mercury.' },
      { name: 'Callisto', radius: 1.2, realRadius: 0.65, distance: 28, realDistance: 28, speed: 1.0, color: 0x7a756e, infoDiameter: '4,821 km', infoDistance: '1,882,700 km', blurb: 'Ancient, heavily cratered ice world.' }
    ],
    stats: { diameter: '139,820 km', distance: '778.5M km', period: '11.9 years', day: '9.9 hours', moons: '95' },
    desc: 'Largest planet. A gas giant with the Great Red Spot storm raging for centuries. Showing 4 Galilean moons.'
  },
  {
    name: 'Saturn',
    radius: 10,
    realRadius: 10.0,
    distance: 210,
    realDistance: 240,
    speed: 0.09,
    rotationSpeed: 0.018,
    color: 0xe3cfa5,
    texture: saturnMap,
    hasRings: true,
    inclination: 2.49,
    eccentricity: 0.057,
    axialTilt: 26.7,
    moons: [
      { name: 'Titan', radius: 1.3, realRadius: 0.7, distance: 22, realDistance: 22, speed: 1.1, color: 0xd8a848, infoDiameter: '5,150 km', infoDistance: '1,221,870 km', blurb: 'Thick nitrogen atmosphere with lakes of liquid methane.' },
      { name: 'Rhea', radius: 0.7, realRadius: 0.4, distance: 26, realDistance: 26, speed: 0.8, color: 0xb8b4ac, infoDiameter: '1,527 km', infoDistance: '527,000 km', blurb: 'Icy moon with wispy bright streaks.' }
    ],
    stats: { diameter: '116,460 km', distance: '1.43B km', period: '29.4 years', day: '10.7 hours', moons: '146' },
    desc: 'Famous for its spectacular ice rings. A gas giant less dense than water. Showing Titan and Rhea.'
  },
  {
    name: 'Uranus',
    radius: 7,
    realRadius: 4.4,
    distance: 260,
    realDistance: 290,
    speed: 0.06,
    rotationSpeed: 0.012,
    color: 0x8fd1d4,
    texture: uranusMap,
    hasRings: false,
    inclination: 0.77,
    eccentricity: 0.046,
    axialTilt: 97.8,
    moons: [
      { name: 'Titania', radius: 0.8, realRadius: 0.45, distance: 12, realDistance: 9, speed: 1.0, color: 0xa09a90, infoDiameter: '1,578 km', infoDistance: '435,910 km', blurb: 'Largest moon of Uranus with huge canyon systems.' }
    ],
    stats: { diameter: '50,724 km', distance: '2.87B km', period: '84 years', day: '17.2 hours', moons: '28' },
    desc: 'Ice giant tilted on its side, rolling around the Sun. Coldest atmosphere at -224°C.'
  },
  {
    name: 'Neptune',
    radius: 6.8,
    realRadius: 4.2,
    distance: 310,
    realDistance: 340,
    speed: 0.05,
    rotationSpeed: 0.011,
    color: 0x4a6dd1,
    texture: neptuneMap,
    hasRings: false,
    inclination: 1.77,
    eccentricity: 0.011,
    axialTilt: 28.3,
    moons: [
      { name: 'Triton', radius: 0.8, realRadius: 0.45, distance: 11.5, realDistance: 8.5, speed: -1.2, color: 0xc4c9cc, infoDiameter: '2,707 km', infoDistance: '354,759 km', blurb: 'Captured Kuiper object with nitrogen geysers; orbits backwards.' }
    ],
    stats: { diameter: '49,244 km', distance: '4.50B km', period: '164.8 years', day: '16.1 hours', moons: '16' },
    desc: 'Farthest planet. Supersonic winds up to 2,100 km/h rage in its deep blue atmosphere.'
  }
];

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
  labelsVisible: boolean;
  update(orbitTime: number, timeScale: number, delta: number): void;
  setScaleMode(mode: ScaleMode): void;
  setLabelsVisible(v: boolean): void;
}

export function currentRadius(d: PlanetData, mode: ScaleMode): number {
  return mode === 'real' ? d.realRadius : d.radius;
}

export function currentDistance(d: PlanetData, mode: ScaleMode): number {
  return mode === 'real' ? d.realDistance : d.distance;
}

export function moonRadius(m: MoonData, mode: ScaleMode): number {
  return mode === 'real' ? m.realRadius : m.radius;
}

export function moonDistance(m: MoonData, mode: ScaleMode): number {
  return mode === 'real' ? m.realDistance : m.distance;
}

function srgb(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Position on an inclined elliptical orbit. m = mean anomaly. */
function orbitPosition(a: number, e: number, inclinationDeg: number, m: number, out: THREE.Vector3): THREE.Vector3 {
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
  let labelsVisible = true;

  const loader = new THREE.TextureLoader();

  PLANETS.forEach((data) => {
    const { group: planetGroup, mesh, clouds } = createPlanet(data, scaleMode, loader);
    const orbitLine = createOrbitLine(data, scaleMode);

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
      clouds
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
      const newLine = createOrbitLine(p.data, mode);
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
    planets.forEach((p) => { p.label.visible = v; });
  }

  const solarSystem: SolarSystem = {
    systemGroup,
    planets,
    orbitLines,
    scaleMode,
    labelsVisible,
    update(orbitTime: number, timeScale: number, delta: number) {
      const frame = delta * 60;
      planets.forEach((p) => {
        const a = currentDistance(p.data, scaleMode);
        const m = p.angle + orbitTime * p.data.speed * 2;
        orbitPosition(a, p.data.eccentricity, p.data.inclination, m, tmp);
        p.group.position.copy(tmp);
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
    setLabelsVisible
  };

  return solarSystem;
}

function texturedMaterial(mapUrl: string, loader: THREE.TextureLoader, opts?: { roughness?: number }): THREE.MeshStandardMaterial {
  const map = srgb(loader.load(mapUrl));
  return new THREE.MeshStandardMaterial({
    map,
    roughness: opts?.roughness ?? 0.9,
    metalness: 0.05,
    // emissiveMap = same texture so hover-highlight keeps surface detail
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: 0.08
  });
}

function createPlanet(data: PlanetData, mode: ScaleMode, loader: THREE.TextureLoader): { group: THREE.Group; mesh: THREE.Mesh; clouds: THREE.Mesh | null } {
  const group = new THREE.Group();
  const r = currentRadius(data, mode);

  const mat = data.texture
    ? texturedMaterial(data.texture, loader)
    : new THREE.MeshStandardMaterial({
        color: data.color,
        roughness: 0.8,
        metalness: 0.1,
        emissive: new THREE.Color(data.color).multiplyScalar(0.08)
      });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, 48, 48), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (mode === 'real') mesh.scale.setScalar(r / data.radius);
  mesh.rotation.z = THREE.MathUtils.degToRad(data.axialTilt);
  group.add(mesh);

  let clouds: THREE.Mesh | null = null;
  if (data.cloudsTexture) {
    const cloudMap = srgb(loader.load(data.cloudsTexture));
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(data.radius * 1.02, 48, 48),
      new THREE.MeshStandardMaterial({
        map: cloudMap,
        transparent: true,
        depthWrite: false,
        roughness: 1,
        metalness: 0
      })
    );
    clouds.userData.kind = 'clouds';
    if (mode === 'real') clouds.scale.setScalar(r / data.radius);
    group.add(clouds);
  }

  if (data.hasRings) {
    const ringGroup = createSaturnRings(1);
    ringGroup.userData.kind = 'rings';
    ringGroup.scale.setScalar(mode === 'real' ? r : data.radius);
    group.add(ringGroup);
  }

  return { group, mesh, clouds };
}

function buildMoonGeometry(m: MoonData, mode: ScaleMode, loader: THREE.TextureLoader): THREE.SphereGeometry {
  void loader;
  return new THREE.SphereGeometry(moonRadius(m, mode), 24, 24);
}

function createMoonMesh(m: MoonData, mode: ScaleMode, loader: THREE.TextureLoader): THREE.Mesh {
  const mat = m.texture
    ? texturedMaterial(m.texture, loader)
    : new THREE.MeshStandardMaterial({
        color: m.color,
        roughness: 0.9,
        metalness: 0.05,
        emissive: new THREE.Color(m.color).multiplyScalar(0.08)
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
    if (t > 0.60 && t < 0.68) alpha *= 0.08;
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

function createSaturnRings(unitRadius: number): THREE.Group {
  const group = new THREE.Group();

  const ringInner = unitRadius * 1.3;
  const ringOuter = unitRadius * 2.2;

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
    depthWrite: false
  });

  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2.4;
  ring.receiveShadow = true;
  group.add(ring);

  return group;
}

function createOrbitLine(data: PlanetData, mode: ScaleMode): THREE.Line {
  const a = currentDistance(data, mode);
  const b = a * Math.sqrt(Math.max(0.05, 1 - data.eccentricity * data.eccentricity));
  const curve = new THREE.EllipseCurve(0, 0, a, b, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(256);
  const inc = THREE.MathUtils.degToRad(data.inclination * 3);
  const c = a * data.eccentricity;
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((p) => new THREE.Vector3(p.x - c, -p.y * Math.sin(inc), p.y * Math.cos(inc)))
  );

  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.12
  });

  return new THREE.Line(geometry, material);
}

function createMoonOrbit(m: MoonData, mode: ScaleMode): THREE.Line {
  const r = moonDistance(m, mode);
  const curve = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(128);
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((p) => new THREE.Vector3(p.x, 0, p.y))
  );
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18
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
