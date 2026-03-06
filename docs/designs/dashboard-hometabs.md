# Dashboard & Home Tabs Design — 2026-03-05

## Overview

Two major features expanding TabSnap beyond the popup into a full browser management experience.

1. **Dashboard** — a full-page New Tab override with cross-window tab view, group cards, recently closed tabs, and usage analytics.
2. **Home Tabs** — a saved set of URLs that auto-open on browser start and can be triggered manually from the popup or dashboard.

---

## Feature 1: Dashboard (New Tab Override)

### Entry point

`manifest.json` gains `"chrome_url_overrides": { "newtab": "dashboard.html" }`. Every new tab opens the dashboard. Chrome does not allow reverting this at runtime, so the opt-out is implemented by having `dashboard.html` read a `dashboardEnabled` flag from `chrome.storage.local` on load — if false, it renders a blank page instantly. The toggle lives in the popup's Settings panel ("Use TabSnap as New Tab").

### Layout

Dark-themed full-page UI matching the popup aesthetic (`#0f0f13` background, `#7c6af7` accent). Fixed left sidebar (200px) + scrollable main content area.

### Sidebar navigation — 4 sections

| Section | Description |
|---------|-------------|
| All Tabs | All tabs across all windows, grouped by window. Click any tab to activate it. Search bar filters in real time. |
| Groups | One card per Chrome tab group — color swatch, name (inline-editable), tab count, member tabs listed. AI Group Tabs button here too. |
| Recent | `chrome.sessions.getRecentlyClosed()` last 25 closed tabs/windows. Each item has a Restore button. |
| Analytics | Visit counts per domain (tracked via `chrome.tabs.onActivated`), tabs open > 7 days, total tab count. |

### Opt-out toggle

Settings panel in the popup gets a new toggle: **"Use TabSnap as New Tab"** (on by default). Saves `dashboardEnabled: boolean` to `chrome.storage.local`. Dashboard reads this on every load.

### Analytics tracking

Background.js listens to `chrome.tabs.onActivated`. On each activation, it reads the tab's URL, extracts the hostname, and increments a counter in `chrome.storage.local` under `analytics: { [hostname]: count }`. This is reliable under MV3 service worker restarts because each event writes to persistent storage immediately. No duration tracking (would require reliable foreground/background detection across restarts).

---

## Feature 2: Home Tabs

### Storage shape

```js
// chrome.storage.local
{
  homeTabs: [{ url: string, title: string, favicon: string }],
  homeTabsAutoOpen: boolean  // default: false
}
```

### Popup panel

New "⌂ Home" link in the popup footer (next to ⚙ Settings). Opens a new slide-in panel (same `.settings-panel` overlay pattern):

- List of saved home tabs — favicon, title, URL, × to remove
- **+ Add current tab** — saves the currently active tab
- **Snapshot all tabs** — saves every open tab in the current window as home tabs (replaces existing list)
- **Auto-open on browser start** toggle
- **Open now** button — opens all home tabs immediately, skipping any already open

### Auto-open on startup

`background.js` listens to `chrome.runtime.onStartup`. On fire, it reads `homeTabsAutoOpen` and `homeTabs`. If enabled, creates a new tab for each saved URL via `chrome.tabs.create({ url, active: false })`, skipping any URL already open in any window (checked via `chrome.tabs.query({})`).

### Dashboard integration

The dashboard header toolbar includes an **"Open Home Tabs"** button that triggers the same open-all logic.

### Duplicate-skip logic

Before opening any home tab, query all currently open tab URLs. Only open URLs not already present. This prevents doubling up when the user has some home tabs already open from a previous session.

---

## New permissions

| Permission | Reason |
|-----------|--------|
| `sessions` | `chrome.sessions.getRecentlyClosed()` for the Recent section |

Existing permissions (`tabs`, `storage`, `tabGroups`, `<all_urls>`) cover everything else.

---

## New files

| File | Purpose |
|------|---------|
| `dashboard.html` | Full-page dashboard shell |
| `dashboard.js` | Dashboard logic — all four sections, analytics reads |
| `dashboard.css` | Dashboard styles — sidebar, cards, section layouts |

## Modified files

| File | Changes |
|------|---------|
| `manifest.json` | `chrome_url_overrides.newtab`, `sessions` permission |
| `background.js` | `chrome.runtime.onStartup` listener, `chrome.tabs.onActivated` analytics listener |
| `popup.html` | Home Tabs panel markup, "⌂ Home" footer link, Settings toggle for dashboard opt-out |
| `popup.js` | Home Tabs panel logic (add, remove, snapshot, open now, toggle) |
| `popup.css` | Home Tabs panel styles, footer third link layout |

---

## What is not changing

- AI grouping logic in `background.js` — untouched
- Existing popup features (search, dedupe, suspend, inline rename, Edit Groups) — untouched
- Settings panel (except adding the dashboard toggle) — untouched
