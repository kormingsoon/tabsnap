import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Root of the extension (two levels up from tests/e2e/)
export const EXTENSION_PATH = path.resolve(__dirname, '../../');

/**
 * Launch Chromium with the TabSnap extension loaded.
 * headless: true uses Chrome's new headless mode which supports extensions.
 */
export async function launchBrowser() {
  return puppeteer.launch({
    headless: false,
    args: [
      '--headless=new',
      '--enable-extensions',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
}

/**
 * Poll for the extension's background service worker and return its ID.
 *
 * waitForTarget() is event-based and misses the SW if it registered before
 * the listener was attached (common on slow CI runners). Polling avoids
 * that race condition.  A warmup page is opened on the first poll so Chrome
 * actually activates the SW in headless mode.
 */
export async function getExtensionId(browser) {
  const isSw = (t) =>
    t.type() === 'service_worker' && t.url().startsWith('chrome-extension://');

  const deadline = Date.now() + 30_000;
  let warmupDone = false;

  while (Date.now() < deadline) {
    const target = browser.targets().find(isSw);
    if (target) return new URL(target.url()).hostname;

    if (!warmupDone) {
      // Opening any page triggers the extension SW to activate
      const page = await browser.newPage();
      await page.goto('about:blank');
      await page.close();
      warmupDone = true;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  throw new Error('Extension service worker not found within 30 s');
}

export const popupUrl = (id) =>
  `chrome-extension://${id}/popup/popup.html`;

export const dashboardUrl = (id) =>
  `chrome-extension://${id}/dashboard/dashboard.html`;
