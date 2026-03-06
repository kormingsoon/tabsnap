# Dashboard & Home Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full-page New Tab dashboard (All Tabs, Groups, Recent, Analytics) and a Home Tabs panel in the popup with auto-open on startup.

**Architecture:** New Tab override via `chrome_url_overrides` in manifest. Three new files (`dashboard.html/js/css`). Background.js gains two listeners: `onActivated` for analytics and `onStartup` for home tabs. Popup gets a new Home Tabs slide-in panel and a dashboard opt-out toggle in Settings.

**Tech Stack:** Plain JS/HTML/CSS, Chrome MV3, `chrome.sessions` API, `chrome.tabGroups` API, `chrome.storage.local`.

**Design doc:** `docs/plans/2026-03-05-dashboard-hometabs-design.md`

---

## How to reload and test

After every task:
1. Go to `chrome://extensions/`
2. Click **refresh** on the TabSnap card
3. Open a new tab to see the dashboard, or click the popup icon

---

## Task 1: Manifest updates

**Files:**
- Modify: `manifest.json`

**Step 1: Apply changes**

Replace the entire contents of `manifest.json` with:
```json
{
  "manifest_version": 3,
  "name": "TabSnap — AI Tab Manager",
  "version": "0.2.0",
  "description": "Manage your browser tabs intelligently with AI",
  "permissions": [
    "tabs",
    "storage",
    "activeTab",
    "tabGroups",
    "sessions"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_title": "TabSnap"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "chrome_url_overrides": {
    "newtab": "dashboard.html"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Step 2: Verify**

Reload the extension. Open a new tab — Chrome should now load `dashboard.html` (which doesn't exist yet, so it will show an error). That error confirms the override is wired up.

**Step 3: Commit**
```bash
git add manifest.json
git commit -m "feat: add sessions permission and newtab override to manifest"
```

---

## Task 2: Background.js — analytics + home tabs startup

**Files:**
- Modify: `background.js`

**Step 1: Read the file**

Read `background.js` to find the end of the file (after `callOpenAICompat`).

**Step 2: Append two listeners at the bottom**

Add this after the last line of `background.js`:
```js
// ─── Analytics tracking ────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return;
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;
    const hostname = new URL(tab.url).hostname;
    if (!hostname) return;
    const { analytics = {} } = await chrome.storage.local.get("analytics");
    analytics[hostname] = (analytics[hostname] || 0) + 1;
    await chrome.storage.local.set({ analytics });
  } catch {
    // tab may have been closed before we could read it
  }
});

// ─── Home tabs auto-open on startup ───────────────────────────────────────────

chrome.runtime.onStartup.addListener(async () => {
  const { homeTabs = [], homeTabsAutoOpen = false } =
    await chrome.storage.local.get(["homeTabs", "homeTabsAutoOpen"]);
  if (!homeTabsAutoOpen || homeTabs.length === 0) return;

  const allOpen = await chrome.tabs.query({});
  const openUrls = new Set(allOpen.map((t) => t.url));

  for (const homeTab of homeTabs) {
    if (!openUrls.has(homeTab.url)) {
      await chrome.tabs.create({ url: homeTab.url, active: false });
    }
  }
});
```

**Step 3: Verify**

Reload the extension. Switch between tabs in your browser. Then open the popup DevTools console (`chrome://extensions` → inspect service worker) and run:
```js
chrome.storage.local.get("analytics", console.log)
```
You should see hostnames with counts.

**Step 4: Commit**
```bash
git add background.js
git commit -m "feat: add analytics tracking and home tabs startup to background"
```

---

## Task 3: dashboard.html

**Files:**
- Create: `dashboard.html`

**Step 1: Create the file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TabSnap</title>
  <link rel="stylesheet" href="dashboard.css">
</head>
<body>
  <div id="dashboard">
    <aside class="sidebar">
      <div class="sidebar-logo">
        <span class="logo-icon">⬡</span>
        <span class="logo-text">TabSnap</span>
      </div>
      <nav class="sidebar-nav">
        <button class="nav-item active" data-section="all-tabs">
          <span class="nav-icon">⊞</span> All Tabs
        </button>
        <button class="nav-item" data-section="groups">
          <span class="nav-icon">◫</span> Groups
        </button>
        <button class="nav-item" data-section="recent">
          <span class="nav-icon">↺</span> Recent
        </button>
        <button class="nav-item" data-section="analytics">
          <span class="nav-icon">◈</span> Analytics
        </button>
      </nav>
      <div class="sidebar-footer">
        <button id="open-home-tabs" class="sidebar-action-btn">⌂ Open Home Tabs</button>
      </div>
    </aside>

    <main class="main-content">
      <div class="main-header">
        <input type="text" id="dash-search" placeholder="Search tabs..." autocomplete="off">
        <button id="dash-ai-group" class="dash-btn primary">✦ AI Group Tabs</button>
      </div>
      <div id="section-all-tabs" class="section"></div>
      <div id="section-groups" class="section hidden"></div>
      <div id="section-recent" class="section hidden"></div>
      <div id="section-analytics" class="section hidden"></div>
    </main>
  </div>
  <script src="dashboard.js"></script>
