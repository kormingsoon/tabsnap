// background.js — AI Tab Manager service worker

const GROUP_COLORS = [
  "blue", "cyan", "green", "grey", "orange",
  "pink", "purple", "red", "yellow",
];

const PROVIDER_DEFAULTS = {
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1/messages",
    model: "claude-haiku-4-5-20251001",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.1-8b-instruct:free",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.1-8b-instant",
  },
};

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-dashboard") {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AI_GROUP_TABS") {
    groupTabsWithAI(message.tabs, message.config)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep message channel open for async
  }
});

// ─── AI grouping ──────────────────────────────────────────────────────────────

async function groupTabsWithAI(tabs, config) {
  const tabList = tabs
    .map((t, i) => `${i}: [${t.title}] ${t.url}`)
    .join("\n");

  const prompt = `You are a browser tab organizer. Given the following list of open browser tabs, group them into logical categories based on what the tabs actually contain.

Rules:
- Use SPECIFIC category names derived from the actual tab content. Prefer specific over generic.
- Draw from examples like: "YouTube Channels", "Game Development", "Technology & Software", "Reddit & Forums", "Web Development Tools", "AI & Machine Learning", "Video Streaming & Movies", "GitHub & Code Repositories", "Finance & Investing", "Academic Research", "Social Media", "Music & Audio", "News & Current Events", "Gaming", "Anime & Manga", "Cybersecurity", "DevOps & Infrastructure", "Online Courses & Tutorials", "Productivity & Tools", "Design & Creative Tools", "Crypto & Blockchain", "Sports & Athletics", "Travel & Places", "Food & Recipes", "Health & Fitness", "Live Streaming & Twitch", "Programming Docs & References", "Entertainment & Pop Culture", "Forums & Community Discussions", "Science & Technology News", "Art & Design", "Miscellaneous"
- Avoid vague names like "Work", "Research", "Entertainment", "Social" unless no better name fits.
- If no example fits, invent a specific descriptive name based on the actual tab content.

Respond ONLY with a valid JSON array. Each element should be:
{ "name": "Group Name", "tabIndexes": [0, 2, 5] }

Use each tab index at most once. Tabs that don't fit any group can be omitted.

Tabs:
${tabList}`;

  const provider = config.provider || "anthropic";
  let text;

  if (provider === "anthropic") {
    text = await callAnthropic(prompt, config);
  } else {
    text = await callOpenAICompat(prompt, config);
  }

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Could not parse AI response");

  const groups = JSON.parse(jsonMatch[0]);

  // Apply groups via chrome.tabGroups API
  const createdGroups = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const tabIds = group.tabIndexes
      .filter((idx) => idx >= 0 && idx < tabs.length)
      .map((idx) => tabs[idx].id);

    if (tabIds.length === 0) continue;

    try {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, {
        title: group.name,
        color: GROUP_COLORS[i % GROUP_COLORS.length],
        collapsed: tabIds.length > 3,
      });
      createdGroups.push({ name: group.name, count: tabIds.length });
    } catch (err) {
      console.warn("Failed to create group:", group.name, err);
    }
  }

  return createdGroups;
}

// ─── Provider implementations ─────────────────────────────────────────────────

async function callAnthropic(prompt, config) {
  const defaults = PROVIDER_DEFAULTS.anthropic;
  const response = await fetch(config.baseUrl || defaults.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model || defaults.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text ?? "";
}

async function callOpenAICompat(prompt, config) {
  const provider = config.provider || "openrouter";
  const defaults = PROVIDER_DEFAULTS[provider] || {};
  const url = config.baseUrl || defaults.baseUrl;
  const model = config.model || defaults.model;

  if (!url) throw new Error("No base URL configured for custom provider");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content ?? "";
}

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
  try {
    const { homeTabs = [], homeTabsAutoOpen = false } =
      await chrome.storage.local.get(["homeTabs", "homeTabsAutoOpen"]);
    if (!homeTabsAutoOpen || homeTabs.length === 0) return;

    const allOpen = await chrome.tabs.query({});
    const openUrls = new Set(allOpen.map((t) => t.url));

    for (const homeTab of homeTabs) {
      if (!homeTab.url) continue;
      if (!openUrls.has(homeTab.url)) {
        await chrome.tabs.create({ url: homeTab.url, active: false });
      }
    }
  } catch {
    // startup home tabs failed silently
  }
});
