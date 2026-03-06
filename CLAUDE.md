# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Tab Manager is a Chrome extension (Manifest V3) that uses the Claude API to intelligently group browser tabs. It has zero build tooling — all files are plain HTML/CSS/JS loaded directly by Chrome.

## Loading & Testing

Since there is no build step, development is done by:
1. Opening `chrome://extensions/` in Chrome
2. Enabling "Developer mode"
3. Clicking "Load unpacked" and selecting this directory
4. After editing files, click the refresh icon on the extension card

There are no automated tests, linters, or test commands.

## Architecture

### Files

| File | Role |
|------|------|
| `manifest.json` | MV3 config — permissions, service worker, popup registration |
| `background.js` | Service worker: receives `AI_GROUP_TABS` message, calls Claude API, applies `chrome.tabGroups` |
| `popup/popup.js` | All UI logic: tab list, search, dedup, suspend, settings panel, message passing |
| `popup/popup.html` | Popup shell (thin — all structure rendered by popup.js) |
| `popup/popup.css` | Dark-theme styles (360px wide popup, purple `#7c6af7` accent) |
| `dashboard/dashboard.html` | New tab override — home tabs dashboard |
| `dashboard/dashboard.js` | Dashboard UI logic: home tabs, pinned tabs, session management |
| `dashboard/dashboard.css` | Dashboard styles |

### Data Flow

```
User clicks "AI Group Tabs"
  → popup.js sends {type: "AI_GROUP_TABS", apiKey, tabs} to background
  → background.js POSTs to https://api.anthropic.com/v1/messages
      model: claude-haiku-4-5-20251001, max_tokens: 1024
      prompt: tab titles/URLs → Claude returns JSON [{name, tabIndexes}]
  → background.js calls chrome.tabs.group() + chrome.tabGroups.update() per group
  → Returns group summary to popup for status display
```

### Storage

- API key stored in `chrome.storage.local` under key `apiKey`
- No other persistent state

### Permissions

`tabs`, `storage`, `activeTab`, `tabGroups`, `<all_urls>` (needed to read tab URLs for grouping prompt)

## Key Constraints

- **MV3 service worker**: `background.js` cannot use DOM APIs or persistent global state across browser restarts
- **No npm/bundler**: Do not introduce build tooling without discussion — keep files directly loadable by Chrome
- **Direct API calls**: The service worker fetches Anthropic's API directly with the user's key; no proxy
- **9 group colors**: Chrome's `tabGroups` API supports: `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange`
