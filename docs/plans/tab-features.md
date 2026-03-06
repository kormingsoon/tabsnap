# Tab Manager Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add grouped tab list, last-used timestamps, group renaming (inline + panel), and a suspend tooltip to the AI Tab Manager Chrome extension.

**Architecture:** All changes are in the three front-end files (`popup.js`, `popup.html`, `popup.css`). No new permissions, no background.js changes. The extension has zero build tooling — reload via `chrome://extensions/` after each task.

**Tech Stack:** Plain JS/HTML/CSS, Chrome Extension Manifest V3, `chrome.tabGroups` API, `chrome.tabs` API (`lastAccessed` field).

**Design doc:** `docs/plans/2026-03-05-tab-features-design.md`

---

## How to reload and test

After every file change:
1. Go to `chrome://extensions/`
2. Click the **refresh icon** on the AI Tab Manager card
3. Click the extension icon to open the popup
4. Verify the step's expected behavior manually

---

## Task 1: Suspend Inactive tooltip

**Files:**
- Modify: `popup.html`

**Step 1: Add title attribute to the suspend button**

In `popup.html`, find:
```html
<button id="btn-suspend" class="action-btn">
  Suspend Inactive
</button>
```
Replace with:
```html
<button id="btn-suspend" class="action-btn" title="Unloads tabs from memory to save RAM. Tabs reload when you click them.">
  Suspend Inactive
</button>
```

**Step 2: Verify**

Reload the extension. Hover over the **Suspend Inactive** button. A browser tooltip should appear with the explanation text.

**Step 3: Commit**

```bash
git add popup.html
git commit -m "feat: add tooltip to Suspend Inactive button"
```

---

## Task 2: Last used timestamps

**Files:**
- Modify: `popup.js`
- Modify: `popup.css`

### Step 1: Add `formatRelativeTime` helper to `popup.js`

Add this function after the `const $ = (id) => ...` line at the top of `popup.js`:

```js
function formatRelativeTime(ms) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} day ago`;
  return `${Math.floor(diff / 604_800_000)} wk ago`;
}
```

### Step 2: Update `createTabItem` to show last-used time

In `createTabItem`, find the block that creates `url` and appends to `info`:
```js
  const url = document.createElement("span");
  url.className = "tab-url";
  try {
    url.textContent = new URL(tab.url).hostname;
  } catch {
    url.textContent = tab.url;
  }

  info.appendChild(title);
  info.appendChild(url);
```

Replace it with:
```js
  const urlRow = document.createElement("div");
  urlRow.className = "tab-url-row";

  const url = document.createElement("span");
  url.className = "tab-url";
  try {
    url.textContent = new URL(tab.url).hostname;
  } catch {
    url.textContent = tab.url;
  }

  const lastUsed = document.createElement("span");
  lastUsed.className = "tab-last-used";
  lastUsed.textContent = formatRelativeTime(tab.lastAccessed);

  urlRow.appendChild(url);
  urlRow.appendChild(lastUsed);

  info.appendChild(title);
  info.appendChild(urlRow);
```

### Step 3: Add CSS for the url row and last-used span

In `popup.css`, find the `.tab-url` rule and replace it with:
```css
.tab-url-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
}

