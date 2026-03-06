# Drag & Drop Tab Regrouping + Color Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users drag tabs between group cards and change group colors via a dot-click color picker in the Groups dashboard section.

**Architecture:** All changes are in `dashboard/dashboard.js` (event wiring + Chrome API calls) and `dashboard/dashboard.css` (visual states). No external libraries — native HTML5 Drag & Drop. Color picker is a small inline popover; hint bar is a dismissible strip stored in `localStorage`.

**Tech Stack:** Plain JS (ES2020+), HTML5 Drag & Drop API, `chrome.tabs.group()`, `chrome.tabGroups.update()`, `localStorage`

> **No automated tests exist.** Each task ends with a manual Chrome verification step instead of a test run. After any file edit, reload the extension at `chrome://extensions/` (click the refresh icon on the TabSnap card) and open a new tab to see the dashboard.

---

### Task 1: Add CSS — drag states, color popover, hint bar

**Files:**
- Modify: `dashboard/dashboard.css` (append to end of file)

**Step 1: Append new CSS rules**

Add to the very end of `dashboard/dashboard.css`:

```css
/* ── Drag & Drop ─────────────────────────────────────────── */

.group-card-tab[draggable="true"] {
  cursor: grab;
}

.group-card-tab.dragging {
  opacity: 0.35;
  cursor: grabbing;
}

.group-card.drag-over {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-ring);
}

.group-card.drag-over .group-card-tabs {
  background: var(--accent-bg);
  border-radius: 0 0 var(--r) var(--r);
}

/* ── Color Dot Button ────────────────────────────────────── */

.color-dot-btn {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  cursor: pointer;
  border: none;
  padding: 0;
  position: relative;
  transition: box-shadow 0.14s, transform 0.14s;
}

.color-dot-btn:hover {
  transform: scale(1.45);
  box-shadow: 0 0 0 3px var(--border-hi);
}

/* ── Color Popover ───────────────────────────────────────── */

.color-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 100;
  background: var(--bg-surface);
  border: 1px solid var(--border-hi);
  border-radius: 10px;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(5, 20px);
  gap: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.45);
}

.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
}

.color-swatch:hover {
  transform: scale(1.2);
  border-color: rgba(255,255,255,0.4);
}

.color-swatch.active {
  border-color: #fff;
}

/* ── Groups Hint Bar ─────────────────────────────────────── */

.groups-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  margin-bottom: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  font-size: 12px;
  color: var(--text-1);
}

.groups-hint-text {
  flex: 1;
}

.groups-hint-dismiss {
  background: none;
  border: none;
  color: var(--text-2);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
  transition: color 0.12s;
  font-family: inherit;
}

.groups-hint-dismiss:hover {
  color: var(--text-0);
}
```

**Step 2: Manual verify (visual only)**

Reload extension, open a new tab — no visual change expected yet since JS not wired. Confirm no CSS syntax errors by checking DevTools console for errors.

**Step 3: Commit**

```bash
git add dashboard/dashboard.css
git commit -m "style: add drag-drop, color popover, and hint bar CSS"
```

---

### Task 2: Add hint bar to renderGroups()

**Files:**
- Modify: `dashboard/dashboard.js`

**Step 1: Add `renderGroupsHint()` helper function**

Add this function just before the `renderGroups` function (around line 175):

```js
function renderGroupsHint() {
  if (localStorage.getItem("groupsHintDismissed")) return null;

  const hint = document.createElement("div");
  hint.className = "groups-hint";

  const text = document.createElement("span");
  text.className = "groups-hint-text";
  text.textContent = "↕ Drag tabs between groups to reorganize  ·  Click the color dot to change group color";

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "groups-hint-dismiss";
  dismiss.title = "Dismiss";
  dismiss.textContent = "×";
  dismiss.addEventListener("click", () => {
    localStorage.setItem("groupsHintDismissed", "1");
    hint.remove();
  });

  hint.appendChild(text);
  hint.appendChild(dismiss);
  return hint;
}
```

