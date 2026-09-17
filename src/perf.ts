/**
 * Perf budget helpers (Fase 4.2). All pure + unit-testable, no DOM/three imports.
 *
 * Budget (roadmap 4.2):
 * - LCP < 3s (cold, mid laptop)
 * - GPU < 150 MB (textures + shadow cube + render targets)
 * - 60fps mode High (≈55+ sustained) / 30fps mode Low (≈28+ sustained)
 */

/** Roadmap 4.2 budget constants. */
export const PERF_BUDGET = {
  /** Largest Contentful Paint target, ms. */
  lcpMs: 3000,
  /** GPU memory ceiling, MB. */
  gpuMB: 150,
  /** Sustained fps floor for High mode (bloom + shadows + animated sun). */
  fpsHigh: 55,
  /** Sustained fps floor for Low mode (no bloom, no shadows, static sun). */
  fpsLow: 28,
  /** JS bundle (gzipped) ceiling, KB — keeps parse+eval < ~1s on mid laptops. */
  jsGzipKB: 200,
  /** PWA precache ceiling, MB — offline install stays light. */
  precacheMB: 5,
} as const;

/** Point-light shadow maps are cube maps: 6 faces × size² × RGBA8. */
export function shadowCubeMB(sizePx: number): number {
  return (6 * sizePx * sizePx * 4) / (1024 * 1024);
}

/** GPU cost of one RGBA8 texture with mipmaps (≈4/3 × base level). */
export function textureGpuMB(width: number, height: number, bytesPerPixel = 4): number {
  if (width <= 0 || height <= 0) return 0;
  return (width * height * bytesPerPixel * (4 / 3)) / (1024 * 1024);
}

/** Sum GPU cost of a list of textures. */
export function texturesGpuMB(textures: Array<{ w: number; h: number }>): number {
  return textures.reduce((sum, t) => sum + textureGpuMB(t.w, t.h), 0);
}

export interface GpuEstimateInput {
  textures: Array<{ w: number; h: number }>;
  /** Point-light shadow map edge size (0 when shadows off / Low mode). */
  shadowMapSize: number;
  /**
   * Fullscreen-equivalent HDR composer buffers. The render target counts as
   * 1; the UnrealBloomPass mip chain folds into ≈1 more (each mip is
   * 1/4 the previous), so High mode ≈ 2, Low (bloom off) ≈ 1.
   */
  renderTargets: number;
  /** Viewport used for the estimate. */
  viewportW: number;
  viewportH: number;
  /** Device pixel ratio already capped (e.g. 1.5). */
  pixelRatio: number;
}

/**
 * Rough GPU estimate: textures + shadow cube + fullscreen render targets
 * (RGBA16F-ish ≈ 8 bytes/px for HDR composer buffers).
 */
export function estimateGpuMB(input: GpuEstimateInput): number {
  const tex = texturesGpuMB(input.textures);
  const shadow = input.shadowMapSize > 0 ? shadowCubeMB(input.shadowMapSize) : 0;
  const px = input.viewportW * input.pixelRatio * input.viewportH * input.pixelRatio;
  const targets = (px * 8 * input.renderTargets) / (1024 * 1024);
  return tex + shadow + targets;
}

/** True when the estimate fits the <150MB budget. */
export function meetsGpuBudget(input: GpuEstimateInput): boolean {
  return estimateGpuMB(input) <= PERF_BUDGET.gpuMB;
}

/** Rolling FPS meter over the last N frames. */
export class FpsMeter {
  private deltas: number[] = [];
  constructor(private readonly window = 120) {}

  push(dtSeconds: number): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    this.deltas.push(dtSeconds);
    if (this.deltas.length > this.window) this.deltas.shift();
  }

  get samples(): number {
    return this.deltas.length;
  }

  /** Mean fps over the window, 0 when empty. */
  avgFps(): number {
    if (this.deltas.length === 0) return 0;
    const sum = this.deltas.reduce((a, b) => a + b, 0);
    return this.deltas.length / sum;
  }

  /** Worst 1% approx: mean of the slowest 5 frames (jank indicator). */
  p95FrameMs(): number {
    if (this.deltas.length === 0) return 0;
    const sorted = [...this.deltas].sort((a, b) => b - a);
    const k = Math.max(1, Math.min(5, sorted.length));
    return (sorted.slice(0, k).reduce((a, b) => a + b, 0) / k) * 1000;
  }
}

/** Sustained-fps check: needs a full window before passing. */
export function meetsFpsBudget(meter: FpsMeter, mode: 'high' | 'low'): boolean {
  if (meter.samples < 60) return false;
  return meter.avgFps() >= (mode === 'high' ? PERF_BUDGET.fpsHigh : PERF_BUDGET.fpsLow);
}

/**
 * Auto-drop suggestion: sustained High-mode fps below the Low floor means
 * even Low may struggle — caller should offer/nudge Low quality.
 * Pure decision helper; main.ts owns the actual quality switch.
 */
export function shouldSuggestLowQuality(avgFpsHigh: number, sustainedSec: number): boolean {
  return sustainedSec >= 3 && avgFpsHigh > 0 && avgFpsHigh < PERF_BUDGET.fpsLow;
}
