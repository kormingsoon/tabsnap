// popup.js — AI Tab Manager UI

const $ = (id) => document.getElementById(id);

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

let allTabs = [];
let selectedTabIds = new Set();

// ─── Init ───────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  await loadTabs();
  setupListeners();
  loadSettings();
});

// ─── Tab loading ─────────────────────────────────────────────────────────────

async function loadTabs() {
  $("groups-banner")?.remove();
  const tabs = await chrome.tabs.query({ currentWindow: true });
  allTabs = tabs;
  $("tab-count").textContent = tabs.length;
  await renderGroupedTabs();
}

function renderTabs(tabs) {
  const list = $("tab-list");

  if (tabs.length === 0) {
    list.innerHTML = '<div class="loading">No tabs found</div>';
    return;
  }

  list.innerHTML = "";

  for (const tab of tabs) {
    list.appendChild(createTabItem(tab));
  }
}

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

function startInlineRename(headerEl, group) {
  if (headerEl.querySelector(".group-name-input")) return;
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
        // group removed or update failed — revert to original name
        save = false;
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

function createTabItem(tab) {
  const item = document.createElement("div");
  item.className = "tab-item" + (tab.active ? " active-tab" : "");
  item.dataset.tabId = tab.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "tab-checkbox";
  checkbox.checked = selectedTabIds.has(tab.id);
  checkbox.addEventListener("change", (e) => {
    e.stopPropagation();
    toggleSelect(tab.id, e.target.checked);
  });

  const favicon = document.createElement("img");
  favicon.className = "tab-favicon";
  if (tab.favIconUrl) {
    favicon.src = tab.favIconUrl;
    favicon.onerror = () => favicon.classList.add("no-icon");
  } else {
    favicon.classList.add("no-icon");
  }

  const info = document.createElement("div");
  info.className = "tab-info";

  const title = document.createElement("span");
  title.className = "tab-title";
  title.textContent = tab.title || "Untitled";
  title.title = tab.title;

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

  const closeBtn = document.createElement("button");
  closeBtn.className = "tab-close";
  closeBtn.textContent = "×";
  closeBtn.title = "Close tab";
  closeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await chrome.tabs.remove(tab.id);
    await loadTabs();
  });

  item.appendChild(checkbox);
  item.appendChild(favicon);
  item.appendChild(info);
  item.appendChild(closeBtn);

  // Click row to switch to tab
  item.addEventListener("click", (e) => {
    if (e.target === checkbox || e.target === closeBtn) return;
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
    window.close();
  });

  return item;
}

// ─── Selection ───────────────────────────────────────────────────────────────

function toggleSelect(tabId, selected) {
  if (selected) {
    selectedTabIds.add(tabId);
  } else {
    selectedTabIds.delete(tabId);
  }
  const closeSelectedBtn = $("btn-close-selected");
  if (selectedTabIds.size > 0) {
    closeSelectedBtn.classList.remove("hidden");
    closeSelectedBtn.textContent = `Close ${selectedTabIds.size} selected`;
  } else {
    closeSelectedBtn.classList.add("hidden");
  }
}

// ─── Search ──────────────────────────────────────────────────────────────────

function setupListeners() {
  $("search-input").addEventListener("input", async (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      await renderGroupedTabs();
      return;
    }
    const filtered = allTabs.filter(
      (t) =>
        t.title?.toLowerCase().includes(query) ||
        t.url?.toLowerCase().includes(query)
    );
    renderTabs(filtered);
  });

  $("btn-group").addEventListener("click", handleAIGroup);
  $("btn-dedupe").addEventListener("click", handleDedupe);
  $("btn-suspend").addEventListener("click", handleSuspend);

  $("btn-close-selected").addEventListener("click", async () => {
    await chrome.tabs.remove([...selectedTabIds]);
    selectedTabIds.clear();
    await loadTabs();
  });

  $("settings-link").addEventListener("click", (e) => {
    e.preventDefault();
    showSettings();
  });

  $("back-btn").addEventListener("click", hideSettings);
  $("save-settings").addEventListener("click", saveSettings);

  $("edit-groups-back-btn").addEventListener("click", () => {
    $("edit-groups-panel").classList.add("hidden");
  });
  $("save-groups-btn").addEventListener("click", saveGroups);
}

// ─── AI Group ────────────────────────────────────────────────────────────────

