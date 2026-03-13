# TabSnap — AI Tab Manager

A Chrome extension that uses AI to intelligently group, organize, and manage your browser tabs. Includes a full-page dashboard accessible from the toolbar or via keyboard shortcut.

## Prerequisites

- Google Chrome (or any Chromium-based browser)
- An API key from one of the supported providers (Anthropic, OpenRouter, Groq, or any OpenAI-compatible endpoint)

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the project folder.
5. The TabSnap icon will appear in your toolbar. Pin it for easy access.

## Setup

Click the extension icon, then open **Settings** and configure your API provider and key. The key is saved locally in your browser and never sent anywhere except directly to your chosen AI provider.

Supported providers:
- **Anthropic** (Claude) — [console.anthropic.com](https://console.anthropic.com)
- **OpenRouter** — free models available at [openrouter.ai](https://openrouter.ai/keys)
- **Groq** — free tier at [console.groq.com](https://console.groq.com/keys)
- **Custom** — any OpenAI-compatible endpoint

---

## Features

### Dashboard

Open the full-page TabSnap dashboard by clicking the **grid icon** in the popup header or pressing **Alt+Y**. Four sections:

- **All Tabs** — every open tab across every window, searchable. Click any tab to switch to it.
- **Groups** — visual card view of your Chrome tab groups. Rename groups inline. Run AI grouping from here.
- **Recent** — recently closed tabs and windows with one-click restore.
- **Analytics** — most visited domains, tabs open longer than a week, and visit counts.

### AI Group Tabs

Sends your open tabs to AI, which categorizes them into labeled groups (e.g. Work, Research, Shopping, Social). Groups with more than 3 tabs are auto-collapsed. After grouping, the popup reflects the groups with color-coded headers.

Before sending, a confirmation dialog shows you exactly which tabs will be shared and reminds you that only tab titles and URLs are sent — directly to your chosen provider, not through any intermediary server.

If you haven't set an API key yet, an onboarding prompt appears the first time you click **AI Group Tabs**, guiding you to get a free OpenRouter key and get started immediately.

You can also select specific tabs with their checkboxes and AI-group only those.

### Rename Groups

Click any group header in the tab list or dashboard to rename it inline. Or use the **Edit Groups** panel (appears after AI grouping) to batch-rename all groups at once.

### Saved Tabs

Save a set of tabs to restore any time. Access via **Saved Tabs** in the popup footer.

- **+ Add current tab** — saves the tab you're on
- **Save all open tabs** — saves every open tab in the current window as your saved set
- **Auto-open on browser start** toggle — opens your saved tabs automatically when Chrome launches (skips any already open)
- **Open all saved tabs** — launch saved tabs any time, manually

### Last Used

Each tab displays how long ago you last visited it ("5 min ago", "2 hr ago"). Useful for finding stale tabs.

### Dedupe

Closes duplicate tabs that share the exact same URL, keeping one copy of each.

### Suspend Inactive

Discards idle tabs from memory without closing them. The tab reloads when you switch back to it — useful when you have many tabs open and want to free up RAM. Tabs that are playing audio are not suspended.

### Search

Filter your open tabs by title or URL in real time using the search bar in the popup or dashboard.

### Multi-select & Close

Check multiple tabs in the popup list and close them all at once with the **Close selected** button.

### Privacy

Tab visit frequency is tracked **locally** to power usage analytics. This data never leaves your device. You can clear it at any time from **Settings → Clear local analytics**.

---

## Keyboard Shortcut

| Shortcut | Action |
|----------|--------|
| `Alt+Y` | Open TabSnap Dashboard |

---

## Updating After Code Changes

Because this extension has no build step, after editing any source file:

1. Go to `chrome://extensions/`.
2. Click the **refresh icon** on the TabSnap card.
3. Close and reopen the popup or dashboard tab.

---

## Publishing The Privacy Policy

This repo includes a public privacy policy page at `privacy-policy.html` that can be hosted with GitHub Pages for Chrome Web Store submission.

1. Push the repository to a public GitHub repo.
2. In GitHub, open **Settings -> Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your default branch and the **/ (root)** folder, then save.
5. Wait for GitHub Pages to publish the site.
6. Use the public URL for `privacy-policy.html` in the Chrome Web Store Developer Dashboard under your item's **Privacy** tab.

The URL will usually look like:

```text
https://YOUR-USERNAME.github.io/REPO-NAME/privacy-policy.html
```

Before publishing, update the contact section in `privacy-policy.html` with your real support email or support page.

---

## Project Structure

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 config — permissions, service worker, keyboard shortcuts |
| `background.js` | Service worker — AI grouping, startup saved tabs, analytics tracking |
| `popup/popup.html/js/css` | Toolbar popup — quick controls, Saved Tabs panel, Settings |
| `dashboard/dashboard.html/js/css` | Full-page dashboard — all tabs, groups, recent, analytics |
| `docs/plans/` | Design docs and implementation plans |
| `tests/e2e/` | Puppeteer end-to-end tests |

---

## Running Tests Locally

### Prerequisites

- Node.js 20+
- npm

### Install dependencies

```bash
npm install
```

This downloads Puppeteer's bundled Chromium (~170 MB on first run).

### Lint

```bash
npm run lint
```

Runs ESLint across `background.js`, `popup/popup.js`, and `dashboard/dashboard.js`. Exit code 0 means clean.

### E2E tests

```bash
npm test
```

Launches a real Chromium instance with the extension loaded, runs end-to-end tests across the popup and dashboard, then closes the browser. Takes about 15–30 seconds.

AI API calls are mocked — no API key is required to run the tests.

### Run lint and tests together

```bash
npm run lint && npm test
```
