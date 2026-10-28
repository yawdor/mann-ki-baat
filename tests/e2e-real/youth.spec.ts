import { test, expect } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';

// Runs against the real build; uses the newest episode that has a quiz.
const months = existsSync('content/episodes')
  ? readdirSync('content/episodes').filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort().reverse()
  : [];
const month = months[0];

test.describe('youth features on the latest episode', () => {
  test.skip(!month, 'no episodes yet');

  test('story cards, picker, quiz, ask box and share buttons work', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`${month}/`);

    await expect(page.locator('#stories li.story').first()).toBeVisible();
    await expect(page.locator('#stories [data-share]').first()).toBeVisible();

    const chips = page.locator('[data-foryou]');
    if (await chips.count()) {
      const second = chips.nth(Math.min(1, (await chips.count()) - 1));
      await second.click();
      const a = await second.getAttribute('data-foryou');
      await expect(page.locator(`[data-foryou-panel="${a}"]`)).toBeVisible();
      await expect(second).toHaveAttribute('aria-pressed', 'true');
    }

    const quiz = page.locator('form[data-quiz]');
    if (await quiz.count()) {
      await quiz.locator('input[type=radio]').first().check();
      await quiz.locator('button[type=submit]').click();
      await expect(quiz.locator('.score')).not.toBeEmpty();
    }

    await page.fill('#ask-q', 'Khadi');
    await page.locator('form[data-ask] button[type=submit]').click();
    await expect(page.locator('#ask .results li').first()).toBeVisible();
    await expect(page.locator('#ask .results li a').first()).toHaveAttribute('href', /pmindia\.gov\.in/);
  });
});