**Step 2: Call `renderGroupsHint()` inside `renderGroups()`**

Find this block in `renderGroups()` (around line 205):

```js
  const cards = document.createElement("div");
  cards.className = "group-cards";
  for (const group of groups) {
    cards.appendChild(createGroupCard(group, groupTabsMap.get(group.id) || []));
  }
  el.appendChild(cards);
```

Replace it with:

```js
  const hint = renderGroupsHint();
  if (hint) el.appendChild(hint);

  const cards = document.createElement("div");
  cards.className = "group-cards";
  for (const group of groups) {
    cards.appendChild(createGroupCard(group, groupTabsMap.get(group.id) || []));
  }
  el.appendChild(cards);
```

**Step 3: Manual verify**

Reload extension, open a new tab, click Groups nav item. Confirm:
- Hint bar appears above the cards with the instruction text
- × button dismisses it
- After dismissing, reload the page — hint should not reappear (stored in localStorage)
- To reset for testing: open DevTools console → `localStorage.removeItem("groupsHintDismissed")`

**Step 4: Commit**

```bash
git add dashboard/dashboard.js
git commit -m "feat: add dismissible hint bar to Groups section"
```

---

### Task 3: Add color picker to group card dot

**Files:**
- Modify: `dashboard/dashboard.js`

**Step 1: Add `openColorPopover()` helper**

Add this function just after `renderGroupsHint()` (before `renderGroups`):

```js
const CHROME_COLORS = [
  { name: "grey",   hex: "#9aa0a6" },
  { name: "blue",   hex: "#1a73e8" },
  { name: "red",    hex: "#d93025" },
  { name: "yellow", hex: "#f9ab00" },
  { name: "green",  hex: "#1e8e3e" },
  { name: "pink",   hex: "#e52592" },
  { name: "purple", hex: "#7c6af7" },
  { name: "cyan",   hex: "#007b83" },
  { name: "orange", hex: "#fa7b17" },
];

function openColorPopover(dotBtn, group) {
  // Close any existing popover
  document.querySelector(".color-popover")?.remove();

  const popover = document.createElement("div");
  popover.className = "color-popover";

  for (const { name, hex } of CHROME_COLORS) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch" + (group.color === name ? " active" : "");
    swatch.style.background = hex;
    swatch.title = name;
    swatch.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await chrome.tabGroups.update(group.id, { color: name });
        group.color = name;
        dotBtn.style.background = hex;
        popover.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
        swatch.classList.add("active");
      } catch { /* group may have been removed */ }
      popover.remove();
    });
    popover.appendChild(swatch);
  }

  // Position relative to dotBtn
  dotBtn.style.position = "relative";
  dotBtn.appendChild(popover);

  // Dismiss on outside click
  const dismiss = (e) => {
    if (!popover.contains(e.target) && e.target !== dotBtn) {
      popover.remove();
      document.removeEventListener("click", dismiss, true);
    }
  };
  setTimeout(() => document.addEventListener("click", dismiss, true), 0);
}
```

**Step 2: Update `createGroupCard()` to use color dot button**

Find in `createGroupCard()` (around line 220):

```js
  const dot = document.createElement("span");
  dot.className = "group-card-dot";
  dot.style.background = GROUP_COLOR_MAP[group.color] || "#6b6b8a";
```

Replace with:

```js
  const dot = document.createElement("button");
  dot.type = "button";
  dot.className = "color-dot-btn";
  dot.style.background = GROUP_COLOR_MAP[group.color] || "#6b6b8a";
  dot.title = "Change group color";
  dot.setAttribute("aria-label", "Change group color");
  dot.addEventListener("click", (e) => {
    e.stopPropagation();
    openColorPopover(dot, group);
  });
```

**Step 3: Manual verify**