</body>
</html>
```

**Step 2: Verify**

Reload extension, open a new tab. The page should load without a 404 (will be unstyled until Task 4).

**Step 3: Commit**
```bash
git add dashboard.html
git commit -m "feat: add dashboard HTML shell"
```

---

## Task 4: dashboard.css

**Files:**
- Create: `dashboard.css`

**Step 1: Create the file**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  background: #0f0f13;
  color: #e8e8f0;
  height: 100vh;
  overflow: hidden;
}

#dashboard {
  display: flex;
  height: 100vh;
}

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */

.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #0d0d11;
  border-right: 1px solid #1e1e2e;
  display: flex;
  flex-direction: column;
  padding: 20px 0 16px;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 16px;
  border-bottom: 1px solid #1e1e2e;
  margin-bottom: 8px;
}

.logo-icon {
  font-size: 20px;
  color: #7c6af7;
}

.logo-text {
  font-size: 15px;
  font-weight: 700;
  color: #e8e8f0;
  letter-spacing: -0.3px;
}

.sidebar-nav {
  flex: 1;
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: none;
  color: #6b6b8a;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  width: 100%;
}

.nav-item:hover {
  background: #1a1a24;
  color: #c0c0d8;
}

.nav-item.active {
  background: #1e1a3a;
  color: #a09af5;
}

.nav-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.sidebar-footer {
  padding: 12px 8px 0;
  border-top: 1px solid #1e1e2e;
}

.sidebar-action-btn {
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid #2a2a3e;
  background: #1a1a24;
  color: #c0c0d8;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.sidebar-action-btn:hover {
  border-color: #7c6af7;
  color: #a09af5;
}

/* ─── Main ────────────────────────────────────────────────────────────────── */

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid #1e1e2e;
  background: #0d0d11;
  flex-shrink: 0;
}

.main-header input {
  flex: 1;
  background: #1a1a24;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  padding: 9px 14px;
  color: #e8e8f0;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.main-header input:focus {
  border-color: #7c6af7;
}

.main-header input::placeholder {
  color: #4a4a6a;
}

.dash-btn {
  padding: 9px 16px;
  border-radius: 8px;
  border: 1px solid #2a2a3e;
  background: #1a1a24;
  color: #c0c0d8;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.dash-btn.primary {
  background: linear-gradient(135deg, #5b4fe8, #7c6af7);
  border-color: transparent;
  color: #fff;
  font-weight: 600;
}

.dash-btn.primary:hover {
  background: linear-gradient(135deg, #6b5ff8, #8c7af7);
}

.dash-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.section {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  scrollbar-width: thin;
  scrollbar-color: #2a2a3e transparent;
}

.section.hidden {
  display: none;
}

/* ─── Status ──────────────────────────────────────────────────────────────── */

.dash-status {
  margin: 12px 24px 0;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  display: none;
  flex-shrink: 0;
}

.dash-status.show { display: block; }
.dash-status.success { background: #101e14; color: #80c0a0; border-left: 3px solid #50a080; }
.dash-status.error { background: #1e1010; color: #f08080; border-left: 3px solid #e05050; }

/* ─── Empty / Loading ─────────────────────────────────────────────────────── */

.dash-empty, .dash-loading {
  text-align: center;
  color: #4a4a6a;
  padding: 48px 24px;
  font-size: 13px;
}

/* ─── All Tabs ────────────────────────────────────────────────────────────── */

.window-group {
  margin-bottom: 28px;
}

.window-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #4a4a6a;
  padding-bottom: 8px;
  border-bottom: 1px solid #1e1e2e;
  margin-bottom: 6px;
}

.dash-tab-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}

.dash-tab-item:hover { background: #1a1a24; }
.dash-tab-item.active-tab {
  background: #1a1a2e;
  border-left: 2px solid #7c6af7;
  padding-left: 8px;
}

.dash-tab-favicon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.dash-tab-favicon.no-icon { background: #2a2a3e; }

.dash-tab-info { flex: 1; min-width: 0; }

.dash-tab-title {
  display: block;
  font-size: 13px;
  color: #c8c8e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dash-tab-url-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
}

.dash-tab-url {
  font-size: 11px;
  color: #4a4a6a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.dash-tab-last-used {
  font-size: 11px;
  color: #5a5a7a;
  flex-shrink: 0;
  padding-left: 8px;
  white-space: nowrap;
}

/* ─── Groups ──────────────────────────────────────────────────────────────── */

.group-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.group-card {
  background: #1a1a24;
  border-radius: 10px;
  border: 1px solid #2a2a3e;
  overflow: hidden;
}

.group-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #2a2a3e;
}

.group-card-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.group-card-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #e8e8f0;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-card-name:hover { color: #7c6af7; }

.group-card-name-input {
  flex: 1;
  background: #0f0f13;
  border: 1px solid #7c6af7;
  border-radius: 4px;
  padding: 2px 8px;
  color: #e8e8f0;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  min-width: 0;
}

.group-card-count {
  font-size: 11px;
  color: #6b6b8a;
  background: #0f0f13;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.group-card-tabs { padding: 4px 0; }

.group-card-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  cursor: pointer;
  transition: background 0.1s;
}

.group-card-tab:hover { background: #22223a; }

.group-card-tab-title {
  font-size: 12px;
  color: #c8c8e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─── Recent ──────────────────────────────────────────────────────────────── */

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #1a1a24;
  border-radius: 8px;
  border: 1px solid #2a2a3e;
}

.recent-info { flex: 1; min-width: 0; }

.recent-title {
  font-size: 13px;
  color: #c8c8e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-url {
  font-size: 11px;
  color: #4a4a6a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.restore-btn {
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #2a2a3e;
  background: #0f0f13;
  color: #a09af5;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.restore-btn:hover { border-color: #7c6af7; background: #1a1a2e; }

/* ─── Analytics ───────────────────────────────────────────────────────────── */

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.analytics-card {
  background: #1a1a24;
  border-radius: 10px;
  border: 1px solid #2a2a3e;
  padding: 16px;
}

.analytics-card-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #6b6b8a;
  margin-bottom: 10px;
}

.analytics-stat {
  font-size: 36px;
  font-weight: 700;
  color: #a09af5;
  line-height: 1;
  margin-bottom: 4px;
}

.analytics-stat-label {
  font-size: 12px;
  color: #4a4a6a;
}

.domain-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #6b6b8a;
  margin-bottom: 12px;
}

.domain-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.domain-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.domain-name {
  font-size: 12px;
  color: #c8c8e0;
  width: 160px;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.domain-bar-wrap {
  flex: 1;
  height: 4px;
  background: #2a2a3e;
  border-radius: 2px;
  overflow: hidden;
}

.domain-bar {
  height: 100%;
  background: #7c6af7;
  border-radius: 2px;
}

.domain-count {
  font-size: 11px;
  color: #6b6b8a;
  width: 32px;
  text-align: right;
  flex-shrink: 0;
}
```

