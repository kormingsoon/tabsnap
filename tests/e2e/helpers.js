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
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
}

/**
 * Wait for the extension's background service worker to register,
 * then extract the extension ID from its URL.
 * URL format: chrome-extension://<id>/background.js
 */
export async function getExtensionId(browser) {
  const swTarget = await browser.waitForTarget(
    (t) =>
      t.type() === 'service_worker' &&
      t.url().startsWith('chrome-extension://'),
    { timeout: 10000 }
  );
  return new URL(swTarget.url()).hostname;
}

export const popupUrl = (id) =>
  `chrome-extension://${id}/popup/popup.html`;

export const dashboardUrl = (id) =>
  `chrome-extension://${id}/dashboard/dashboard.html`;
