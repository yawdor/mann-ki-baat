// axe + no-horizontal-scroll over every page of the real build (dist/), run by the deploy job.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DIST = 'dist';
const EPISODES = join(process.env.MKB_CONTENT_DIR ?? 'content', 'episodes');
const hasEpisodes = existsSync(EPISODES) && readdirSync(EPISODES).some((f) => f.endsWith('.json'));

/** Every built page, as a path below the base: "", "2026-10/", "hi/schemes/", "404.html". */
function builtPages(dir = DIST): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '_astro') out.push(...builtPages(p));
    } else if (name.endsWith('.html')) {
      const rel = relative(DIST, p).replaceAll(sep, '/');
      out.push(rel === 'index.html' ? '' : rel.replace(/(^|\/)index\.html$/, '$1'));
    }
  }
  return out.sort();
}

const PAGES = hasEpisodes ? builtPages() : [];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

test('real build has pages to check (skipped when there are no episodes yet)', () => {
  test.skip(!hasEpisodes, `no episodes in ${EPISODES}`);
  expect(PAGES).toContain('');
  expect(PAGES).toContain('404.html');
});

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const p of PAGES) {
      test(`/${p}: axe has no serious or critical violations, no horizontal scroll`, async ({ page }) => {
        // Reduced motion shows .bloom sections at full opacity, so contrast
        // is measured on final colours rather than mid-fade.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(p);
        await page.waitForLoadState('load');
        const { violations } = await new AxeBuilder({ page }).analyze();
        const bad = violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
        expect(bad).toEqual([]);
        const { sw, iw } = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          iw: window.innerWidth,
        }));
        expect(sw).toBeLessThanOrEqual(iw);
      });
    }
  });
}
