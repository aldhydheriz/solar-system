import * as THREE from 'three';

/**
 * Fase 3.1 — Real positions mode (pendekatan JPL Keplerian elements).
 *
 * Sumber: JPL "Keplerian Elements for Approximate Positions of the Major
 * Planets" (https://ssd.jpl.nasa.gov/planets/approx_pos.html), valid
 * 1800–2050. Tabel di bawah = nilai J2000 + laju per Julian century.
 *
 * Pendekatan: elemen oskulasi → anomali rata-rata M = L − ϖ →
 * selesaikan Kepler E → anomali benar → koordinat ekliptika heliosentris.
 * Akurasi beberapa derajat untuk planet dalam, <1° untuk raksasa gas
 * dalam rentang valid — cukup untuk mode edukasi "posisi benar".
 */

export interface JplElements {
  /** semi-major axis (AU) */
  a: number;
  /** eccentricity */
  e: number;
  /** inclination (deg) */
  I: number;
  /** mean longitude (deg) */
  L: number;
  /** longitude of perihelion (deg) */
  lp: number;
  /** longitude of ascending node (deg) */
  node: number;
}

export interface JplRates {
  a: number;
  e: number;
  I: number;
  L: number;
  lp: number;
  node: number;
}

interface JplRow {
  elements: JplElements;
  rates: JplRates;
}

/** J2000 = 2000-01-01 12:00 TT ≈ 12:00 UTC (beda <2 mnt, diabaikan). */
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
export const MS_PER_CENTURY = 36525 * 86400e3;

const ROWS: Record<string, JplRow> = {
  Mercury: {
    elements: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.2503235, lp: 77.45779628, node: 48.33076593 },
    rates: { a: 0.00000037, e: 0.00001906, I: -0.00594749, L: 149472.67411175, lp: 0.16047689, node: -0.12534081 },
  },
  Venus: {
    elements: { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.9790995, lp: 131.60246718, node: 76.67984255 },
    rates: { a: 0.0000039, e: -0.00004107, I: -0.0007889, L: 58517.81538729, lp: 0.00268329, node: -0.27769418 },
  },
  Earth: {
    elements: { a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, lp: 102.93768193, node: 0 },
    rates: { a: 0.00000562, e: -0.00004392, I: -0.01294668, L: 35999.37244981, lp: 0.32327364, node: 0 },
  },
  Mars: {
    elements: { a: 1.52371034, e: 0.0933941, I: 1.84969142, L: -4.55343205, lp: -23.94362959, node: 49.55953891 },
    rates: { a: 0.00001847, e: 0.00007882, I: -0.00813131, L: 19140.30268499, lp: 0.44441088, node: -0.29257343 },
  },
  Jupiter: {
    elements: { a: 5.202887, e: 0.04838624, I: 1.30439695, L: 34.39644051, lp: 14.72847983, node: 100.47390909 },
    rates: { a: -0.00011607, e: -0.00013253, I: -0.00183714, L: 3034.74612775, lp: 0.21252668, node: 0.20469106 },
  },
  Saturn: {
    elements: { a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, lp: 92.59887831, node: 113.66242448 },
    rates: { a: -0.0012506, e: -0.00050991, I: 0.00193609, L: 1222.49362201, lp: -0.41897216, node: -0.28867794 },
  },
  Uranus: {
    elements: { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, lp: 170.9642763, node: 74.01692503 },
    rates: { a: -0.00196176, e: -0.00004397, I: -0.00242939, L: 428.48202785, lp: 0.40805281, node: 0.04240589 },
  },
  Neptune: {
    elements: { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, lp: 44.96476227, node: 131.78422574 },
    rates: { a: 0.00026291, e: 0.00005105, I: 0.00035372, L: 218.45945325, lp: -0.32241464, node: -0.00508664 },
  },
  Pluto: {
    elements: { a: 39.48294747, e: 0.24882572, I: 17.14175056, L: 238.92903833, lp: 224.06891629, node: 110.30393684 },
    rates: { a: -0.00031596, e: 0.0000517, I: 0.00004818, L: 145.20780515, lp: -0.04062942, node: -0.01183482 },
  },
};

export function hasEphemeris(name: string): boolean {
  return name in ROWS;
}

/** Julian centuries sejak J2000 untuk timestamp ms. */
export function julianCenturies(dateMs: number): number {
  return (dateMs - J2000_MS) / MS_PER_CENTURY;
}

/** Elemen oskulasi planet pada tanggal tertentu. Murni. */
export function elementsAt(name: string, dateMs: number): JplElements {
  const row = ROWS[name];
  if (!row) throw new Error(`No JPL elements for ${name}`);
  const T = julianCenturies(dateMs);
  const e = row.elements;
  const r = row.rates;
  return {
    a: e.a + r.a * T,
    e: e.e + r.e * T,
    I: e.I + r.I * T,
    L: e.L + r.L * T,
    lp: e.lp + r.lp * T,
    node: e.node + r.node * T,
  };
}

