import type * as THREE from 'three';

export type ScaleMode = 'stylized' | 'real';

/** Fase 3.1: artistic = fase sudut acak (lama), real = posisi JPL per tanggal. */
export type PositionMode = 'artistic' | 'real';

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

export interface RingConfig {
  /** inner edge in multiples of planet radius (> 1 so it never covers the planet) */
  inner: number;
  /** outer edge in multiples of planet radius */
  outer: number;
  /** material opacity: 1 = Saturn bold, < 0.5 = faint */
  opacity: number;
  /** ring plane tilt in degrees: 90 = equatorial flat, 75 = Saturn legacy look */
  tiltXDeg: number;
  /** rotate the ring system with the planet axial tilt (Uranus rolls on its side) */
  followTilt: boolean;
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
  nightTexture?: string;
  rings?: RingConfig | null;
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

export interface SunData {
  name: string;
  radius: number;
  color: number;
  rotationSpeed: number;
  stats: PlanetStats;
  desc: string;
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
