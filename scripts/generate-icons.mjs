import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const standard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#111111"/><path d="M292 48 148 288h104l-24 176 176-256H296l-4-160Z" fill="#ff4f00"/></svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#ff4f00"/><path d="M282 118 178 292h76l-18 126 128-188H286l-4-112Z" fill="#111111"/></svg>`;

const data = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 600, height: 620 } });
  const html = `<body style="margin:0;background:#fff;display:flex;gap:16px;flex-wrap:wrap;padding:8px">
    <img id="i512" src="${data(standard)}" width="512" height="512" />
    <img id="i192" src="${data(standard)}" width="192" height="192" />
    <img id="m512" src="${data(maskable)}" width="512" height="512" />
  </body>`;
  await page.setContent(html);
  mkdirSync('public/icons', { recursive: true });
  await page.locator('#i512').screenshot({ path: 'public/icons/icon-512.png' });
  await page.locator('#i192').screenshot({ path: 'public/icons/icon-192.png' });
  await page.locator('#m512').screenshot({ path: 'public/icons/icon-maskable-512.png' });
  console.log('Generated PWA icons in public/icons.');
} finally {
  await browser.close();
}
