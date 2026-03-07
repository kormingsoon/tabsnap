import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, getExtensionId, dashboardUrl } from './helpers.js';

describe('Dashboard', () => {
  let browser;
  let extensionId;

  before(async () => {
    browser = await launchBrowser();
    extensionId = await getExtensionId(browser);
  });

  after(async () => {
    await browser.close();
  });

  it('loads and shows sidebar nav items', async () => {
    const page = await browser.newPage();
    await page.goto(dashboardUrl(extensionId));

    await page.waitForSelector('.nav-item');
    const navCount = await page.$$eval('.nav-item', (els) => els.length);
    assert.ok(navCount >= 4, `Expected at least 4 nav items, got ${navCount}`);

    await page.close();
  });

  it('main search input is present', async () => {
    const page = await browser.newPage();
    await page.goto(dashboardUrl(extensionId));

    const input = await page.waitForSelector('#dash-search', { timeout: 3000 });
    assert.ok(input, 'Dashboard search input should exist');

    await page.close();
  });
});
