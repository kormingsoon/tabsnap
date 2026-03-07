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
      const section = btn.dataset.section;
      if (section === currentSection) return;
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".section").forEach((s) => {
        s.classList.add("hidden");
        s.hidden = true;
      });
      const sectionEl = document.getElementById(`section-${section}`);
      sectionEl.classList.remove("hidden");
      sectionEl.hidden = false;
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

const CHROME_COLORS = Object.entries(GROUP_COLOR_MAP).map(([name, hex]) => ({ name, hex }));

function openColorPopover(dotBtn, group) {
  // Close any existing popover
  document.querySelector(".color-popover")?.remove();

  const popover = document.createElement("div");
  popover.className = "color-popover";

  // Declare dismiss early so swatch handlers can reference it
  const dismiss = (e) => {
    if (!popover.contains(e.target) && e.target !== dotBtn) {
      popover.remove();
      document.removeEventListener("click", dismiss, true);
    }
  };

  for (const { name, hex } of CHROME_COLORS) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch" + (group.color === name ? " active" : "");
    swatch.style.background = hex;
    swatch.title = name;
    swatch.addEventListener("click", async (e) => {
      e.stopPropagation();
      document.removeEventListener("click", dismiss, true);
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

  // Position using getBoundingClientRect so popover escapes overflow:hidden
  document.body.appendChild(popover);
  const rect = dotBtn.getBoundingClientRect();
  popover.style.position = "fixed";
  popover.style.top = (rect.bottom + 6) + "px";
  popover.style.left = rect.left + "px";
  popover.style.zIndex = "9999";

  setTimeout(() => document.addEventListener("click", dismiss, true), 0);
}

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

  const hint = renderGroupsHint();
  if (hint) el.appendChild(hint);

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
    tabItem.draggable = true;
    tabItem.addEventListener("dragstart", (e) => {
      tabItem.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify({ tabId: tab.id, srcGroupId: group.id }));
    });
    tabItem.addEventListener("dragend", () => {
      tabItem.classList.remove("dragging");
    });

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

  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    card.classList.add("drag-over");
  });

  card.addEventListener("dragleave", (e) => {
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
    if (srcGroupId === group.id) return;
    try {
      await chrome.tabs.group({ tabIds: [tabId], groupId: group.id });
    } catch {
      showDashStatus("Could not move tab — tabs can only be grouped within the same window.", "error");
    } finally {
      await renderGroups();
    }
  });

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
    restoreBtn.type = "button";
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

  try {
    const [thisTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const windowId = thisTab?.windowId;
    const tabs = await chrome.tabs.query({ windowId });
    const tabData = tabs
      .filter((t) => t.url !== window.location.href)
      .map((t) => ({ id: t.id, title: t.title, url: t.url }));

    if (tabData.length === 0) {
      showDashStatus("No other tabs to group in this window.", "error");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Grouping...";

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

    if (!groups || groups.error) {
      showDashStatus(groups?.error || "No response from background.", "error");
      return;
    }

    showDashStatus(`Created ${groups.length} tab groups.`, "success");
    document.querySelector('[data-section="groups"]').click();
  } catch (err) {
    showDashStatus("Failed to group tabs: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span aria-hidden="true">✦</span> AI Group Tabs';
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
  function normalizeUrl(u) {
    try { const p = new URL(u); return p.hostname + p.pathname.replace(/\/$/, "") + p.search; }
    catch { return u; }
  }
  const openUrls = new Set(allOpen.map((t) => normalizeUrl(t.url)));
  let opened = 0;

  for (const tab of homeTabs) {
    if (!openUrls.has(normalizeUrl(tab.url))) {
      await chrome.tabs.create({ url: tab.url, active: false });
      opened++;
    }
  }

  showDashStatus(
    opened > 0 ? `Opened ${opened} home tab(s).` : "All home tabs are already open.",
    "success"
  );
}
