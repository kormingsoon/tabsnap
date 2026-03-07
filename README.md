# TabSnap — AI Tab Manager

A Chrome extension that uses AI to intelligently group, organize, and manage your browser tabs. Includes a full-page dashboard that replaces the New Tab page.

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

Click the extension icon, then open **⚙ Settings** and configure your API provider and key. The key is saved locally in your browser and never sent anywhere except directly to your chosen AI provider.

Supported providers:
- **Anthropic** (Claude) — [console.anthropic.com](https://console.anthropic.com)
- **OpenRouter** — free models available at [openrouter.ai](https://openrouter.ai/keys)
- **Groq** — free tier at [console.groq.com](https://console.groq.com/keys)
- **Custom** — any OpenAI-compatible endpoint

---

## Features

### Dashboard (New Tab)
Every new tab opens the TabSnap dashboard — a full-page command center for all your tabs across all windows. Four sections:

- **All Tabs** — every open tab across every window, searchable. Click any tab to switch to it.
- **Groups** — visual card view of your Chrome tab groups. Rename groups inline. Run AI grouping from here.
- **Recent** — the last 25 closed tabs and windows with one-click restore.
- **Analytics** — most visited domains, tabs open longer than a week, and visit counts.

> Prefer Chrome's default New Tab? Toggle it off in **⚙ Settings → Use TabSnap as New Tab**.

### AI Group Tabs
Sends your open tabs to AI, which categorizes them into labeled groups (e.g. Work, Research, Shopping, Social). Groups with 3 or more tabs are auto-collapsed. After grouping, the popup reflects the groups with color-coded headers.

### Rename Groups
Click any group header in the tab list or dashboard to rename it inline. Or use the **Edit Groups** panel (appears after AI grouping) to batch-rename all groups at once.

### Home Tabs
Save a set of tabs that represent your ideal starting point. Access via **⌂ Home** in the popup footer.

- **+ Add current tab** — saves the tab you're on
- **Snapshot all tabs** — saves every open tab in the current window
- **Auto-open on browser start** toggle — opens your home tabs automatically when Chrome launches (skips any already open)
- **Open now** — launch home tabs any time, manually

### Last Used
Each tab displays how long ago you last visited it ("5 min ago", "2 hr ago"). Useful for finding stale tabs.

### Dedupe
Closes duplicate tabs that share the exact same URL, keeping one copy of each.

### Suspend Inactive
Discards idle tabs from memory without closing them. The tab reloads when you switch back to it — useful when you have many tabs open and want to free up RAM.

### Search
Filter your open tabs by title or URL in real time using the search bar in the popup or dashboard.

### Multi-select & Close
Check multiple tabs in the popup list and close them all at once with the **Close Selected** button.

---

## Updating After Code Changes

Because this extension has no build step, after editing any source file:

1. Go to `chrome://extensions/`.
2. Click the **refresh icon** on the TabSnap card.
3. Close and reopen the popup or dashboard tab.

---

## Project Structure

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 config — permissions, service worker, New Tab override |
| `background.js` | Service worker — AI grouping, startup home tabs, analytics tracking |
| `popup.html/js/css` | Toolbar popup — quick controls, Home Tabs panel, Settings |
| `dashboard.html/js/css` | Full-page New Tab dashboard |
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

Launches a real Chromium instance with the extension loaded, runs 8 end-to-end tests across the popup and dashboard, then closes the browser. Takes about 15–30 seconds.

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

▶ Dashboard
  ✔ loads and shows sidebar nav items
  ✔ main search input is present
▶ Dashboard (NNNms)

# tests 8
# pass 8
# fail 0
```

AI API calls are mocked — no API key is required to run the tests.

### Run lint and tests together

```bash
npm run lint && npm test
```
