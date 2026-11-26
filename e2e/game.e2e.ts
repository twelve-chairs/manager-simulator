import { expect, test, type Page } from '@playwright/test';

/** Collects what the page reports while a test runs: policy violations, errors, and requests to other origins. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.origin !== 'http://localhost:4318') problems.push(`request to another origin: ${r.url()}`);
  });
  return problems;
}

const scene = (page: Page) => page.locator('[data-scene]');

/** Begins a run and starts week 0, past Before Monday. */
async function startWeek(page: Page) {
  await page.goto('/');
  await page.locator('[data-action=begin]').click();
  await expect(scene(page)).toHaveAttribute('data-scene', 'before-monday');
  await page.locator('[data-action=start-week]').click();
}

test.beforeEach(async ({ page }) => {
  // Each test starts with no saved run.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-cleared', '1');
    }
  });
});

// @spec UI-BUILD-002, UI-BUILD-003
test('loads under its Content-Security-Policy with no violations, nothing from elsewhere, and the background painted', async ({ page }) => {
  const problems = watch(page);
  const svg = page.waitForResponse((r) => /circuit-[^/]+\.svg$/.test(r.url()));
  await page.goto('/');
  expect((await svg).status()).toBe(200);
  const mask = await page.evaluate(() => {
    const style = getComputedStyle(document.body, '::before');
    return style.maskImage || style.getPropertyValue('-webkit-mask-image');
  });
  expect(mask).toMatch(/circuit-[^)]+\.svg/);
  await startWeek(page);
  expect(problems).toEqual([]);
});

// @spec UI-SHELL-006, UI-SHELL-007, UI-BUILD-004
test('the start screen carries the disclaimer and the built version, and no seed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-part=disclaimer]')).toContainText('not management, career, legal or HR advice');
  // CI and local clones have the whole history, so the deployed build carries a real version.
  await expect(page.locator('[data-field=version]')).toHaveText(/^Version v\d+\.\d+\.\d+ \([0-9a-f]{7,}\)$/);
  await expect(page.locator('[data-field=seed]')).toHaveCount(0);
});

// @spec UI-SHELL-009, UI-SHELL-010, UI-SHELL-011, UI-SHELL-013
test('the start screen shows the career ladder and two clear buttons', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start a new game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load a saved game' })).toBeVisible();
  await expect(page.locator('[data-part=ladder] > li')).toHaveCount(3);
  // The game starts with the line manager and senior manager levels (UI-SHELL-013); director and above is still to come.
  await expect(page.locator('[data-part=ladder] [data-field=status]')).toHaveText(['Playable now', 'Playable now', 'Playable now']);
  // the climb is drawn bottom to top: line manager sits lowest
  const top = async (i: number) => (await page.locator('[data-part=ladder] > li').nth(i).boundingBox())!.y;
  expect(await top(0)).toBeGreaterThan(await top(2));
});

// @spec UI-SHELL-001, UI-WEEK-002, UI-WEEK-004, UI-WEEK-006, UI-WEEK-007
test('plays a week by mouse: a moment, its reaction, the end of the week and the recap', async ({ page }) => {
  const problems = watch(page);
  await startWeek(page);
  await expect(scene(page)).toHaveAttribute('data-scene', 'moment');
  await scene(page).locator('[data-choice]').first().click();
  await expect(scene(page)).toHaveAttribute('data-scene', 'reaction');
  await expect(scene(page).locator('[data-part=reaction]')).not.toBeEmpty();
  await scene(page).locator('[data-action=continue]').click();
  // let the rest of the week wait, then end it
  while ((await scene(page).getAttribute('data-scene')) === 'moment') await scene(page).locator('[data-action=wait]').click();
  await expect(scene(page)).toHaveAttribute('data-scene', 'done');
  await scene(page).locator('[data-action=finish-week]').click();
  await expect(scene(page)).toHaveAttribute('data-scene', 'recap');
  await expect(page.locator('[data-field=week]')).toHaveText('1');
  // the week's moments are folded into The whole week, which opens on a click
  await expect(scene(page).locator('[data-part=recap-moments] li').first()).toBeHidden();
  await scene(page).locator('[data-part=recap-whole-week] summary').click();
  await expect(scene(page).locator('[data-part=recap-moments] li').first()).toBeVisible();
  expect(problems).toEqual([]);
});

// @spec UI-SAVE-001, UI-SAVE-002, UI-WEEK-009
test('resumes where the player was after a reload, from the browser’s storage', async ({ page }) => {
  await startWeek(page);
  await scene(page).locator('[data-action=wait]').click();
  await page.locator('[data-action=end-week]').click();
  await expect(page.locator('[data-field=week]')).toHaveText('1');
  await page.reload();
  await expect(page.locator('[data-screen]')).toHaveAttribute('data-screen', 'week');
  await expect(page.locator('[data-field=week]')).toHaveText('1');
});

// @spec UI-SAVE-010
test('a tab another tab has saved over stops, and continues from the other tab’s run', async ({ page, context }) => {
  await startWeek(page);
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.locator('[data-screen]')).toHaveAttribute('data-screen', 'week');
  // Plays a week in the other tab: past Before Monday when it shows, letting each moment wait, then ending the week.
  if (await other.locator('[data-action=start-week]').count()) await other.locator('[data-action=start-week]').click();
  while (await other.locator('[data-scene] [data-action=wait]').count()) await other.locator('[data-scene] [data-action=wait]').first().click();
  // Mid-week the button is end-week; on the weekend scene, once every moment is done, it is finish-week.
  await other.locator('[data-action=end-week], [data-action=finish-week]').first().click();
  await expect(other.locator('[data-part=recap-changes]')).toBeVisible();
  await expect(page.locator('[data-part=other-tab]')).toContainText('played on in another tab');
  // Continuing here picks up the other tab's run: this tab was mid-week, and the saved run has ended its week, so it
  // opens on that week's recap, as a reload of the other tab does.
  await other.reload();
  await expect(other.locator('[data-part=recap-changes]')).toBeVisible();
  await expect(page.locator('[data-part=recap-changes]')).toHaveCount(0);
  await page.locator('[data-action=continue-here]').click();
  await expect(page.locator('[data-part=recap-changes]')).toBeVisible();
  await expect(page.locator('[data-field=week]')).toHaveText((await other.locator('[data-field=week]').textContent()) ?? '');
});

// @spec UI-SHELL-005
test('moves keyboard focus to the scene heading as the scene changes', async ({ page }) => {
  await startWeek(page);
  await expect(scene(page).locator('[data-part=heading]')).toBeFocused();
  await scene(page).locator('[data-choice]').first().focus();
  await page.keyboard.press('Enter');
  await expect(scene(page)).toHaveAttribute('data-scene', 'reaction');
  await expect(scene(page).locator('[data-part=heading]')).toBeFocused();
});