function norm360(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** Selesaikan Kepler M = E − e·sinE (M, E dalam radian). Newton, ~6 iterasi. Murni. */
export function solveKepler(meanAnomalyRad: number, e: number): number {
  let E = meanAnomalyRad + e * Math.sin(meanAnomalyRad);
  for (let i = 0; i < 8; i++) {
    const f = E - e * Math.sin(E) - meanAnomalyRad;
    const fp = 1 - e * Math.cos(E);
    E -= f / fp;
  }
  return E;
}

export interface HelioCoords {
  /** J2000 ecliptic Cartesian, AU */
  x: number;
  y: number;
  z: number;
  /** heliocentric distance, AU */
  radiusAU: number;
  /** ecliptic longitude, deg [0,360) */
  longitudeDeg: number;
  /** ecliptic latitude, deg */
  latitudeDeg: number;
}

/** Posisi heliosentris ekliptika J2000 (AU). Murni — inti unit-test Fase 3.1. */
export function heliocentric(name: string, dateMs: number): HelioCoords {
  const el = elementsAt(name, dateMs);
  const Mdeg = norm360(el.L - el.lp);
  const wDeg = norm360(el.lp - el.node);
  const M = THREE.MathUtils.degToRad(Mdeg);
  const w = THREE.MathUtils.degToRad(wDeg);
  const Om = THREE.MathUtils.degToRad(el.node);
  const I = THREE.MathUtils.degToRad(el.I);

  const E = solveKepler(M, el.e);
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(Math.max(0, 1 - el.e * el.e)) * Math.sin(E);

  // anomali benar + radius
  const v = Math.atan2(yp, xp);
  const r = Math.hypot(xp, yp);
  const vw = v + w;
  const cosOm = Math.cos(Om);
  const sinOm = Math.sin(Om);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);

  const x = r * (cosOm * Math.cos(vw) - sinOm * Math.sin(vw) * cosI);
  const y = r * (sinOm * Math.cos(vw) + cosOm * Math.sin(vw) * cosI);
  const z = r * (Math.sin(vw) * sinI);

  return {
    x,
    y,
    z,
    radiusAU: r,
    longitudeDeg: norm360(THREE.MathUtils.radToDeg(Math.atan2(y, x))),
    latitudeDeg: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(z / r, -1, 1))),
  };
}

/**
 * Petakan posisi ekliptika ke scene: arah dipertahankan, jarak diskalakan
 * sehingga semi-major axis AU → `sceneSemiMajor` (jarak stylized/real scene).
 * Mapping sumbu: ecl (x, y, z→utara) ⇒ scene (x, z_utara, y).
 * Murni — arah scene = bujur ekliptika, cocok dengan orbitPosition artistik
 * (sudut m dari +X ke +Z).
 */
export function realScenePosition(
  name: string,
  dateMs: number,
  sceneSemiMajor: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const helio = heliocentric(name, dateMs);
  const el = elementsAt(name, dateMs);
  const k = sceneSemiMajor / el.a;
  return out.set(helio.x * k, helio.z * k, helio.y * k);
}

/**
 * Titik-titik elips orbit SEJATI (orientasi JPL penuh: Ω, I, ω) dalam
 * koordinat scene. Satu revolusi penuh disample lewat anomali eksentrik
 * E 0..2π — matematika rotasi SAMA dengan `heliocentric()`, sehingga posisi
 * planet pada tanggal berapa pun menempel persis di kurva ini.
 * Murni — dipakai factory untuk garis orbit mode real.
 */
export function realOrbitPoints(name: string, dateMs: number, sceneSemiMajor: number, segments = 256): THREE.Vector3[] {
  const el = elementsAt(name, dateMs);
  const w = THREE.MathUtils.degToRad((((el.lp - el.node) % 360) + 360) % 360);
  const Om = THREE.MathUtils.degToRad(el.node);
  const I = THREE.MathUtils.degToRad(el.I);
  const b = el.a * Math.sqrt(Math.max(0.05, 1 - el.e * el.e));
  const k = sceneSemiMajor / el.a;
  const cosOm = Math.cos(Om);
  const sinOm = Math.sin(Om);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const E = (i / segments) * Math.PI * 2;
    const xp = el.a * (Math.cos(E) - el.e);
    const yp = b * Math.sin(E);
    const v = Math.atan2(yp, xp);
    const r = Math.hypot(xp, yp);
    const vw = v + w;
    const x = r * (cosOm * Math.cos(vw) - sinOm * Math.sin(vw) * cosI);
    const y = r * (sinOm * Math.cos(vw) + cosOm * Math.sin(vw) * cosI);
    const z = r * (Math.sin(vw) * sinI);
    pts.push(new THREE.Vector3(x * k, z * k, y * k));
  }
  return pts;
}
