import { expect, type Page } from '@playwright/test';
import type { TestSnapshot } from './bridge';
import type { Point } from '../../src/circuit/types';

export interface ActiveInfo {
  tag: string | null;
  nav: string | null;
  action: string | null;
  id: string | null;
  value: string | null;
}

export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__voltworks));
  await expect(page.locator('#schematic')).toBeVisible();
  await page.waitForTimeout(250);
}

export async function getState(page: Page): Promise<TestSnapshot> {
  return page.evaluate(() => window.__voltworks.getSnapshot());
}

export async function clickWorld(page: Page, x: number, y: number): Promise<void> {
  const point = await page.evaluate(
    ([worldX, worldY]) => {
      const canvas = document.querySelector<HTMLCanvasElement>('#schematic');
      if (!canvas) throw new Error('Canvas is missing.');
      const rect = canvas.getBoundingClientRect();
      const screen = window.__voltworks.worldToScreen({ x: worldX, y: worldY });
      return { x: rect.left + screen.x, y: rect.top + screen.y };
    },
    [x, y]
  );
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(70);
}

export async function activeInfo(page: Page): Promise<ActiveInfo> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return {
      tag: element?.tagName ?? null,
      nav: element?.getAttribute('data-nav') ?? null,
      action: element?.getAttribute('data-action') ?? null,
      id: element?.getAttribute('data-id') ?? null,
      value: (element as HTMLInputElement | null)?.value ?? null
    };
  });
}

export async function tabUntil(
  page: Page,
  predicate: (info: ActiveInfo) => boolean,
  max = 80
): Promise<ActiveInfo> {
  for (let index = 0; index < max; index += 1) {
    const info = await activeInfo(page);
    if (predicate(info)) return info;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(25);
  }
  const final = await activeInfo(page);
  throw new Error(`Tab target not found. Last focus: ${JSON.stringify(final)}`);
}

export async function isNarrow(page: Page): Promise<boolean> {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

export async function openMissionPanel(page: Page): Promise<void> {
  if (!(await isNarrow(page))) return;
  const panel = (await getState(page)).ui.mobilePanel;
  if (panel !== 'mission') {
    await page.locator('[data-action="mobile-panel"][data-panel="mission"]').click();
    await page.waitForTimeout(260);
  }
}

export async function closeMissionPanel(page: Page): Promise<void> {
  if (!(await isNarrow(page))) return;
  const panel = (await getState(page)).ui.mobilePanel;
  if (panel === 'mission') {
    await page.locator('[data-action="mobile-panel"][data-panel="mission"]').click();
    await page.waitForTimeout(260);
  }
}

export async function openPartsPanel(page: Page): Promise<void> {
  if (!(await isNarrow(page))) return;
  const panel = (await getState(page)).ui.mobilePanel;
  if (panel !== 'parts') {
    await page.locator('[data-action="mobile-panel"][data-panel="parts"]').click();
    await page.waitForTimeout(260);
  }
}

export async function startMissionViaUi(page: Page, missionId: string): Promise<void> {
  await page.locator('[data-nav="missions"]').click();
  await page.locator(`[data-action="start-mission"][data-id="${missionId}"]`).click();
  await page.waitForTimeout(350);
}

export async function wirePath(page: Page, points: Array<[number, number]>): Promise<void> {
  for (const [x, y] of points) {
    await clickWorld(page, x, y);
  }
}

export async function benchWorld(page: Page): Promise<Point> {
  return page.evaluate(() => {
    const state = window.__voltworks.getState();
    const component = state.editor.components[0];
    return { x: component?.x ?? 20, y: component?.y ?? 10 };
  });
}
