# AI Tab Manager

A Chrome extension that uses Claude AI to intelligently group, deduplicate, and manage your browser tabs.

## Prerequisites

- Google Chrome (or any Chromium-based browser)
- An [Anthropic API key](https://console.anthropic.com)

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the project folder.
5. The AI Tab Manager icon will appear in your toolbar. Pin it for easy access.

## Setup

Click the extension icon, then open **Settings** (gear icon) and paste your Anthropic API key. It is saved locally in your browser and never sent anywhere except directly to the Anthropic API.

## Features

### AI Group Tabs
Sends your open tabs to Claude, which categorizes them into labeled groups (e.g. Work, Research, Shopping, Social). Groups with 3 or more tabs are auto-collapsed to reduce clutter. After grouping, the popup tab list reflects the groups with color-coded headers.

### Rename Groups
After AI grouping, click any group header in the tab list to rename it inline. You can also click the **Edit Groups** banner that appears after grouping to open a panel and rename all groups at once.

### Last Used
Each tab displays how long ago you last visited it (e.g. "5 min ago", "2 hr ago"). Useful for identifying tabs you haven't touched in a while.

### Dedupe
Closes duplicate tabs that share the exact same URL, keeping one copy of each.

### Suspend Inactive
Discards idle tabs from memory without closing them. The tab reloads when you switch back to it — useful when you have many tabs open and want to free up RAM.

### Search
Filter your open tabs by title or URL in real time using the search bar.

### Multi-select & Close
Check multiple tabs in the list and close them all at once with the **Close Selected** button.

## Updating After Code Changes

Because this extension has no build step, after editing any source file:

1. Go to `chrome://extensions/`.
2. Click the **refresh icon** on the AI Tab Manager card.
3. Close and reopen the popup.
