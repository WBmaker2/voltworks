import { expect, test } from '@playwright/test';

test('works offline after the first load', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration?.active);
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__voltworks));
  await expect(page.locator('.brand-mark')).toHaveText('V');
  await expect(page.locator('#schematic')).toBeVisible();
  await context.setOffline(false);
});