**Step 2: Verify**

Reload extension, open a new tab. The layout should render with a sidebar and main content area.

**Step 3: Commit**
```bash
git add dashboard.css
git commit -m "feat: add dashboard CSS"
```

---

## Task 5: dashboard.js

**Files:**
- Create: `dashboard.js`

**Step 1: Create the file**

```js
// dashboard.js — TabSnap full-page dashboard

const GROUP_COLOR_MAP = {
  grey: "#9aa0a6", blue: "#1a73e8", red: "#d93025", yellow: "#f9ab00",
  green: "#1e8e3e", pink: "#e52592", purple: "#7c6af7", cyan: "#007b83", orange: "#fa7b17",
};

function formatRelativeTime(ms) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const wks = Math.floor(diff / 604_800_000);
  return `${wks} ${wks === 1 ? "wk" : "wks"} ago`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const { dashboardEnabled = true } = await chrome.storage.local.get("dashboardEnabled");
  if (!dashboardEnabled) {
    document.body.innerHTML = "";
    document.body.style.cssText = "background:#fff;margin:0;";
    return;
  }

  setupNav();
  await loadSection("all-tabs");

  document.getElementById("open-home-tabs").addEventListener("click", openHomeTabs);
  document.getElementById("dash-ai-group").addEventListener("click", handleDashAIGroup);
  document.getElementById("dash-search").addEventListener("input", (e) => {
    if (currentSection === "all-tabs") renderAllTabs(e.target.value.toLowerCase().trim());
  });
});

// ─── Navigation ───────────────────────────────────────────────────────────────

let currentSection = "all-tabs";

function setupNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".section").forEach((s) => s.classList.add("hidden"));
      const section = btn.dataset.section;
      document.getElementById(`section-${section}`).classList.remove("hidden");
      currentSection = section;
      await loadSection(section);
    });
  });
}

async function loadSection(section) {
  switch (section) {
    case "all-tabs": return renderAllTabs();
    case "groups":   return renderGroups();
    case "recent":   return renderRecent();
    case "analytics":return renderAnalytics();
  }
}

// ─── Status ───────────────────────────────────────────────────────────────────

let dashStatusTimer;
function showDashStatus(msg, type = "") {
  let el = document.getElementById("dash-status");
  if (!el) {
    el = document.createElement("div");
    el.id = "dash-status";
    el.className = "dash-status";
    document.querySelector(".main-header").insertAdjacentElement("afterend", el);
  }
  el.textContent = msg;
  el.className = `dash-status show ${type}`;
  clearTimeout(dashStatusTimer);
  dashStatusTimer = setTimeout(() => el.classList.remove("show"), 4000);
}

// ─── All Tabs ─────────────────────────────────────────────────────────────────

async function renderAllTabs(filter = "") {
  const el = document.getElementById("section-all-tabs");
  el.innerHTML = "";

  const allTabs = await chrome.tabs.query({});
  const filtered = filter
    ? allTabs.filter((t) => t.title?.toLowerCase().includes(filter) || t.url?.toLowerCase().includes(filter))
    : allTabs;

  if (filtered.length === 0) {
    el.innerHTML = '<div class="dash-empty">No tabs found.</div>';
    return;
  }

  const windowMap = new Map();
  for (const tab of filtered) {
    if (!windowMap.has(tab.windowId)) windowMap.set(tab.windowId, []);
    windowMap.get(tab.windowId).push(tab);
  }

  let windowIndex = 1;
  for (const [, tabs] of windowMap) {
    const group = document.createElement("div");
    group.className = "window-group";

    const header = document.createElement("div");
    header.className = "window-header";
    header.textContent = `Window ${windowIndex++} — ${tabs.length} tab${tabs.length !== 1 ? "s" : ""}`;
    group.appendChild(header);

    for (const tab of tabs) group.appendChild(createDashTabItem(tab));
    el.appendChild(group);
  }
}

function createDashTabItem(tab) {
  const item = document.createElement("div");
  item.className = "dash-tab-item" + (tab.active ? " active-tab" : "");

  const favicon = document.createElement("img");
  favicon.className = "dash-tab-favicon";
  if (tab.favIconUrl) {
    favicon.src = tab.favIconUrl;
    favicon.onerror = () => favicon.classList.add("no-icon");
  } else {
    favicon.classList.add("no-icon");
  }

  const info = document.createElement("div");
  info.className = "dash-tab-info";

  const title = document.createElement("span");
  title.className = "dash-tab-title";
  title.textContent = tab.title || "Untitled";

  const urlRow = document.createElement("div");
  urlRow.className = "dash-tab-url-row";

  const url = document.createElement("span");
  url.className = "dash-tab-url";
  try { url.textContent = new URL(tab.url).hostname; } catch { url.textContent = tab.url; }

  const lastUsed = document.createElement("span");
  lastUsed.className = "dash-tab-last-used";
  lastUsed.textContent = formatRelativeTime(tab.lastAccessed);

  urlRow.appendChild(url);
  urlRow.appendChild(lastUsed);
  info.appendChild(title);
  info.appendChild(urlRow);
  item.appendChild(favicon);
  item.appendChild(info);

  item.addEventListener("click", () => {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  });

  return item;
}

// ─── Groups ───────────────────────────────────────────────────────────────────

async function renderGroups() {
  const el = document.getElementById("section-groups");
  el.innerHTML = '<div class="dash-loading">Loading groups...</div>';

  const allTabs = await chrome.tabs.query({});
  const windows = await chrome.windows.getAll();

  let groups = [];
  for (const win of windows) {
    try {
      const wGroups = await chrome.tabGroups.query({ windowId: win.id });
      groups = groups.concat(wGroups);
    } catch { /* tabGroups unavailable */ }
  }

  el.innerHTML = "";

  if (groups.length === 0) {
    el.innerHTML = '<div class="dash-empty">No tab groups yet. Use AI Group Tabs to create some.</div>';
    return;
  }

  const groupTabsMap = new Map();
  for (const tab of allTabs) {
    if (tab.groupId != null && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      if (!groupTabsMap.has(tab.groupId)) groupTabsMap.set(tab.groupId, []);
      groupTabsMap.get(tab.groupId).push(tab);
    }
  }

  const cards = document.createElement("div");
  cards.className = "group-cards";
  for (const group of groups) {
    cards.appendChild(createGroupCard(group, groupTabsMap.get(group.id) || []));
  }
  el.appendChild(cards);
}

function createGroupCard(group, tabs) {
  const card = document.createElement("div");
  card.className = "group-card";

  const header = document.createElement("div");
  header.className = "group-card-header";

  const dot = document.createElement("span");
  dot.className = "group-card-dot";
  dot.style.background = GROUP_COLOR_MAP[group.color] || "#6b6b8a";

  const name = document.createElement("span");
  name.className = "group-card-name";
  name.textContent = group.title || "Unnamed";
  name.addEventListener("click", () => startCardRename(header, name, group));

  const count = document.createElement("span");
  count.className = "group-card-count";
  count.textContent = `${tabs.length} tab${tabs.length !== 1 ? "s" : ""}`;

  header.appendChild(dot);
  header.appendChild(name);
  header.appendChild(count);

  const tabList = document.createElement("div");
  tabList.className = "group-card-tabs";

  for (const tab of tabs) {
    const tabItem = document.createElement("div");
    tabItem.className = "group-card-tab";

    const fav = document.createElement("img");
    fav.className = "dash-tab-favicon";
    if (tab.favIconUrl) { fav.src = tab.favIconUrl; fav.onerror = () => fav.classList.add("no-icon"); }
    else { fav.classList.add("no-icon"); }

    const tabTitle = document.createElement("span");
    tabTitle.className = "group-card-tab-title";
    tabTitle.textContent = tab.title || "Untitled";

    tabItem.appendChild(fav);
    tabItem.appendChild(tabTitle);
    tabItem.addEventListener("click", () => {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    });
    tabList.appendChild(tabItem);
  }

  card.appendChild(header);
  card.appendChild(tabList);
  return card;
}

function startCardRename(headerEl, nameEl, group) {
  if (headerEl.querySelector(".group-card-name-input")) return;
  const currentName = nameEl.textContent;

  const input = document.createElement("input");
  input.className = "group-card-name-input";
  input.value = currentName;
  nameEl.replaceWith(input);
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
      } catch { save = false; }
    }
    const newSpan = document.createElement("span");
    newSpan.className = "group-card-name";
    newSpan.textContent = save ? newName : currentName;
    newSpan.addEventListener("click", () => startCardRename(headerEl, newSpan, group));
    input.replaceWith(newSpan);
  };

  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
}

// ─── Recent ───────────────────────────────────────────────────────────────────

async function renderRecent() {
  const el = document.getElementById("section-recent");
  el.innerHTML = '<div class="dash-loading">Loading recently closed...</div>';

  let sessions = [];
  try {
    sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
  } catch {
    el.innerHTML = '<div class="dash-empty">Could not load recently closed tabs.</div>';
    return;
  }

  el.innerHTML = "";

  if (sessions.length === 0) {
    el.innerHTML = '<div class="dash-empty">No recently closed tabs.</div>';
    return;
  }

  const list = document.createElement("div");
  list.className = "recent-list";

  for (const session of sessions) {
    const isWindow = !!session.window;
    const entry = session.tab || session.window?.tabs?.[0];
    if (!entry) continue;

    const title = isWindow
      ? `Window with ${session.window.tabs.length} tab${session.window.tabs.length !== 1 ? "s" : ""}`
      : (entry.title || entry.url || "Untitled");
    const url = isWindow ? "" : (entry.url || "");

    const item = document.createElement("div");
    item.className = "recent-item";

    const fav = document.createElement("img");
    fav.className = "dash-tab-favicon";
    if (!isWindow && entry.favIconUrl) {
      fav.src = entry.favIconUrl;
      fav.onerror = () => fav.classList.add("no-icon");
    } else { fav.classList.add("no-icon"); }

    const info = document.createElement("div");
    info.className = "recent-info";

    const titleEl = document.createElement("div");
    titleEl.className = "recent-title";
    titleEl.textContent = title;

    const urlEl = document.createElement("div");
    urlEl.className = "recent-url";
    try { urlEl.textContent = url ? new URL(url).hostname : ""; } catch { urlEl.textContent = url; }

    info.appendChild(titleEl);
    info.appendChild(urlEl);

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "restore-btn";
    restoreBtn.textContent = "Restore";
    const sessionId = session.tab?.sessionId || session.window?.sessionId;
    restoreBtn.addEventListener("click", async () => {
      try { await chrome.sessions.restore(sessionId); } catch { /* session expired */ }
    });

    item.appendChild(fav);
    item.appendChild(info);
    item.appendChild(restoreBtn);
    list.appendChild(item);
  }

  el.appendChild(list);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

async function renderAnalytics() {
  const el = document.getElementById("section-analytics");
  el.innerHTML = '<div class="dash-loading">Loading analytics...</div>';

  const [allTabs, { analytics = {} }] = await Promise.all([
    chrome.tabs.query({}),
    chrome.storage.local.get("analytics"),
  ]);

  el.innerHTML = "";

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const staleTabs = allTabs.filter((t) => t.lastAccessed && t.lastAccessed < sevenDaysAgo);

  const grid = document.createElement("div");
  grid.className = "analytics-grid";
  grid.appendChild(makeStatCard("Total Open Tabs", allTabs.length, "across all windows"));
  grid.appendChild(makeStatCard("Stale Tabs", staleTabs.length, "open longer than 7 days"));
  el.appendChild(grid);

  const sectionTitle = document.createElement("div");
  sectionTitle.className = "domain-section-title";
  sectionTitle.textContent = "Most Visited Domains";
  el.appendChild(sectionTitle);

  const sorted = Object.entries(analytics).sort((a, b) => b[1] - a[1]).slice(0, 10);

  if (sorted.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dash-empty";
    empty.style.paddingTop = "16px";
    empty.textContent = "No visit data yet. Browse around to build up analytics.";
    el.appendChild(empty);
    return;
  }

  const maxCount = sorted[0][1];
  const domainList = document.createElement("div");
  domainList.className = "domain-list";

  for (const [domain, count] of sorted) {
    const item = document.createElement("div");
    item.className = "domain-item";

    const nameEl = document.createElement("span");
    nameEl.className = "domain-name";
    nameEl.textContent = domain;
    nameEl.title = domain;

    const barWrap = document.createElement("div");
    barWrap.className = "domain-bar-wrap";
    const bar = document.createElement("div");
    bar.className = "domain-bar";
    bar.style.width = `${(count / maxCount) * 100}%`;
    barWrap.appendChild(bar);

    const countEl = document.createElement("span");
    countEl.className = "domain-count";
    countEl.textContent = count;

    item.appendChild(nameEl);
    item.appendChild(barWrap);
    item.appendChild(countEl);
    domainList.appendChild(item);
  }

  el.appendChild(domainList);
}

function makeStatCard(title, value, label) {
  const card = document.createElement("div");
  card.className = "analytics-card";

  const titleEl = document.createElement("div");
  titleEl.className = "analytics-card-title";
  titleEl.textContent = title;

  const stat = document.createElement("div");
  stat.className = "analytics-stat";
  stat.textContent = value;

  const labelEl = document.createElement("div");
  labelEl.className = "analytics-stat-label";
  labelEl.textContent = label;

  card.appendChild(titleEl);
  card.appendChild(stat);
  card.appendChild(labelEl);
  return card;
}

// ─── AI Group (from dashboard) ────────────────────────────────────────────────

async function handleDashAIGroup() {
  const stored = await chrome.storage.local.get(["apiKey", "provider", "model", "baseUrl"]);
  if (!stored.apiKey) {
    showDashStatus("No API key set. Configure it in the extension popup settings.", "error");
    return;
  }

  const btn = document.getElementById("dash-ai-group");
  btn.disabled = true;
  btn.textContent = "Grouping...";

  try {
    const [thisTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const windowId = thisTab?.windowId;
    const tabs = await chrome.tabs.query({ windowId });
    const tabData = tabs
      .filter((t) => t.url !== window.location.href)
      .map((t) => ({ id: t.id, title: t.title, url: t.url }));

    const groups = await chrome.runtime.sendMessage({
      type: "AI_GROUP_TABS",
      tabs: tabData,
      config: {
        apiKey: stored.apiKey,
        provider: stored.provider || "anthropic",
        model: stored.model || "",
        baseUrl: stored.baseUrl || "",
      },
    });

    if (groups.error) { showDashStatus(groups.error, "error"); return; }

    showDashStatus(`Created ${groups.length} tab groups.`, "success");
    document.querySelector('[data-section="groups"]').click();
  } catch (err) {
    showDashStatus("Failed to group tabs: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "✦ AI Group Tabs";
  }
}

// ─── Open Home Tabs ───────────────────────────────────────────────────────────

async function openHomeTabs() {
  const { homeTabs = [] } = await chrome.storage.local.get("homeTabs");
  if (homeTabs.length === 0) {
    showDashStatus("No home tabs saved. Configure them in the popup (⌂ Home).", "error");
    return;
  }

  const allOpen = await chrome.tabs.query({});
  const openUrls = new Set(allOpen.map((t) => t.url));
  let opened = 0;

  for (const tab of homeTabs) {
    if (!openUrls.has(tab.url)) {
      await chrome.tabs.create({ url: tab.url, active: false });
      opened++;
    }
  }

  showDashStatus(
    opened > 0 ? `Opened ${opened} home tab(s).` : "All home tabs are already open.",
    "success"
  );
}
```