.tab-url {
  display: block;
  font-size: 10px;
  color: #4a4a6a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.tab-last-used {
  font-size: 10px;
  color: #3a3a52;
  flex-shrink: 0;
  padding-left: 6px;
  white-space: nowrap;
}
```

### Step 4: Verify

Reload the extension. Open the popup. Each tab row should show the hostname on the left and a relative time like "5 min ago" on the right of the lower line. A tab you just visited shows "just now".

### Step 5: Commit

```bash
git add popup.js popup.css
git commit -m "feat: show last-used timestamp per tab"
```

---

## Task 3: Grouped tab list

**Files:**
- Modify: `popup.js`
- Modify: `popup.css`

### Step 1: Add `GROUP_COLOR_MAP` to `popup.js`

Add this constant after the `const $ = ...` line at the top:
```js
const GROUP_COLOR_MAP = {
  grey:   "#9aa0a6",
  blue:   "#1a73e8",
  red:    "#d93025",
  yellow: "#f9ab00",
  green:  "#1e8e3e",
  pink:   "#e52592",
  purple: "#7c6af7",
  cyan:   "#007b83",
  orange: "#fa7b17",
};
```

### Step 2: Add `createGroupHeader` function

Add this function just before `createTabItem` in `popup.js`:
```js
function createGroupHeader(group) {
  const header = document.createElement("div");
  header.className = "group-header";
  header.dataset.groupId = group.id;

  const dot = document.createElement("span");
  dot.className = "group-dot";
  dot.style.background = GROUP_COLOR_MAP[group.color] || "#6b6b8a";

  const nameSpan = document.createElement("span");
  nameSpan.className = "group-name";
  nameSpan.textContent = group.title || "Unnamed";

  const editIcon = document.createElement("span");
  editIcon.className = "group-edit-icon";
  editIcon.textContent = "✎";
  editIcon.title = "Rename group";

  const clickHandler = () => startInlineRename(header, group);
  nameSpan.addEventListener("click", clickHandler);
  editIcon.addEventListener("click", clickHandler);

  header.appendChild(dot);
  header.appendChild(nameSpan);
  header.appendChild(editIcon);

  return header;
}
```

### Step 3: Add `renderGroupedTabs` function

Add this function just after `renderTabs` in `popup.js`:
```js
async function renderGroupedTabs() {
  const list = $("tab-list");
  list.innerHTML = "";

  if (allTabs.length === 0) {
    list.innerHTML = '<div class="loading">No tabs found</div>';
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const windowId = activeTab?.windowId;
  let groups = [];
  try {
    groups = windowId != null
      ? await chrome.tabGroups.query({ windowId })
      : [];
  } catch {
    // tabGroups unavailable — fall through to flat render
  }

  if (groups.length === 0) {
    for (const tab of allTabs) {
      list.appendChild(createTabItem(tab));
    }
    return;
  }

  // Map groupId -> tabs
  const groupTabsMap = new Map();
  const ungroupedTabs = [];
  for (const tab of allTabs) {
    const gid = tab.groupId;
    if (gid != null && gid !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      if (!groupTabsMap.has(gid)) groupTabsMap.set(gid, []);
      groupTabsMap.get(gid).push(tab);
    } else {
      ungroupedTabs.push(tab);
    }
  }

  for (const group of groups) {
    const tabs = groupTabsMap.get(group.id) || [];
    if (tabs.length === 0) continue;
    list.appendChild(createGroupHeader(group));
    for (const tab of tabs) {
      list.appendChild(createTabItem(tab));
    }
  }

  if (ungroupedTabs.length > 0) {
    const ungroupedHeader = document.createElement("div");
    ungroupedHeader.className = "group-header ungrouped-header";
    ungroupedHeader.innerHTML =
      '<span class="group-dot" style="background:#3a3a52"></span><span>Ungrouped</span>';
    list.appendChild(ungroupedHeader);
    for (const tab of ungroupedTabs) {
      list.appendChild(createTabItem(tab));
    }
  }
}
```

### Step 4: Update `loadTabs` to call `renderGroupedTabs`

Find `loadTabs`:
```js
async function loadTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  allTabs = tabs;
  $("tab-count").textContent = tabs.length;
  renderTabs(tabs);
}
```
Replace the last line `renderTabs(tabs);` with `await renderGroupedTabs();`.

### Step 5: Update search to re-render grouped on clear

In `setupListeners`, find the search handler:
```js
  $("search-input").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderTabs(allTabs);
      return;
    }
```
Replace `renderTabs(allTabs);` with `renderGroupedTabs();`.

### Step 6: Add CSS for group header interactive styles

In `popup.css`, find the existing `.group-header` rule and add these rules after it:
```css
.group-edit-icon {
  opacity: 0;
  font-size: 10px;
  color: #6b6b8a;
  cursor: pointer;
  transition: opacity 0.1s;
  margin-left: 4px;
}