Reload extension, open Groups section. Confirm:
- Color dot is clickable (cursor changes on hover, dot scales up slightly)
- Clicking opens a 9-swatch popover
- Hovering swatches scales them
- Current group color swatch has a white ring (`.active`)
- Clicking a swatch changes the dot color and closes the popover
- Switching to Chrome's tab view confirms the group color actually changed
- Clicking outside popover closes it

**Step 4: Commit**

```bash
git add dashboard/dashboard.js
git commit -m "feat: add color picker popover to group cards"
```

---

### Task 4: Add drag & drop between group cards

**Files:**
- Modify: `dashboard/dashboard.js`

**Step 1: Make tab rows draggable in `createGroupCard()`**

Find the loop inside `createGroupCard()` that builds tab rows (around line 240):

```js
  for (const tab of tabs) {
    const tabItem = document.createElement("div");
    tabItem.className = "group-card-tab";
```

Replace the opening of the loop with:

```js
  for (const tab of tabs) {
    const tabItem = document.createElement("div");
    tabItem.className = "group-card-tab";
    tabItem.draggable = true;
    tabItem.addEventListener("dragstart", (e) => {
      tabItem.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify({ tabId: tab.id, srcGroupId: group.id }));
    });
    tabItem.addEventListener("dragend", () => {
      tabItem.classList.remove("dragging");
    });
```

**Step 2: Make the group card a drop target**

At the end of `createGroupCard()`, just before `return card`, add:

```js
  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    card.classList.add("drag-over");
  });

  card.addEventListener("dragleave", (e) => {
    // Only remove if leaving the card itself (not a child)
    if (!card.contains(e.relatedTarget)) {
      card.classList.remove("drag-over");
    }
  });

  card.addEventListener("drop", async (e) => {
    e.preventDefault();
    card.classList.remove("drag-over");
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch { return; }
    const { tabId, srcGroupId } = payload;
    if (srcGroupId === group.id) return; // same group, no-op
    try {
      await chrome.tabs.group({ tabIds: [tabId], groupId: group.id });
      await renderGroups();
    } catch { /* tab or group may no longer exist */ }
  });
```

**Step 3: Manual verify**

Reload extension. Open Groups section (you need at least 2 groups — use AI Group Tabs if needed). Confirm:
- Hovering a tab row shows a grab cursor
- Dragging a tab shows it as semi-transparent (`.dragging`)
- Dragging over a different group card highlights it with accent border
- Dropping moves the tab — both cards refresh to show updated tab counts
- Dragging a tab back to its own card does nothing
- Chrome's actual tab view shows the tab now belongs to the new group

**Step 4: Commit**

```bash
git add dashboard/dashboard.js
git commit -m "feat: drag and drop tabs between group cards"
```

---

### Task 5: Remove duplicate GROUP_COLOR_MAP

**Files:**
- Modify: `dashboard/dashboard.js`

**Step 1: Remove the now-duplicate constant**

In Task 3 we added `CHROME_COLORS` which contains the same data as the existing `GROUP_COLOR_MAP` at the top of the file. Update `openColorPopover` and `createGroupCard` to use `GROUP_COLOR_MAP` instead, then remove `CHROME_COLORS`.

Replace the `CHROME_COLORS` array (added in Task 3) with a derived constant that reuses `GROUP_COLOR_MAP`:

```js
const CHROME_COLORS = Object.entries(GROUP_COLOR_MAP).map(([name, hex]) => ({ name, hex }));
```

**Step 2: Manual verify**

Reload extension. Confirm color picker still works (all 9 colors appear, selecting changes the group color).

**Step 3: Commit**

```bash
git add dashboard/dashboard.js
git commit -m "refactor: derive CHROME_COLORS from GROUP_COLOR_MAP"
```

---

## Done

All features are live. To verify the full flow end-to-end:
1. Open a new tab (dashboard)
2. Navigate to Groups — hint bar appears
3. Click a color dot — popover shows 9 swatches, clicking one changes the group color
4. Drag a tab from one group card to another — tab moves, both cards update
5. Dismiss hint — doesn't reappear on reload