**Step 2: Verify**

Reload extension, open new tab. All four sidebar sections should be clickable. All Tabs should list your open tabs grouped by window. Analytics should show "No visit data yet" until you switch tabs. Recent shows closed tabs. Groups shows group cards if you have any.

**Step 3: Commit**
```bash
git add dashboard.js
git commit -m "feat: add dashboard JS — all tabs, groups, recent, analytics, AI group, home tabs"
```

---

## Task 6: Popup — Settings dashboard toggle

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`

**Step 1: Add toggle to Settings panel in popup.html**

In `popup.html`, find the settings body — the line with `<p class="setting-hint" id="provider-hint"></p>`. Add the dashboard toggle immediately after it, before the Save button:

```html
      <label class="setting-item">
        <span class="setting-label">Use TabSnap as New Tab</span>
        <input type="checkbox" id="dashboard-enabled" checked>
      </label>
```

**Step 2: Update version in footer**

In `popup.html`, find:
```html
      <span class="version">v0.1.0</span>
```
Replace with:
```html
      <span class="version">v0.2.0</span>
```

**Step 3: Load and save dashboard toggle in popup.js**

In `popup.js`, find the `loadSettings` async function. After the line `updateProviderUI(provider);`, add:

```js
  const { dashboardEnabled = true } = await chrome.storage.local.get("dashboardEnabled");
  $("dashboard-enabled").checked = dashboardEnabled;
  $("dashboard-enabled").addEventListener("change", async (e) => {
    await chrome.storage.local.set({ dashboardEnabled: e.target.checked });
  });
