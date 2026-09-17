import { test, expect, type Page } from '@playwright/test';

// Fase 4.3: screenshot E2E cegah regresi visual (desktop / tablet / mobile).
//
// Determinisme: simulasi dibekukan via localStorage (speed 0) sebelum script
// jalan, jadi planet/komet/belt diam di posisi awal. Shader Sun masih
// beranimasi (uTime) — ditoleransi via maxDiffPixelRatio.

const FROZEN_SETTINGS = JSON.stringify({ speed: 0 });

// Seed Math.random so planet/moon/star layouts are identical every run.
// (factory.ts + starfield use Math.random for initial angles/positions;
// without this, frozen-speed screenshots still differ per load.)
const SEED_SCRIPT = `(() => {
  let s = 0x04aff3;
  Math.random = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

async function gotoReady(page: Page, url: string, settleMs = 2500): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(SEED_SCRIPT);
  await page.addInitScript((json) => localStorage.setItem('solar-system-settings-v1', json), FROZEN_SETTINGS);
  await page.goto(url, { waitUntil: 'load' });
  await expect(page.locator('#solar-canvas')).toBeVisible();
  // main.ts appends #labels at the end of init() → app booted.
  await expect(page.locator('#labels')).toBeAttached({ timeout: 20_000 });
  // Textures + first frames settle.
  if (settleMs > 0) await page.waitForTimeout(settleMs);
  return errors;
}

// Camera flights (deep-link / nav / reset) take 0.6–2.5s depending on
// texture-load timing — poll the data-flight flag from controls.ts instead
// of guessing a fixed wait, otherwise screenshots catch mid-flight frames.
// Strict 'idle' (not merely "not active"): a missing attribute would also
// satisfy "not active" and silently screenshot mid-flight on a stale dist.
// The flag is always set synchronously during init, so 'idle' is observable
// even if the flight already landed before the first poll.
async function waitForFlightDone(page: Page): Promise<void> {
  await expect.poll(() => page.getAttribute('body', 'data-flight'), { timeout: 20_000 }).toBe('idle');
  await page.waitForTimeout(1000);
}

const shotOpts = { animations: 'disabled' as const, maxDiffPixelRatio: 0.05 };

test('overview renders + screenshot', async ({ page }) => {
  const errors = await gotoReady(page, '/');
  expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);

  // Sun + 9 planets in nav, top bar chrome present.
  await expect(page.locator('#planet-nav button')).toHaveCount(10);
  await expect(page.locator('#top-bar')).toBeVisible();
  await expect(page.locator('#planet-nav')).toBeVisible();
  await expect(page.locator('#follow-badge')).toBeHidden();

  await expect(page).toHaveScreenshot('overview.png', shotOpts);
});

test('deep-link #mars follows planet + screenshot', async ({ page }) => {
  // settleMs 0: deep-link flight starts at init end — catch 'active' first.
  const errors = await gotoReady(page, '/#mars', 0);
  expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);

  await expect(page.locator('#info-panel')).toBeVisible();
  await expect(page.locator('#panel-name')).toHaveText('Mars');
  await expect(page.locator('#follow-badge')).toContainText('Following Mars');
  await waitForFlightDone(page);

  await expect(page).toHaveScreenshot('mars.png', shotOpts);
});

test('help modal opens + screenshot', async ({ page }) => {
  const errors = await gotoReady(page, '/');
  expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);

  await page.locator('#help-btn').click();
  await expect(page.locator('#help-modal')).toBeVisible();
  await expect(page.locator('#help-title')).toHaveText('Keyboard shortcuts');

  await expect(page).toHaveScreenshot('help.png', shotOpts);

  // Closes again (no stuck overlay for later tests).
  await page.locator('#help-close').click();
  await expect(page.locator('#help-modal')).toBeHidden();
});
