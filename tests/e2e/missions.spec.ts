import { expect, test } from '@playwright/test';
import {
  clickWorld,
  closeMissionPanel,
  getState,
  openApp,
  openMissionPanel,
  startMissionViaUi
} from './helpers';

test('completes the one-bulb mission with pointer input and saves progress', async ({ page }) => {
  await openApp(page);
  await startMissionViaUi(page, 'one-bulb');
  await openMissionPanel(page);

  await page.locator('label.option', { hasText: '켜진다' }).click();
  await expect(page.locator('[data-action="measure"]')).toBeVisible();
  await closeMissionPanel(page);

  await clickWorld(page, 15, 10);
  await clickWorld(page, 19, 10);
  await clickWorld(page, 20, 10);

  await openMissionPanel(page);
  await page.locator('[data-action="measure"]').click();
  await expect(
    page.locator('label.option', { hasText: '전지에서 나온 전류가 닫힌 길' })
  ).toBeVisible();
  await page.locator('label.option', { hasText: '전지에서 나온 전류가 닫힌 길' }).click();

  await expect(page.locator('#mission-strip')).toContainText('미션 완료');
  await expect(page.locator('#mission-count')).toHaveText('1/6');
  const state = await getState(page);
  expect(state.mission.completed).toContain('one-bulb');
  expect(state.mission.progress['one-bulb']?.explanation).toBe('closed-loop');
});

test('detects and fixes a short circuit', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__voltworks.startMission('short-circuit');
    window.__voltworks.setPrediction('wire');
    window.__voltworks.measure();
  });
  await page.waitForTimeout(350);

  let state = await getState(page);
  expect(state.simulation.result?.warnings.some((warning) => warning.code === 'short')).toBe(true);
  expect(state.mission.progress['short-circuit']?.targetPassed).toBe(false);

  await clickWorld(page, 21, 14);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);

  await page.evaluate(() => window.__voltworks.measure());
  await page.waitForTimeout(300);
  state = await getState(page);
  expect(state.simulation.result?.warnings.some((warning) => warning.code === 'short')).toBe(false);
  expect(state.mission.progress['short-circuit']?.targetPassed).toBe(true);
  expect(state.simulation.result?.componentStates['l1']?.power ?? 0).toBeGreaterThan(0.5);
});

test('places an ammeter in series and a voltmeter in parallel', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__voltworks.startMission('meter-placement');
    window.__voltworks.setPrediction('a-series-v-parallel');
  });
  await page.waitForTimeout(300);

  await page.evaluate(() => window.__voltworks.actions.arm('ammeter'));
  await clickWorld(page, 21, 10);
  await page.evaluate(() => window.__voltworks.actions.arm('voltmeter'));
  await clickWorld(page, 28, 14);
  await clickWorld(page, 15, 10);
  await page.waitForTimeout(300);

  await page.evaluate(() => window.__voltworks.measure());
  await page.waitForTimeout(300);
  const state = await getState(page);
  expect(state.mission.progress['meter-placement']?.targetPassed).toBe(true);
  expect(Math.abs(state.simulation.result?.componentStates['a1']?.current ?? 0)).toBeCloseTo(
    0.2,
    2
  );
  expect(Math.abs(state.simulation.result?.componentStates['v1']?.voltage ?? 0)).toBeCloseTo(3, 2);
  expect(
    state.simulation.result?.warnings.some(
      (warning) => warning.code === 'meter-series' || warning.code === 'meter-parallel'
    )
  ).toBe(false);
});
