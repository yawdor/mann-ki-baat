import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { t } from '../../src/lib/i18n';

const PAGES = ['', '2026-09/', 'hi/2026-09/', 'kn/2026-09/'];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const MACHINE_NOTICE = 'Machine-translated — check official links for exact eligibility.';

async function open(page: Page, path: string) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url()}`));
  await page.goto(path);
  await page.waitForLoadState('load');
  return errors;
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const p of PAGES) {
      test.describe(`/${p}`, () => {
        test('no console errors', async ({ page }) => {
          const errors = await open(page, p);
          expect(errors).toEqual([]);
        });

        test('axe: no serious or critical violations', async ({ page }) => {
          await open(page, p);
          const { violations } = await new AxeBuilder({ page }).analyze();
          const bad = violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
          expect(bad).toEqual([]);
        });

        test('no horizontal overflow', async ({ page }) => {
          await open(page, p);
          const { sw, iw } = await page.evaluate(() => ({
            sw: document.documentElement.scrollWidth,
            iw: window.innerWidth,
          }));
          expect(sw).toBeLessThanOrEqual(iw);
        });
      });
    }

    test('Environment chip hides cards that are not Environment', async ({ page }) => {
      await open(page, '2026-09/');
      await page.locator('button[data-filter="Environment"]').click();
      const cards = page.locator('[data-category]');
      const total = await cards.count();
      expect(total).toBeGreaterThan(1);
      let visible = 0;
      for (let i = 0; i < total; i++) {
        const card = cards.nth(i);
        const cat = await card.getAttribute('data-category');
        if (cat === 'Environment') {
          await expect(card).toBeVisible();
          visible++;
        } else {
          await expect(card).toBeHidden();
        }
      }
      expect(visible).toBeGreaterThan(0);
      expect(visible).toBeLessThan(total);
    });

    test('clicking a scheme header expands it', async ({ page }) => {
      await open(page, '2026-09/');
      const toggle = page.locator('[data-scheme] button[aria-expanded]').first();
      await toggle.scrollIntoViewIfNeeded();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    test('language switch keeps the hash: /2026-09/#schemes -> /hi/2026-09/#schemes', async ({ page }) => {
      await open(page, '2026-09/#schemes');
      const link = page.locator('a.pill-btn[hreflang="hi"]');
      if (!(await link.isVisible())) await page.locator('.menu-toggle').click();
      await link.click();
      await expect(page).toHaveURL(/\/mann-ki-baat\/hi\/2026-09\/#schemes$/);
    });

    for (const [path, lang] of [['2026-09/', 'en'], ['kn/2026-09/', 'kn']] as const) {
      test(`/${path}: "Other languages" shows the machine-translation notice when opened`, async ({ page }) => {
        await open(page, path);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await page.locator('details.more > summary').click();
        const other = page.locator('details.other');
        await other.locator('> summary').click();
        await expect(other).toHaveJSProperty('open', true);
        // English shows the exact notice; kn shows its own translation of it.
        await expect(other.locator('p.small')).toHaveText(lang === 'en' ? MACHINE_NOTICE : t('kn', 'machineNotice'));
      });
    }
  });
}