async function handleAIGroup() {
  const stored = await chrome.storage.local.get(["apiKey", "provider", "model", "baseUrl"]);

  if (!stored.apiKey) {
    showStatus("No API key set. Click ⚙ Settings to add your key.", "error");
    return;
  }

  showStatus("Analyzing tabs with AI...");
  $("btn-group").disabled = true;

  try {
    const tabs = allTabs.map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
    }));

    const groups = await chrome.runtime.sendMessage({
      type: "AI_GROUP_TABS",
      tabs,
      config: {
        apiKey: stored.apiKey,
        provider: stored.provider || "anthropic",
        model: stored.model || "",
        baseUrl: stored.baseUrl || "",
      },
    });

    if (groups.error) {
      showStatus(groups.error, "error");
      return;
    }

    showStatus(`Created ${groups.length} tab groups.`, "success");
    await loadTabs();
    showGroupsBanner(groups.length);
  } catch (err) {
    showStatus("Failed to group tabs: " + err.message, "error");
  } finally {
    $("btn-group").disabled = false;
  }
}

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
    const groupId = parseInt(input.dataset.groupId, 10);
    const newName = input.value.trim() || input.dataset.originalName;
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

// ─── Dedupe ──────────────────────────────────────────────────────────────────

async function handleDedupe() {
  const seen = new Map();
  const toClose = [];

  for (const tab of allTabs) {
    const key = tab.url;
    if (seen.has(key)) {
      toClose.push(tab.id);
    } else {
      seen.set(key, tab.id);
    }
  }

  if (toClose.length === 0) {
    showStatus("No duplicate tabs found.", "success");
    return;
  }

  await chrome.tabs.remove(toClose);
  showStatus(`Closed ${toClose.length} duplicate tab(s).`, "success");
  await loadTabs();
}

// ─── Suspend Inactive ────────────────────────────────────────────────────────

async function handleSuspend() {
  const inactive = allTabs.filter((t) => !t.active && !t.audible);

  if (inactive.length === 0) {
    showStatus("No inactive tabs to suspend.", "success");
    return;
  }

  // Discard tabs (suspend them without closing)
  let suspended = 0;
  for (const tab of inactive) {
    try {
      await chrome.tabs.discard(tab.id);
      suspended++;
    } catch {
      // Tab may not be discardable
    }
  }

  showStatus(`Suspended ${suspended} inactive tab(s).`, "success");
}

// ─── Status ──────────────────────────────────────────────────────────────────

let statusTimer;
function showStatus(msg, type = "") {
  const el = $("status-message");
  el.textContent = msg;
  el.className = "status" + (type ? ` ${type}` : "");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.add("hidden"), 4000);
}

// ─── Settings ────────────────────────────────────────────────────────────────

const PROVIDER_INFO = {
  anthropic: {
    hint: 'Get your key at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>',
    placeholder: "sk-ant-...",
    defaultModel: "claude-haiku-4-5-20251001",
    showBaseUrl: false,
  },
  openrouter: {
    hint: 'Free models available. Get your key at <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>',
    placeholder: "sk-or-...",
    defaultModel: "meta-llama/llama-3.1-8b-instruct:free",
    showBaseUrl: false,
  },
  groq: {
    hint: 'Free tier available. Get your key at <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
    placeholder: "gsk_...",
    defaultModel: "llama-3.1-8b-instant",
    showBaseUrl: false,
  },
  custom: {
    hint: "Any OpenAI-compatible API endpoint.",
    placeholder: "sk-...",
    defaultModel: "",
    showBaseUrl: true,
  },
};

function updateProviderUI(provider) {
  const info = PROVIDER_INFO[provider] || PROVIDER_INFO.custom;
  $("provider-hint").innerHTML = info.hint;
  $("api-key-input").placeholder = info.placeholder;
  $("model-input").placeholder = info.defaultModel || "model name";
  $("base-url-item").style.display = info.showBaseUrl ? "" : "none";
}

function showSettings() {
  $("settings-panel").classList.remove("hidden");
}

function hideSettings() {
  $("settings-panel").classList.add("hidden");
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(["apiKey", "provider", "model", "baseUrl"]);
  const provider = stored.provider || "anthropic";
  $("provider-select").value = provider;
  $("api-key-input").value = stored.apiKey || "";
  $("model-input").value = stored.model || "";
  $("base-url-input").value = stored.baseUrl || "";
  updateProviderUI(provider);
  const { dashboardEnabled = true } = await chrome.storage.local.get("dashboardEnabled");
  $("dashboard-enabled").checked = dashboardEnabled;
  $("dashboard-enabled").addEventListener("change", async (e) => {
    await chrome.storage.local.set({ dashboardEnabled: e.target.checked });
  });

  $("provider-select").addEventListener("change", (e) => {
    updateProviderUI(e.target.value);
  });
}

async function saveSettings() {
  const provider = $("provider-select").value;
  const apiKey = $("api-key-input").value.trim();
  const model = $("model-input").value.trim();
  const baseUrl = $("base-url-input").value.trim();
  await chrome.storage.local.set({ apiKey, provider, model, baseUrl });
  hideSettings();
  showStatus("Settings saved.", "success");
}
