# Tab Features Design — 2026-03-05

## Context

Four features being added to the AI Tab Manager Chrome extension:
1. Grouped tab list (popup reflects Chrome tab groups)
2. Last used timestamps per tab
3. Group rename — inline and panel
4. Suspend Inactive tooltip

---

## Feature 1: Grouped tab list

**Problem:** After AI Group Tabs runs, Chrome tab groups are created in the browser but the popup still renders a flat list. The `.group-header` / `.group-dot` CSS classes exist but are unused.

**Approach:** Replace `renderTabs(tabs)` with `renderGroupedTabs()` that:
1. Calls `chrome.tabGroups.query({ windowId })` to get all groups in the current window.
2. For each group, renders a `.group-header` row (color dot + group name), then lists its tabs underneath using the existing `createTabItem()`.
3. Renders any ungrouped tabs (`groupId === chrome.tabGroups.TAB_GROUP_ID_NONE`) at the bottom under a muted "Ungrouped" label.
4. Falls back to the flat render if there are no groups.

`loadTabs()` is updated to call `renderGroupedTabs()` instead of `renderTabs()`. Search filtering continues to work on the flat `allTabs` array and re-renders grouped when cleared.

**Color mapping:** Chrome tabGroups returns a color name string (e.g. `"blue"`, `"purple"`). A `GROUP_COLOR_MAP` object maps these to hex values for the `.group-dot` background.

---

## Feature 2: Last used timestamps

**Source:** `chrome.tabs.Tab` objects include a `lastAccessed` property (milliseconds since Unix epoch). This is populated by Chrome automatically; no storage or background tracking is needed.

**Display:** Inside `createTabItem()`, the `.tab-url` line is restructured to show the hostname on the left and the relative time right-aligned in the same row. A `formatRelativeTime(ms)` helper converts the timestamp:
- < 1 min: "just now"
- < 60 min: "X min ago"
- < 24 hr: "X hr ago"
- < 7 days: "X day ago"
- Otherwise: "X wk ago"

Tabs with no `lastAccessed` (undefined or 0) show nothing in that slot.

**CSS:** The `.tab-url` element gets `display: flex; justify-content: space-between`. The relative time span gets a slightly dimmer color than the hostname.

---

## Feature 3: Group rename

### Inline edit

In `renderGroupedTabs()`, each group header renders the name as a `<span class="group-name">`. A pencil icon (`✎`) appears on hover via CSS. Clicking the name or icon:
1. Replaces the `<span>` with an `<input>` pre-filled with the current name.
2. On `blur` or `Enter`, calls `chrome.tabGroups.update(groupId, { title: newName })` and re-renders the header row.
3. On `Escape`, cancels with no change.

### Edit Groups panel

After `handleAIGroup()` succeeds, a dismissible banner is injected below the action buttons:
```
[ ✦ X groups created — Edit names → ]  [ × ]
```
Clicking the banner opens an "Edit Groups" panel (same slide-in overlay pattern as Settings):
- Lists each group with its color swatch and a text input pre-filled with the AI-assigned name.
- A **Save** button calls `chrome.tabGroups.update()` for each group whose name changed, then closes the panel.
- A **Back** button discards changes and returns to main view.

The banner is removed once the user saves from the panel or clicks ×.

**HTML:** The Edit Groups panel is added as a sibling `<div>` to `#settings-panel` in `popup.html`. Shown/hidden with the same `.hidden` class pattern.

---

## Feature 4: Suspend Inactive tooltip

The `#btn-suspend` button gets:
```
title="Unloads tabs from memory to save RAM. Tabs reload when you click them."
```
No logic changes needed.

---

## Files changed

| File | Changes |
|------|---------|
| `popup.js` | `renderGroupedTabs()`, updated `loadTabs()`, `createTabItem()` with last-used, inline group rename, Edit Groups panel logic, AI group success banner |
| `popup.html` | Edit Groups panel markup, tooltip on suspend button |
| `popup.css` | `.tab-url` flex layout for hostname + time, group header hover/edit styles, banner styles, Edit Groups panel styles |

---

## What is not changing

- `background.js` — no changes; grouping logic is unaffected
- `manifest.json` — no new permissions needed (`tabGroups` already declared)
- Settings panel — untouched
- Dedupe / search / multi-select — untouched