```

**Step 4: Add checkbox CSS to popup.css**

At the end of `popup.css`, add:
```css
/* Dashboard toggle */
.setting-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #7c6af7;
  cursor: pointer;
  flex-shrink: 0;
}
```

**Step 5: Verify**

Reload extension. Open popup → Settings. A "Use TabSnap as New Tab" checkbox should appear. Unchecking it and opening a new tab should show a blank white page. Re-checking restores the dashboard.

**Step 6: Commit**
```bash
git add popup.html popup.js popup.css
git commit -m "feat: add dashboard opt-out toggle in Settings"
```

---

## Task 7: Popup — Home Tabs panel

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`
- Modify: `popup.css`

**Step 1: Update footer and add Home Tabs panel in popup.html**

Find the footer:
```html
    <footer>
      <a id="settings-link" href="#" class="link-btn">⚙ Settings</a>
      <span class="version">v0.2.0</span>
    </footer>
```

Replace with:
```html
    <footer>
      <a id="settings-link" href="#" class="link-btn">⚙ Settings</a>
      <a id="home-tabs-link" href="#" class="link-btn">⌂ Home</a>
      <span class="version">v0.2.0</span>
    </footer>
```

After the closing `</div>` of `#edit-groups-panel`, add:
```html
  <div id="home-tabs-panel" class="settings-panel hidden">
    <div class="settings-header">
      <button id="home-tabs-back-btn" class="link-btn">← Back</button>
      <h2>Home Tabs</h2>
    </div>
    <div class="settings-body">
      <div class="home-tabs-actions">
        <button id="btn-add-current" class="action-btn">+ Add current tab</button>
        <button id="btn-snapshot" class="action-btn">Snapshot all</button>
      </div>
      <div id="home-tabs-list" class="home-tabs-list"></div>
      <label class="setting-item home-tabs-toggle-row">
        <span class="setting-label">Auto-open on browser start</span>
        <input type="checkbox" id="home-tabs-auto-open">
      </label>
      <button id="btn-open-home-now" class="action-btn primary">⌂ Open now</button>
    </div>
  </div>
```

