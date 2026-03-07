# E2E Tests & CI/CD Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Puppeteer E2E tests for the TabSnap Chrome extension and a GitHub Actions CI/CD pipeline with ESLint linting — with zero changes to existing extension files.

**Architecture:** Puppeteer launches real Chromium with the extension loaded via `--load-extension`. Tests navigate directly to `chrome-extension://{id}/popup/popup.html` and `dashboard/dashboard.html`. AI API calls are mocked by overriding `chrome.runtime.sendMessage` via `page.evaluate` before button clicks.

**Tech Stack:** Puppeteer v22 (bundled Chromium), Node.js built-in `node:test` runner, ESLint 8, GitHub Actions

---

### Task 1: Create package.json

**Files:**
- Create: `package.json`

**Step 1: Create the file**

```json
{
  "name": "tab-manager-extension",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/e2e/popup.test.js tests/e2e/dashboard.test.js",
    "lint": "eslint background.js popup/popup.js dashboard/dashboard.js"
  },
  "devDependencies": {
    "eslint": "^8.57.0",
    "puppeteer": "^22.0.0"
  }
}
```

**Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, puppeteer downloads Chromium (~170MB).

**Step 3: Verify install**

```bash
node -e "import('puppeteer').then(m => console.log('puppeteer ok', m.default.version ?? 'loaded'))"
```

Expected: prints `puppeteer ok` with a version or `loaded`.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add package.json with puppeteer and eslint dev deps"
```

---

### Task 2: Create ESLint config

**Files:**
- Create: `.eslintrc.json`

**Step 1: Create the config**

```json
{
  "env": {
    "browser": true,
    "es2022": true
  },
  "globals": {
    "chrome": "readonly"
  },
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "extends": "eslint:recommended",
  "rules": {
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  }
}
```

**Step 2: Run lint to see current state**

```bash
npm run lint
```

Expected: either `0 errors` (clean) or a list of warnings/errors to address. Do NOT fix errors in extension files unless they are genuine bugs — `no-unused-vars` may fire for some variables.

**Step 3: If there are `no-undef` errors for known globals, add them to `.eslintrc.json` globals**

Common additions if needed:
- `Map`, `Set`, `URL`, `fetch`, `setTimeout`, `clearTimeout` — these come from `env.browser: true` so should already be defined.
- If `console` appears as undefined: `"console": "readonly"`.

**Step 4: Confirm lint exits cleanly**

```bash
npm run lint -- --max-warnings 0
```

If this fails due to real warnings in existing code, drop `--max-warnings 0` from the CI check and accept warnings. Record this decision in a comment.

**Step 5: Commit**

```bash
git add .eslintrc.json
git commit -m "chore: add eslint config with recommended rules and chrome globals"
```

---

### Task 3: Create test directory and helpers

**Files:**
- Create: `tests/e2e/helpers.js`

**Step 1: Create the directory**

```bash
mkdir -p tests/e2e
```

**Step 2: Create `tests/e2e/helpers.js`**

```js
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
  // Give the service worker time to register
  await new Promise((r) => setTimeout(r, 1000));
  const targets = browser.targets();
  const sw = targets.find(
    (t) =>
      t.type() === 'service_worker' &&
      t.url().startsWith('chrome-extension://')
  );
  if (!sw) throw new Error('Extension service worker not found. Extension may not have loaded.');
  return new URL(sw.url()).hostname;
}

export const popupUrl = (id) =>
  `chrome-extension://${id}/popup/popup.html`;

export const dashboardUrl = (id) =>
  `chrome-extension://${id}/dashboard/dashboard.html`;
```

**Step 3: Quick smoke-check the helper**

Create a throwaway script `tests/e2e/_smoke.js` (delete after):

```js
import { launchBrowser, getExtensionId } from './helpers.js';
const browser = await launchBrowser();
const id = await getExtensionId(browser);
console.log('Extension ID:', id);
await browser.close();
```

Run it:
```bash
node tests/e2e/_smoke.js
```

Expected: prints a 32-char extension ID like `abcdefghijklmnopabcdefghijklmnop`. If it throws `service worker not found`, increase the `setTimeout` delay in `getExtensionId`.

Delete the smoke script after verifying:
```bash
rm tests/e2e/_smoke.js
```

**Step 4: Commit**

```bash
git add tests/e2e/helpers.js
git commit -m "test: add puppeteer helpers for extension launch and ID extraction"
```

---

### Task 4: Write popup E2E tests

**Files:**
- Create: `tests/e2e/popup.test.js`

**Step 1: Create the test file**

```js
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, getExtensionId, popupUrl } from './helpers.js';

