# Drag & Drop Tab Regrouping + Group Color Picker

**Date:** 2026-03-06
**Status:** Approved

## Overview

Add two features to the Groups section of the TabSnap dashboard:
1. Drag and drop tabs between group cards to regroup them
2. Click a group's color dot to open a color picker and change the group's Chrome color
3. A dismissible hint bar explaining both interactions

## Scope

- Groups section only (no cross-section drag from All Tabs)
- No external libraries — native HTML5 Drag & Drop API

## Design

### Drag & Drop

- Each `group-card-tab` element gets `draggable="true"`
- `dragstart`: store tab ID and source group ID in `dataTransfer` (as JSON string)
- `dragover` on `.group-card-tabs`: `preventDefault()` to allow drop; add `.drag-over` CSS class to the parent `.group-card`
- `dragleave` / `drop`: remove `.drag-over` class
- `drop`: parse tab ID + source group ID from `dataTransfer`; if target group differs from source, call `chrome.tabs.group({ tabIds: [tabId], groupId: targetGroupId })`; then call `renderGroups()` to refresh
- Dragging tab: `.dragging` class on the element (opacity 0.4, grab cursor)

### Color Picker

- The `.group-card-dot` becomes a button (`.color-dot-btn`)
- Clicking it opens a `.color-popover` absolutely positioned below the dot
- Popover contains 9 swatches (one per Chrome tab group color: grey, blue, red, yellow, green, pink, purple, cyan, orange)
- Clicking a swatch: calls `chrome.tabGroups.update(groupId, { color: colorName })`, updates the dot's background immediately, closes the popover
- Clicking outside the popover closes it (document `click` listener, removed after close)

### Hint Bar

- Rendered at top of Groups section, above the cards grid
- Content: "↕ Drag tabs between groups to reorganize · Click the color dot to change group color"
- Dismiss button (×) stores `groupsHintDismissed = true` in `localStorage`
- On render, check localStorage; skip hint if dismissed

## Files Changed

| File | Changes |
|------|---------|
| `dashboard/dashboard.js` | Add drag handlers to `createGroupCard` / `group-card-tab`; add `openColorPopover()`; add `renderGroupsHint()` |
| `dashboard/dashboard.css` | Add `.drag-over`, `.dragging`, `.color-dot-btn`, `.color-popover`, `.color-swatch`, `.groups-hint`, `.groups-hint-dismiss` |

## Chrome APIs Used

- `chrome.tabs.group({ tabIds, groupId })` — move tab to target group
- `chrome.tabGroups.update(groupId, { color })` — change group color

## Non-Goals

- Drag from All Tabs into a group
- Reordering group cards themselves
- Creating new groups by drag