**Step 2: Add Home Tabs logic to popup.js**

At the end of `setupListeners`, add:
```js
  $("home-tabs-link").addEventListener("click", (e) => {
    e.preventDefault();
    showHomeTabs();
  });
  $("home-tabs-back-btn").addEventListener("click", hideHomeTabs);
  $("btn-add-current").addEventListener("click", addCurrentTab);
  $("btn-snapshot").addEventListener("click", snapshotAllTabs);
  $("btn-open-home-now").addEventListener("click", openHomeTabs);
  $("home-tabs-auto-open").addEventListener("change", async (e) => {
    await chrome.storage.local.set({ homeTabsAutoOpen: e.target.checked });
  });
```

At the end of `popup.js`, add the full Home Tabs section:
```js
// ─── Home Tabs ────────────────────────────────────────────────────────────────

function showHomeTabs() {
  $("home-tabs-panel").classList.remove("hidden");
  loadHomeTabs();
}

function hideHomeTabs() {
  $("home-tabs-panel").classList.add("hidden");
}

async function loadHomeTabs() {
  const { homeTabs = [], homeTabsAutoOpen = false } =
    await chrome.storage.local.get(["homeTabs", "homeTabsAutoOpen"]);
  $("home-tabs-auto-open").checked = homeTabsAutoOpen;
  renderHomeTabsList(homeTabs);
}

function renderHomeTabsList(homeTabs) {
  const list = $("home-tabs-list");
  list.innerHTML = "";

  if (homeTabs.length === 0) {
    list.innerHTML = '<div class="loading">No home tabs saved yet.</div>';
    return;
  }

  for (const tab of homeTabs) {
    const item = document.createElement("div");
    item.className = "home-tab-item";

    const favicon = document.createElement("img");
    favicon.className = "tab-favicon";
    if (tab.favicon) {
      favicon.src = tab.favicon;
      favicon.onerror = () => favicon.classList.add("no-icon");
    } else {
      favicon.classList.add("no-icon");
    }

    const info = document.createElement("div");
    info.className = "tab-info";

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || tab.url;

    const url = document.createElement("span");
    url.className = "tab-url";
    try { url.textContent = new URL(tab.url).hostname; } catch { url.textContent = tab.url; }

    info.appendChild(title);
    info.appendChild(url);

    const removeBtn = document.createElement("button");
    removeBtn.className = "tab-close";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove from home tabs";
    removeBtn.addEventListener("click", async () => {
      const { homeTabs: current = [] } = await chrome.storage.local.get("homeTabs");
      const updated = current.filter((t) => t.url !== tab.url);
      await chrome.storage.local.set({ homeTabs: updated });
      renderHomeTabsList(updated);
    });

    item.appendChild(favicon);
    item.appendChild(info);
    item.appendChild(removeBtn);
    list.appendChild(item);
  }
}

async function addCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const { homeTabs = [] } = await chrome.storage.local.get("homeTabs");
  if (homeTabs.some((t) => t.url === tab.url)) {
    showStatus("Tab already saved.", "success");
    return;
  }
  homeTabs.push({ url: tab.url, title: tab.title || "", favicon: tab.favIconUrl || "" });
  await chrome.storage.local.set({ homeTabs });
  renderHomeTabsList(homeTabs);
  showStatus("Tab added to home tabs.", "success");
}

async function snapshotAllTabs() {
  const tabs = allTabs.map((t) => ({ url: t.url, title: t.title || "", favicon: t.favIconUrl || "" }));
  await chrome.storage.local.set({ homeTabs: tabs });
  renderHomeTabsList(tabs);
  showStatus(`Saved ${tabs.length} tab${tabs.length !== 1 ? "s" : ""} as home tabs.`, "success");
}

async function openHomeTabs() {
  const { homeTabs = [] } = await chrome.storage.local.get("homeTabs");
  if (homeTabs.length === 0) {
    showStatus("No home tabs saved.", "success");
    return;
  }
  const allOpen = await chrome.tabs.query({});
  const openUrls = new Set(allOpen.map((t) => t.url));
  let opened = 0;
  for (const tab of homeTabs) {
    if (!openUrls.has(tab.url)) {
      await chrome.tabs.create({ url: tab.url, active: false });
      opened++;
    }
  }
  showStatus(
    opened > 0 ? `Opened ${opened} home tab(s).` : "All home tabs already open.",
    "success"
  );
  window.close();
}
```