.group-header:hover .group-edit-icon {
  opacity: 1;
}

.group-name {
  cursor: pointer;
}

.group-name:hover {
  color: #a09af5;
}

.group-name-input {
  background: #1a1a24;
  border: 1px solid #7c6af7;
  border-radius: 3px;
  padding: 1px 6px;
  color: #e8e8f0;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  outline: none;
  width: 130px;
}

.ungrouped-header {
  margin-top: 4px;
  opacity: 0.5;
}
```

### Step 7: Verify

Reload the extension. If Chrome has tab groups open, the popup should now show colored group headers with tab lists under them, and an "Ungrouped" section at the bottom. If no groups exist, it shows the flat list as before.

### Step 8: Commit

```bash
git add popup.js popup.css
git commit -m "feat: render grouped tabs in popup with group headers"
```

---

## Task 4: Inline group rename

**Files:**
- Modify: `popup.js`

The `createGroupHeader` function added in Task 3 already wires up click handlers pointing to `startInlineRename`. This task implements that function.

### Step 1: Add `startInlineRename` to `popup.js`

Add this function after `createGroupHeader`:
```js
function startInlineRename(headerEl, group) {
  const nameSpan = headerEl.querySelector(".group-name");
  const editIcon = headerEl.querySelector(".group-edit-icon");
  if (!nameSpan) return;
  const currentName = nameSpan.textContent;

  const input = document.createElement("input");
  input.className = "group-name-input";
  input.value = currentName;

  nameSpan.replaceWith(input);
  editIcon.style.display = "none";
  input.focus();
  input.select();

  let saved = false;

  const finish = async (save) => {
    if (saved) return;
    saved = true;
    const newName = input.value.trim() || currentName;
    if (save && newName !== currentName) {
      try {
        await chrome.tabGroups.update(group.id, { title: newName });
        group.title = newName;
      } catch {
        // group may have been removed
      }
    }
    const newSpan = document.createElement("span");
    newSpan.className = "group-name";
    newSpan.textContent = save ? newName : currentName;
    newSpan.addEventListener("click", () => startInlineRename(headerEl, group));
    input.replaceWith(newSpan);
    editIcon.style.display = "";
  };

  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
}
```

### Step 2: Verify

Reload the extension. With tab groups present, click a group name in the popup. It should become an editable input. Type a new name, press Enter — the Chrome tab group should update in the tab bar immediately. Press Escape — change should be discarded.

### Step 3: Commit

```bash
git add popup.js
git commit -m "feat: inline rename for tab groups"
```

---

## Task 5: Edit Groups panel + post-AI banner

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`
- Modify: `popup.css`

### Step 1: Add Edit Groups panel markup to `popup.html`

After the closing `</div>` of `#settings-panel`, add:
```html
<div id="edit-groups-panel" class="settings-panel hidden">
  <div class="settings-header">
    <button id="edit-groups-back-btn" class="link-btn">← Back</button>
    <h2>Edit Groups</h2>
  </div>
  <div class="settings-body" id="edit-groups-body">
  </div>
  <div class="edit-groups-footer">
    <button id="save-groups-btn" class="action-btn primary">Save</button>
  </div>
</div>
```

### Step 2: Add `showGroupsBanner` to `popup.js`

Add this function after `handleAIGroup`:
```js
function showGroupsBanner(groupCount) {
  let banner = $("groups-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "groups-banner";
    banner.className = "groups-banner";
    $("status-message").insertAdjacentElement("afterend", banner);
  }
  banner.innerHTML = `
    <span>✦ ${groupCount} groups created —
      <button class="link-btn banner-edit-btn">Edit names →</button>
    </span>
    <button class="link-btn banner-dismiss">×</button>
  `;
  banner.querySelector(".banner-edit-btn").addEventListener("click", showEditGroupsPanel);
  banner.querySelector(".banner-dismiss").addEventListener("click", () => banner.remove());
}
```

