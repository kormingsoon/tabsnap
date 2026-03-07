# E2E Tests & CI/CD Pipeline Design

## Overview

Add Puppeteer-based end-to-end tests (as recommended by Google for Chrome extensions) and a GitHub Actions CI/CD pipeline with ESLint linting.

## Constraints

- No changes to existing extension files
- No build tooling introduced (package.json is dev-only)
- AI API calls mocked in tests — no real API key required in CI
- Uses Node's built-in `node:test` runner to minimise dependencies

## File Structure

```
tab-manager-extension/
├── package.json                    # dev deps: puppeteer, eslint
├── .eslintrc.json                  # eslint:recommended, browser + chrome globals
├── .github/
│   └── workflows/
│       └── ci.yml                  # lint + test jobs
└── tests/
    └── e2e/
        ├── helpers.js              # launch Chrome with extension, get extension ID
        ├── popup.test.js           # popup flow tests
        └── dashboard.test.js       # dashboard smoke test
```

## Test Approach

### Extension loading

Puppeteer launches real Chromium via `--load-extension` and `--disable-extensions-except` flags. The extension ID is extracted from `browser.targets()` after launch.

### AI mock

Before the popup page runs its JS, `page.evaluate` overrides `chrome.runtime.sendMessage` to return a canned response:
```js
[{ name: "Work", count: 2 }]
```
This prevents any real network call while still exercising the full popup UI flow.

### Real Chrome APIs

`chrome.tabs`, `chrome.storage`, and `chrome.tabGroups` run normally — the test opens real browser tabs to populate the tab list.

## Test Coverage

### popup.test.js

1. Popup page loads — tab count badge and tab list are visible
2. Search input filters the displayed tabs
3. Settings panel opens and closes via the settings link and back button
4. Home tabs panel opens and closes
5. AI Group button — mocked `sendMessage` returns 1 group; status message shows "Created 1 tab groups"
6. Dedupe — opens two tabs with the same URL, triggers dedupe, verifies one is closed

### dashboard.test.js

1. Dashboard page loads — main heading is visible

## CI/CD Pipeline

Two jobs run in parallel on every push and every pull request targeting `main`.

### lint job

```
- actions/checkout
- actions/setup-node (Node 20)
- npm ci
- npx eslint background.js popup/popup.js dashboard/dashboard.js
```

### test job

```
- actions/checkout
- actions/setup-node (Node 20)
- npm ci
- node --test tests/e2e/popup.test.js tests/e2e/dashboard.test.js
```

Puppeteer downloads its own bundled Chromium, so no separate Chrome install step is needed.

### Branch protection

PRs to `main` are blocked if either job fails.

## ESLint Config

- Extends `eslint:recommended`
- `env: { browser: true, es2022: true }`
- Globals: `chrome` (readonly)
- `parserOptions: { ecmaVersion: 2022, sourceType: module }`

## Dependencies (dev only)

| Package | Version | Purpose |
|---------|---------|---------|
| puppeteer | ^22 | Chrome automation + bundled Chromium |
| eslint | ^9 | JS linting |