**Step 3: Add Home Tabs CSS to popup.css**

At the end of `popup.css`, add:
```css
/* Home Tabs panel */
.home-tabs-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.home-tabs-actions .action-btn {
  font-size: 11px;
  padding: 6px 8px;
}

.home-tabs-list {
  border: 1px solid #2a2a3e;
  border-radius: 6px;
  margin-bottom: 10px;
  min-height: 60px;
  max-height: 180px;
  overflow-y: auto;
}

.home-tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid #1e1e2e;
}

.home-tab-item:last-child {
  border-bottom: none;
}

.home-tabs-toggle-row {
  flex-direction: row !important;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
```

**Step 4: Verify**

Reload extension. Open popup — footer should show "⚙ Settings" and "⌂ Home". Click ⌂ Home:
- Panel slides in
- "Add current tab" saves the active tab and shows it in the list
- "Snapshot all" saves every open tab
- Removing a tab with × works
- "Open now" opens saved tabs in the background
- Auto-open toggle persists across popup closes

**Step 5: Commit**
```bash
git add popup.html popup.js popup.css
git commit -m "feat: add Home Tabs panel to popup"
```

---

## Done

All 7 tasks complete. The extension now has:
- Full-page New Tab dashboard with All Tabs, Groups, Recent, Analytics
- Analytics tracking via background onActivated
- Home tabs auto-open on browser startup
- Dashboard opt-out toggle in Settings
- Home Tabs panel in popup with add, snapshot, open now, auto-open toggle