### Step 3: Show the banner after successful AI grouping

In `handleAIGroup`, find:
```js
    showStatus(`Created ${groups.length} tab groups.`, "success");
    await loadTabs();
```
Replace with:
```js
    showStatus(`Created ${groups.length} tab groups.`, "success");
    await loadTabs();
    showGroupsBanner(groups.length);
```

### Step 4: Add `showEditGroupsPanel` and `saveGroups` to `popup.js`

Add these functions after `showGroupsBanner`:
```js
async function showEditGroupsPanel() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const windowId = activeTab?.windowId;
  let groups = [];
  try {
    groups = windowId != null ? await chrome.tabGroups.query({ windowId }) : [];
  } catch { /* unavailable */ }

  const body = $("edit-groups-body");
  body.innerHTML = "";

  for (const group of groups) {
    const item = document.createElement("div");
    item.className = "setting-item";

    const labelRow = document.createElement("div");
    labelRow.className = "edit-group-label";

    const dot = document.createElement("span");
    dot.className = "group-dot";
    dot.style.background = GROUP_COLOR_MAP[group.color] || "#6b6b8a";

    const label = document.createElement("span");
    label.className = "setting-label";
    label.textContent = group.title || "Unnamed";

    labelRow.appendChild(dot);
    labelRow.appendChild(label);

    const input = document.createElement("input");
    input.type = "text";
    input.value = group.title || "";
    input.placeholder = "Group name";
    input.dataset.groupId = group.id;
    input.dataset.originalName = group.title || "";

    item.appendChild(labelRow);
    item.appendChild(input);
    body.appendChild(item);
  }

  $("edit-groups-panel").classList.remove("hidden");
}

async function saveGroups() {
  const inputs = $("edit-groups-body").querySelectorAll("input[data-group-id]");
  for (const input of inputs) {
    const groupId = parseInt(input.dataset.groupId);
    const newName = input.value.trim();
    if (newName !== input.dataset.originalName) {
      try {
        await chrome.tabGroups.update(groupId, { title: newName });
      } catch { /* group may be gone */ }
    }
  }
  $("edit-groups-panel").classList.add("hidden");
  const banner = $("groups-banner");
  if (banner) banner.remove();
  await loadTabs();
  showStatus("Groups updated.", "success");
}
```

### Step 5: Wire up panel buttons in `setupListeners`

In `setupListeners`, add at the end:
```js
  $("edit-groups-back-btn").addEventListener("click", () => {
    $("edit-groups-panel").classList.add("hidden");
  });
  $("save-groups-btn").addEventListener("click", saveGroups);
```

### Step 6: Add CSS for banner and Edit Groups panel

In `popup.css`, add at the end:
```css
/* Groups banner */
.groups-banner {
  margin: 4px 12px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #1a1a24;
  border-left: 3px solid #7c6af7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #a09af5;
  gap: 6px;
}

.banner-edit-btn {
  color: #a09af5;
  font-size: 11px;
  text-decoration: underline;
}

.banner-dismiss {
  color: #6b6b8a;
  font-size: 14px;
  line-height: 1;
}

/* Edit Groups panel */
.edit-groups-footer {
  padding: 10px 14px;
  border-top: 1px solid #1e1e2e;
}

.edit-group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
```

### Step 7: Verify

Reload the extension. Run AI Group Tabs. After grouping succeeds:
- A banner appears: "✦ X groups created — Edit names →"
- Clicking "Edit names →" opens the Edit Groups panel listing each group with a text input
- Changing names and clicking **Save** updates the Chrome tab groups and returns to main view
- Back button closes the panel without saving
- The × on the banner dismisses it

### Step 8: Commit

```bash
git add popup.html popup.js popup.css
git commit -m "feat: edit groups panel and post-AI grouping banner"
```

---

## Done

All 4 features implemented:
- Tooltip on Suspend Inactive
- Last-used timestamps on each tab
- Grouped tab list reflecting Chrome tab groups
- Group rename: inline click-to-edit + Edit Groups panel
