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
 * Wait for the extension's background service worker to register,
 * then extract the extension ID from its URL.
 * URL format: chrome-extension://<id>/background.js
 *
 * In headless CI, Chrome often doesn't activate the service worker until
 * a page is opened. We open a blank page first to trigger activation.
 */
export async function getExtensionId(browser) {
  const isSw = (t) =>
    t.type() === 'service_worker' && t.url().startsWith('chrome-extension://');

  // Check if it's already registered
  const existing = browser.targets().find(isSw);
  if (existing) return new URL(existing.url()).hostname;

  // Open a page to prompt Chrome to activate the service worker
  const warmup = await browser.newPage();
  await warmup.goto('about:blank');
  await warmup.close();

  // Wait for the service worker (extended timeout for slow CI runners)
  const swTarget = await browser.waitForTarget(isSw, { timeout: 30000 });
  return new URL(swTarget.url()).hostname;
}

export const popupUrl = (id) =>
  `chrome-extension://${id}/popup/popup.html`;

export const dashboardUrl = (id) =>
  `chrome-extension://${id}/dashboard/dashboard.html`;
