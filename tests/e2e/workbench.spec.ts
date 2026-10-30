import { expect, test } from '@playwright/test';
import { clickWorld, getState, openApp } from './helpers';

test('builds a simple circuit from a blank canvas and lights the bulb', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.__voltworks.actions.newCircuit());
  await expect.poll(async () => (await getState(page)).editor.components.length).toBe(0);

  await page.evaluate(() => window.__voltworks.actions.arm('battery'));
  await clickWorld(page, 10, 10);
  await page.evaluate(() => window.__voltworks.actions.arm('switch'));
  await clickWorld(page, 16, 10);
  await page.evaluate(() => window.__voltworks.actions.arm('bulb'));
  await clickWorld(page, 22, 10);

  await clickWorld(page, 11, 10);
  await clickWorld(page, 15, 10);
  await clickWorld(page, 17, 10);
  await clickWorld(page, 21, 10);
  await clickWorld(page, 23, 10);
  await clickWorld(page, 23, 14);
  await clickWorld(page, 9, 14);
  await clickWorld(page, 9, 10);
  await clickWorld(page, 16, 10);

  await expect
    .poll(async () => (await getState(page)).simulation.result?.componentStates['l1']?.power ?? 0)
    .toBeGreaterThan(0.5);

  const state = await getState(page);
  expect(state.editor.components).toHaveLength(3);
  expect(state.editor.wires).toHaveLength(3);
  expect(state.simulation.result?.warnings).toEqual([]);
  await expect(page.locator('#inspector')).toContainText('200 mA');
});

test('reports series and parallel readings from the same bulbs', async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => window.__voltworks.loadPreset('series'));
  await page.waitForTimeout(300);
  await clickWorld(page, 20, 10);
  await expect
    .poll(async () => (await getState(page)).simulation.result?.componentStates['l1']?.power ?? 0)
    .toBeCloseTo(0.15, 2);

  await page.evaluate(() => window.__voltworks.loadPreset('parallel-gap'));
  await page.waitForTimeout(300);
  await clickWorld(page, 21, 10);
  await clickWorld(page, 24, 10);
  await clickWorld(page, 20, 10);
  await expect
    .poll(async () => (await getState(page)).simulation.result?.componentStates['l2']?.power ?? 0)
    .toBeGreaterThan(0.5);

  const state = await getState(page);
  expect(state.simulation.result?.warnings).toEqual([]);
  expect(state.simulation.result?.componentStates['l1']?.voltage ?? 0).toBeCloseTo(3, 1);
  expect(state.simulation.result?.componentStates['l2']?.voltage ?? 0).toBeCloseTo(3, 1);
});
