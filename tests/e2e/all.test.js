/**
 * Combined E2E test suite — all tests share one browser instance.
 *
 * Running popup.test.js and dashboard.test.js as separate Node processes
 * required two Chrome launches in sequence. On CI the second launch was
 * consistently too slow to register the extension service worker within
 * 30 s. A single shared browser avoids that entirely.
 *
 * Node.js test runner scopes `before`/`after` to their enclosing describe,
 * so all tests live under one outer describe to share the browser setup.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, getExtensionId, popupUrl, dashboardUrl } from './helpers.js';

describe('E2E', () => {
  let browser;
  let extensionId;

  before(async () => {
    browser = await launchBrowser();
    extensionId = await getExtensionId(browser);

    // Open two real tabs so the popup has something to list
    const tab1 = await browser.newPage();
    await tab1.goto('about:blank');
    const tab2 = await browser.newPage();
    await tab2.goto('about:blank');
  });

  after(async () => {
    await browser.close();
  });

  // ── Popup ───────────────────────────────────────────────────────────────────

  describe('Popup', () => {
    async function openPopup() {
      const page = await browser.newPage();
      await page.goto(popupUrl(extensionId));
      await page.waitForSelector('#tab-list');
      await page.waitForFunction(
        () => parseInt(document.getElementById('tab-count').textContent, 10) > 0,
        { timeout: 5000 }
      );
      return page;
    }

    it('loads and renders tab count', async () => {
      const page = await openPopup();
      const count = await page.$eval('#tab-count', (el) => parseInt(el.textContent, 10));
      assert.ok(count > 0, `Expected at least 1 tab, got ${count}`);
      await page.close();
    });

    it('search input filters the tab list', async () => {
      const page = await openPopup();
      await page.waitForSelector('.tab-item');
      const totalBefore = await page.$$eval('.tab-item', (els) => els.length);

      await page.type('#search-input', 'xyzzy-no-match-12345');
      await new Promise((r) => setTimeout(r, 200));

      const totalAfter = await page.$$eval('.tab-item', (els) => els.length);
      assert.ok(
        totalAfter < totalBefore || totalAfter === 0,
        'Search should reduce visible tabs'
      );
      await page.close();
    });

    it('settings panel opens and closes', async () => {
      const page = await openPopup();

      await page.click('#settings-link');
      const isVisible = await page.$eval(
        '#settings-panel',
        (el) => !el.classList.contains('hidden')
      );
      assert.ok(isVisible, 'Settings panel should be visible after clicking settings link');

      await page.click('#back-btn');
      const isHidden = await page.$eval(
        '#settings-panel',
        (el) => el.classList.contains('hidden')
      );
      assert.ok(isHidden, 'Settings panel should be hidden after clicking back');
      await page.close();
    });

    it('home tabs panel opens and closes', async () => {
      const page = await openPopup();

      await page.click('#home-tabs-link');
      const isVisible = await page.$eval(
        '#home-tabs-panel',
        (el) => !el.classList.contains('hidden')
      );
      assert.ok(isVisible, 'Home tabs panel should be visible');

      await page.click('#home-tabs-back-btn');
      const isHidden = await page.$eval(
        '#home-tabs-panel',
        (el) => el.classList.contains('hidden')
      );
      assert.ok(isHidden, 'Home tabs panel should be hidden after back');
      await page.close();
    });

    it('AI Group button shows success with mocked sendMessage', async () => {
      const setupPage = await browser.newPage();
      await setupPage.goto(popupUrl(extensionId));
      await setupPage.evaluate(async () => {
        await chrome.storage.local.set({ apiKey: 'test-key-ci', provider: 'openrouter' });
      });
      await setupPage.close();

      const page = await openPopup();
      await page.waitForSelector('#btn-group');

      await page.evaluate(() => {
        chrome.runtime.sendMessage = () =>
          Promise.resolve([{ name: 'Work', count: 2 }]);
      });

      await page.click('#btn-group');

      await page.waitForFunction(
        () => {
          const el = document.getElementById('status-message');
          return el && !el.classList.contains('hidden') && el.textContent.length > 0;
        },
        { timeout: 5000 }
      );

      const statusText = await page.$eval('#status-message', (el) => el.textContent);
      assert.ok(
        statusText.includes('Created 1 tab groups'),
        `Expected "Created 1 tab groups", got: "${statusText}"`
      );

      await page.evaluate(async () => {
        await chrome.storage.local.remove(['apiKey', 'provider']);
      });
      await page.close();
    });

    it('Dedupe button shows a status message', async () => {
      const page = await openPopup();
      await page.waitForSelector('#btn-dedupe');

      await page.click('#btn-dedupe');

      await page.waitForFunction(
        () => {
          const el = document.getElementById('status-message');
          return el && !el.classList.contains('hidden') && el.textContent.length > 0;
        },
        { timeout: 5000 }
      );

      const statusText = await page.$eval('#status-message', (el) => el.textContent);
      assert.ok(
        statusText.includes('duplicate') || statusText.includes('Closed'),
        `Expected dedupe status message, got: "${statusText}"`
      );
      await page.close();
    });
  });

  // ── Dashboard ───────────────────────────────────────────────────────────────

  describe('Dashboard', () => {
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
});
