import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'voltworks.progress.v1',
      JSON.stringify({
        completed: ['one-bulb'],
        lastMissionId: 'one-bulb',
        answers: {
          'one-bulb': {
            prediction: 'yes',
            explanation: 'closed-loop',
            stage: 0,
            measured: true,
            targetPassed: true
          }
        },
        preferences: {
          reducedMotion: false,
          theme: 'light',
          view: 'schematic',
          overlays: { current: true, voltages: false, labels: true, grid: true }
        }
      })
    );
  });
});

test('reveals answers and resets progress after confirmation', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#mission-count')).toHaveText('1/6');

  await page.locator('[data-nav="teacher"]').click();
  await expect(page.locator('.teacher-mission').first()).toContainText('완료');
  await page.locator('[data-action="toggle-reveal"]').click();
  await expect(page.locator('.teacher-answer').first()).toBeVisible();

  page.on('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept();
  });
  await page.locator('[data-action="reset-progress"]').click();
  await expect(page.locator('#mission-count')).toHaveText('0/6');

  const stored = await page.evaluate(() => localStorage.getItem('voltworks.progress.v1'));
  expect(stored).not.toBeNull();
  const parsed = JSON.parse(stored ?? '{}') as { completed?: string[] };
  expect(parsed.completed).toEqual([]);
});
