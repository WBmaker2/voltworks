import { expect, test } from '@playwright/test';
import { activeInfo, getState, openApp, tabUntil } from './helpers';

test('completes the one-bulb mission using only the keyboard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'This check needs a physical keyboard layout.');
  await openApp(page);

  await tabUntil(page, (info) => info.nav === 'missions');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await tabUntil(page, (info) => info.action === 'start-mission' && info.id === 'one-bulb');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await activeInfo(page)).action).toBe('prediction');

  await page.keyboard.press('Space');
  await expect.poll(async () => (await activeInfo(page)).tag).toBe('CANVAS');
  await expect
    .poll(async () => (await getState(page)).mission.progress['one-bulb']?.prediction)
    .toBe('yes');

  await page.keyboard.press('n');
  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyW');
  await page.keyboard.up('Shift');
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await getState(page)).editor.wires.length).toBe(3);

  await page.keyboard.press('n');
  await page.keyboard.press('n');
  await page.keyboard.press('Enter');
  await expect
    .poll(
      async () =>
        (await getState(page)).editor.components.find((component) => component.id === 's1')?.closed
    )
    .toBe(true);

  await tabUntil(page, (info) => info.action === 'measure');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await activeInfo(page)).action).toBe('explanation');
  await page.keyboard.press('Space');

  await expect.poll(async () => (await getState(page)).mission.completed).toContain('one-bulb');
  const state = await getState(page);
  expect(state.mission.progress['one-bulb']?.prediction).toBe('yes');
  expect(state.mission.progress['one-bulb']?.explanation).toBe('closed-loop');
  await expect(page.locator('#mission-strip')).toContainText('미션 완료');
});
