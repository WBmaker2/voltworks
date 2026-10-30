import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test('workbench, missions, and teacher screens have no automated accessibility violations', async ({
  page
}) => {
  await openApp(page);

  const workbench = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(workbench.violations).toEqual([]);

  await page.locator('[data-nav="missions"]').click();
  await page.waitForTimeout(250);
  const missions = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(missions.violations).toEqual([]);

  await page.locator('[data-nav="teacher"]').click();
  await page.waitForTimeout(250);
  await page.locator('[data-action="toggle-reveal"]').click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  const teacher = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(teacher.violations).toEqual([]);
});
