import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 }
];

test('renders at desktop, tablet, and phone widths without horizontal overflow', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'This check cycles through all three widths.');
  mkdirSync('test-results/screenshots', { recursive: true });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await openApp(page);
    await page.evaluate(() => window.__voltworks.loadPreset('series'));
    await page.waitForTimeout(350);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-results/screenshots/workbench-${viewport.width}.png`,
      fullPage: false
    });
  }
});