describe('Popup', () => {
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

  // Helper: open a fresh popup page
  async function openPopup() {
    const page = await browser.newPage();
    await page.goto(popupUrl(extensionId));
    await page.waitForSelector('#tab-list');
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
    // Wait for tabs to appear
    await page.waitForSelector('.tab-item');
    const totalBefore = await page.$$eval('.tab-item', (els) => els.length);

    // Type a search query unlikely to match anything
    await page.type('#search-input', 'xyzzy-no-match-12345');
    await new Promise((r) => setTimeout(r, 100)); // debounce

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
    // Panel should now be visible
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
    const page = await openPopup();
    await page.waitForSelector('#btn-group');

    // Set a fake API key so the extension skips the onboarding panel
    await page.evaluate(async () => {
      await chrome.storage.local.set({ apiKey: 'test-key-ci', provider: 'openrouter' });
    });

    // Override sendMessage to return a canned group response — no real API call
    await page.evaluate(() => {
      chrome.runtime.sendMessage = () =>
        Promise.resolve([{ name: 'Work', count: 2 }]);
    });

    await page.click('#btn-group');

    // Wait for the status message to appear and be non-hidden
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

    // Clean up fake API key
    await page.evaluate(async () => {
      await chrome.storage.local.remove('apiKey');
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
    // Either "No duplicate tabs found." or "Closed N duplicate tab(s)."
    assert.ok(
      statusText.includes('duplicate') || statusText.includes('Closed'),
      `Expected dedupe status message, got: "${statusText}"`
    );
    await page.close();
  });
});
```

**Step 2: Run the tests**

```bash
npm test
```

Expected on first run: some tests may fail due to timing. If `getExtensionId` fails, the service worker hasn't registered yet — increase the `setTimeout` in `helpers.js` from 1000ms to 2000ms.

**Step 3: Fix any failures**

Common issues:
- `waitForSelector` timeout → extension page didn't load, check the extension ID was found correctly.
- AI Group test: if onboarding panel appears instead of clicking the button, the `chrome.storage.local.set` call ran after the page already checked for `apiKey`. Fix: call storage set immediately after `page.goto` before any other interaction.
- Status message not appearing → increase the `waitForFunction` timeout.

**Step 4: Confirm all tests pass**

```bash
npm test
```

Expected output:
```
▶ Popup
  ✔ loads and renders tab count
  ✔ search input filters the tab list
  ✔ settings panel opens and closes
  ✔ home tabs panel opens and closes
  ✔ AI Group button shows success with mocked sendMessage
  ✔ Dedupe button shows a status message
▶ Popup (NNNms)
```

**Step 5: Commit**

```bash
git add tests/e2e/popup.test.js
git commit -m "test: add puppeteer E2E tests for popup flows"
```

---

### Task 5: Write dashboard smoke test

**Files:**
- Create: `tests/e2e/dashboard.test.js`

**Step 1: Create the test file**

```js
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

    // Wait for sidebar nav to render
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
```

**Step 2: Run all tests**

```bash
npm test
```

Expected: 8 tests pass total (6 popup + 2 dashboard).

**Step 3: Commit**

```bash
git add tests/e2e/dashboard.test.js
git commit -m "test: add puppeteer E2E smoke tests for dashboard"
```

---

### Task 6: Create GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the directory**

```bash
mkdir -p .github/workflows
```

**Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Run ESLint
        run: npm run lint

  test:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      # Puppeteer's bundled Chromium needs these libs on ubuntu-latest
      - name: Install Chromium system dependencies
        run: |
          sudo apt-get update -q
          sudo apt-get install -y -q \
            libgbm1 \
            libasound2 \
            libatk-bridge2.0-0 \
            libgtk-3-0

      - name: Run E2E tests
        run: npm test
```

**Step 3: Verify the YAML is valid**

```bash
node -e "
import { readFileSync } from 'fs';
const content = readFileSync('.github/workflows/ci.yml', 'utf8');
console.log('File size:', content.length, 'bytes');
console.log('First 3 lines:', content.split('\n').slice(0,3).join('\n'));
"
```

Expected: prints file size and `name: CI`.

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions pipeline with lint and E2E test jobs"
```

---

### Task 7: Add .gitignore entry for node_modules and verify

**Files:**
- Modify: `.gitignore` (create if it doesn't exist)

**Step 1: Check if .gitignore exists**

```bash
cat .gitignore 2>/dev/null || echo "no .gitignore"
```

**Step 2: Add node_modules if not already there**

If `.gitignore` doesn't contain `node_modules`:

```bash
echo "node_modules/" >> .gitignore
```

**Step 3: Verify node_modules isn't tracked**

```bash
git status --short
```

Expected: `node_modules/` does NOT appear in the output.

**Step 4: Run full test suite one final time to confirm everything works**

```bash
npm run lint && npm test
```

Expected: lint passes with 0 errors, all 8 tests pass.

**Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: add node_modules to gitignore"
```

---

### Task 8: Push and verify CI on GitHub

**Step 1: Push the branch**

```bash
git push -u origin fix/dashboard-shortcut-button
```

**Step 2: Check GitHub Actions**

Go to the repository on GitHub → Actions tab. You should see the `CI` workflow running with two parallel jobs: `Lint` and `E2E Tests`.

**Step 3: If a CI job fails**

- Click the failed job to see logs.
- Common CI-only failures:
  - Missing system lib → add it to the `apt-get install` list in `ci.yml`.
  - Extension service worker not found → increase the `setTimeout` in `helpers.js` (CI machines can be slower).
  - `npm ci` fails → commit the `package-lock.json` if missing.

**Step 4: Once both jobs are green, the pipeline is complete.**
