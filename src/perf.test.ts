import { describe, expect, it } from 'vitest';
import {
  FpsMeter,
  PERF_BUDGET,
  estimateGpuMB,
  meetsFpsBudget,
  meetsGpuBudget,
  shadowCubeMB,
  shouldSuggestLowQuality,
  textureGpuMB,
  texturesGpuMB,
} from './perf';

describe('perf budget (4.2)', () => {
  it('budget constants match the roadmap targets', () => {
    expect(PERF_BUDGET.lcpMs).toBe(3000);
    expect(PERF_BUDGET.gpuMB).toBe(150);
    expect(PERF_BUDGET.fpsHigh).toBe(55);
    expect(PERF_BUDGET.fpsLow).toBe(28);
  });

  it('shadow cube math: 2048px ≈ 96MiB, 1024px ≈ 24MiB', () => {
    expect(shadowCubeMB(2048)).toBeCloseTo(96, 0);
    expect(shadowCubeMB(1024)).toBeCloseTo(24, 0);
    // the 4.2 optimization (2048 → 1024) frees ~75MB
    expect(shadowCubeMB(2048) - shadowCubeMB(1024)).toBeGreaterThan(70);
  });

  it('1k texture ≈ 2.8MB GPU with mipmaps', () => {
    expect(textureGpuMB(1024, 512)).toBeCloseTo(2.67, 1);
    expect(textureGpuMB(0, 512)).toBe(0);
  });

  it('13 bundled 1k-ish textures stay well under budget alone', () => {
    const textures = Array.from({ length: 13 }, () => ({ w: 1024, h: 512 }));
    expect(texturesGpuMB(textures)).toBeLessThan(40);
  });

  it('optimized scene (1024 shadow, 1.5 DPR, 1080p) fits <150MB', () => {
    const textures = Array.from({ length: 13 }, () => ({ w: 1024, h: 512 }));
    const input = {
      textures,
      shadowMapSize: 1024,
      renderTargets: 2,
      viewportW: 1920,
      viewportH: 1080,
      pixelRatio: 1.5,
    };
    expect(estimateGpuMB(input)).toBeLessThan(PERF_BUDGET.gpuMB);
    expect(meetsGpuBudget(input)).toBe(true);
  });

  it('old settings (2048 shadow, DPR 2) blow past the budget', () => {
    const textures = Array.from({ length: 13 }, () => ({ w: 1024, h: 512 }));
    const input = {
      textures,
      shadowMapSize: 2048,
      renderTargets: 2,
      viewportW: 1920,
      viewportH: 1080,
      pixelRatio: 2,
    };
    expect(meetsGpuBudget(input)).toBe(false);
  });

  it('low mode (no shadows) has wide headroom', () => {
    const textures = Array.from({ length: 13 }, () => ({ w: 1024, h: 512 }));
    expect(
      meetsGpuBudget({
        textures,
        shadowMapSize: 0,
        renderTargets: 1,
        viewportW: 1920,
        viewportH: 1080,
        pixelRatio: 1,
      })
    ).toBe(true);
  });

  it('fps meter: 60fps stream passes high, 30fps passes low only', () => {
    const high = new FpsMeter();
    for (let i = 0; i < 120; i++) high.push(1 / 60);
    expect(high.avgFps()).toBeCloseTo(60, 0);
    expect(meetsFpsBudget(high, 'high')).toBe(true);
    expect(meetsFpsBudget(high, 'low')).toBe(true);

    const low = new FpsMeter();
    for (let i = 0; i < 120; i++) low.push(1 / 30);
    expect(meetsFpsBudget(low, 'high')).toBe(false);
    expect(meetsFpsBudget(low, 'low')).toBe(true);
  });

  it('fps meter needs a full window and ignores bad samples', () => {
    const m = new FpsMeter();
    expect(m.avgFps()).toBe(0);
    expect(meetsFpsBudget(m, 'low')).toBe(false);
    m.push(1 / 60);
    m.push(0);
    m.push(NaN);
    expect(m.samples).toBe(1);
  });

  it('suggests low quality only after sustained poor fps', () => {
    expect(shouldSuggestLowQuality(20, 5)).toBe(true);
    expect(shouldSuggestLowQuality(20, 1)).toBe(false);
    expect(shouldSuggestLowQuality(60, 5)).toBe(false);
    expect(shouldSuggestLowQuality(0, 5)).toBe(false);
  });
});
