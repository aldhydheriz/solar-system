import raw from './data/planets.json';
import type { MoonData, PlanetData, PlanetStats, RingConfig, ScaleMode, SunData } from './planetTypes';

import mercuryMap from './assets/textures/mercurymap.jpg';
import venusMap from './assets/textures/venusmap.jpg';
import earthMap from './assets/textures/earthmap1k.jpg';
import earthCloudsMap from './assets/textures/earthcloudmaptrans.jpg';
import earthNightMap from './assets/textures/earthlights1k.jpg';
import marsMap from './assets/textures/marsmap1k.jpg';
import jupiterMap from './assets/textures/jupitermap.jpg';
import saturnMap from './assets/textures/saturnmap.jpg';
import uranusMap from './assets/textures/uranusmap.jpg';
import neptuneMap from './assets/textures/neptunemap.jpg';
import plutoMap from './assets/textures/plutomap1k.jpg';
import moonMap from './assets/textures/moonmap1k.jpg';

const TEXTURE_MAP: Record<string, string> = {
  'mercurymap.jpg': mercuryMap,
  'venusmap.jpg': venusMap,
  'earthmap1k.jpg': earthMap,
  'earthcloudmaptrans.jpg': earthCloudsMap,
  'earthlights1k.jpg': earthNightMap,
  'marsmap1k.jpg': marsMap,
  'jupitermap.jpg': jupiterMap,
  'saturnmap.jpg': saturnMap,
  'uranusmap.jpg': uranusMap,
  'neptunemap.jpg': neptuneMap,
  'plutomap1k.jpg': plutoMap,
  'moonmap1k.jpg': moonMap,
};

function hexToNumber(hex: string): number {
  return parseInt(hex.replace(/^#/, ''), 16);
}

function resolveTexture(file?: string): string | undefined {
  if (!file) return undefined;
  return TEXTURE_MAP[file] ?? file;
}

interface RawMoon {
  name: string;
  radius: number;
  realRadius: number;
  distance: number;
  realDistance: number;
  speed: number;
  color: string;
  texture?: string;
  infoDiameter: string;
  infoDistance: string;
  blurb: string;
}

interface RawPlanet {
  name: string;
  radius: number;
  realRadius: number;
  distance: number;
  realDistance: number;
  speed: number;
  rotationSpeed: number;
  color: string;
  texture?: string;
  cloudsTexture?: string;
  nightTexture?: string;
  rings?: RingConfig | null;
  inclination: number;
  eccentricity: number;
  axialTilt: number;
  moons: RawMoon[];
  stats: PlanetStats;
  desc: string;
}

interface RawRoot {
  sun: {
    name: string;
    radius: number;
    color: string;
    rotationSpeed: number;
    stats: PlanetStats;
    desc: string;
  };
  planets: RawPlanet[];
}

const data = raw as unknown as RawRoot;

function toMoon(m: RawMoon): MoonData {
  return {
    ...m,
    color: hexToNumber(m.color),
    texture: resolveTexture(m.texture),
  };
}

function toPlanet(p: RawPlanet): PlanetData {
  return {
    ...p,
    color: hexToNumber(p.color),
    texture: resolveTexture(p.texture),
    cloudsTexture: resolveTexture(p.cloudsTexture),
    nightTexture: resolveTexture(p.nightTexture),
    moons: (p.moons ?? []).map(toMoon),
  };
}

export const SUN_DATA: SunData = {
  ...data.sun,
  color: hexToNumber(data.sun.color),
};

export const PLANETS: PlanetData[] = data.planets.map(toPlanet);

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
