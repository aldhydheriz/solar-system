import { PLANETS } from './planetData';

/** Ms between tour stops — enough to read the caption + hear TTS. */
export const TOUR_STEP_MS = 6000;

export interface TourStop {
  index: number;
  name: string;
  /** 1-based position in the tour, e.g. 3 of 9 */
  position: number;
  total: number;
  /** Short narration line shown in the caption + spoken via TTS. */
  text: string;
  /** "3 / 9" style progress label. */
  progress: string;
}

/** Ordered tour names: Mercury … Pluto (all 9 planets). */
export function tourOrder(): string[] {
  return PLANETS.map((p) => p.name);
}

/** Where to start: nearest to the current nav selection, else Mercury. */
export function tourStartIndex(activeName: string | null): number {
  if (!activeName) return 0;
  const i = PLANETS.findIndex((p) => p.name === activeName);
  return i >= 0 ? i : 0;
}

/** Narration text for one stop: name + one-line fact. */
export function tourTextFor(name: string): string | null {
  const hit = PLANETS.find((p) => p.name === name);
  if (!hit) return null;
  const fact = hit.desc.split('. ')[0] ?? hit.desc;
  const factLine = fact.endsWith('.') ? fact : `${fact}.`;
  return `${hit.name} — ${factLine} ${hit.stats.distance} from the Sun, ${hit.stats.diameter} wide.`;
}

/** Full stop payload for a raw index (wraps around). Returns null for unknown. */
export function tourStopAt(index: number): TourStop | null {
  const total = PLANETS.length;
  if (total === 0) return null;
  const norm = ((index % total) + total) % total;
  const planet = PLANETS[norm];
  const text = tourTextFor(planet.name);
  if (!text) return null;
  return {
    index: norm,
    name: planet.name,
    position: norm + 1,
    total,
    text,
    progress: `${norm + 1} / ${total}`,
  };
}

/** Step forward/backward with wraparound. */
export function tourStep(index: number, dir: 1 | -1 = 1): TourStop | null {
  return tourStopAt(index + dir);
}
