import { expect, test, type Page } from '@playwright/test';
import { attachSummary, play, startSeeded, watch } from './harness';

/** The parts of the screen a reload must bring back as they were. */
const snapshot = (page: Page) =>
  page.evaluate(() => ({
    scene: document.querySelector<HTMLElement>('[data-scene]')?.dataset.scene,
    week: document.querySelector('[data-field=week]')?.textContent,
    heading: document.querySelector('[data-scene] [data-part=heading]')?.textContent,
    energy: document.querySelector('[data-field=energy]')?.textContent,
    team: [...document.querySelectorAll('[data-panel=team] [data-person] [data-field=name]')].map((e) => e.textContent).join(','),
    habits: [...document.querySelectorAll<HTMLSelectElement>('[data-panel=habits] select')].map((s) => s.value).join(','),
  }));

test.describe('saves', () => {
  // @spec UI-SAVE-001, UI-SAVE-002, UI-WEEK-009
  test('a reload mid-run comes back exactly where the player was', async ({ page }) => {
    await startSeeded(page, 71);
    await play(page, { strategy: 'sound', seed: 71, maxWeeks: 9 });
    const before = await snapshot(page);
    await page.reload();
    expect(await snapshot(page)).toEqual(before);
    await expect(page.locator('[data-notice]')).toHaveCount(0);
  });

  // @spec UI-SAVE-006, UI-SAVE-007, UI-WEEK-011
  test('an export is named after the week on screen, and importing it brings the run back', async ({ page }) => {
    await startSeeded(page, 72);
    await play(page, { strategy: 'sound', seed: 72, maxWeeks: 3 });
    // On the recap of week 3.
    let download = page.waitForEvent('download');
    await page.locator('[data-action=export]').click();
    expect((await download).suggestedFilename()).toBe('manager-simulator-72-week-3.json');
    // Week 4 has started: the header and the file name move on together.
    await page.locator('[data-action=close-recap]').click();
    await expect(page.locator('[data-field=week]')).toHaveText('4');
    download = page.waitForEvent('download');
    await page.locator('[data-action=export]').click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('manager-simulator-72-week-4.json');
    const before = await snapshot(page);

    // Start over, then import the export.
    await page.locator('[data-action=discard]').click();
    await page.getByRole('button', { name: 'Yes, discard it' }).click();
    await expect(page.locator('[data-screen]')).toHaveAttribute('data-screen', 'start');
    await page.locator('[data-input=import]').setInputFiles(await file.path());
    await expect(page.locator('[data-screen]')).toHaveAttribute('data-screen', 'week');
    // Closing the recap is page state, never saved (UI-WEEK-009), so the imported run opens on it again.
    await expect(page.locator('[data-scene]')).toHaveAttribute('data-scene', 'recap');
    await page.locator('[data-action=close-recap]').click();
    expect(await snapshot(page)).toEqual(before);
  });

  // @spec UI-SAVE-008
  test('discarding asks first, and Cancel leaves the run alone', async ({ page }) => {
    await startSeeded(page, 73);
    await play(page, { strategy: 'sound', seed: 73, maxWeeks: 2 });
    const before = await snapshot(page);
    await page.locator('[data-action=discard]').click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await snapshot(page)).toEqual(before);
    await page.locator('[data-action=discard]').click();
    await page.getByRole('button', { name: 'Yes, discard it' }).click();
    await expect(page.locator('[data-screen]')).toHaveAttribute('data-screen', 'start');
  });
});

test.describe('presentation', () => {
  // Every screen is checked for sideways scrolling as it is played.
  test('plays at phone width with nothing wider than the screen', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const problems = watch(page);
    await startSeeded(page, 81);
    const summary = await play(page, { strategy: 'mixed', seed: 81, maxWeeks: 40 });
    await attachSummary(testInfo, 'phone-81', summary);
    expect(summary.violations).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('plays in dark mode with the same checks', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const problems = watch(page);
    await startSeeded(page, 82);
    const summary = await play(page, { strategy: 'sound', seed: 82, maxWeeks: 20 });
    await attachSummary(testInfo, 'dark-82', summary);
    expect(summary.violations).toEqual([]);
    expect(problems).toEqual([]);
    // The page really is dark: its background is darker than its text.
    const [bg, fg] = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color]);
    const light = (c: string) => (c.match(/\d+/g) ?? []).slice(0, 3).reduce((sum, n) => sum + Number(n), 0);
    expect(light(bg)).toBeLessThan(light(fg));
  });

  // @spec UI-SHELL-005
  test('plays a week with the keyboard alone, focus following the scene', async ({ page }) => {
    await startSeeded(page, 83);
    await page.locator('[data-action=start-week]').click();
    for (let moment = 0; moment < 30; moment++) {
      const scene = await page.locator('[data-scene]').getAttribute('data-scene');
      if (scene === 'recap' || scene === 'done') break;
      await expect(page.locator('[data-scene] [data-part=heading]')).toBeFocused();
      // Tab to the scene's first button and press it: a choice on a moment, Continue on a reaction.
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      await expect(focused).toHaveJSProperty('tagName', 'BUTTON');
      const outline = await focused.evaluate((e) => getComputedStyle(e).outlineStyle);
      expect(outline).not.toBe('none');
      await page.keyboard.press('Enter');
    }
    await expect(page.locator('[data-scene]')).toHaveAttribute('data-scene', /done|recap/);
  });
});
