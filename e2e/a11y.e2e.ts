import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** WCAG 2.2 AA and axe's best practices: every violation fails, named with the elements it found. */
async function expectAccessible(page: Page, screen: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const found = result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(found, screen).toEqual([]);
  // One main landmark holding the game, and one level-one heading on every screen.
  await expect(page.locator('main'), screen).toHaveCount(1);
  await expect(page.locator('main#app'), screen).toHaveCount(1);
  await expect(page.locator('h1'), screen).toHaveCount(1);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-cleared', '1');
    }
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  // @spec UI-A11Y-001, UI-A11Y-002
  test(`the start screen, a turn's opening scene, a moment and the recap pass an accessibility check in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await expectAccessible(page, 'start');
    await page.locator('[data-action=begin]').click();
    await expect(page.locator('[data-scene]')).toHaveAttribute('data-scene', 'before-monday');
    await expectAccessible(page, 'opening scene');
    await page.locator('[data-action=start-week]').click();
    await expectAccessible(page, 'moment');
    while (await page.locator('[data-scene] [data-action=wait]').count()) await page.locator('[data-scene] [data-action=wait]').first().click();
    await page.locator('[data-action=end-week], [data-action=finish-week]').first().click();
    await expect(page.locator('[data-part=recap-changes]')).toBeVisible();
    await expectAccessible(page, 'recap');
  });
}
