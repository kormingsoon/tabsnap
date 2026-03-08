# Privacy Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add transparent privacy controls so users understand exactly what tab data is sent to AI providers, with options to limit exposure.

**Architecture:** All changes are confined to `popup/popup.html`, `popup/popup.css`, and `popup/popup.js` plus a one-line sanitization in `background.js`. No new files needed. A confirmation overlay (reusing the existing settings-panel pattern) is added to the HTML. Settings gain two new toggles. The analytics disclosure is a static text block in the settings panel.

**Tech Stack:** Vanilla JS, HTML, CSS — no build tools. Chrome Extension MV3.

---

### Task 1: URL sanitization in background.js

Strip query strings and fragments from tab URLs before they are included in the AI prompt. This removes the most common source of sensitive data (auth tokens, session IDs, personal query params) while still giving the AI enough context (origin + pathname) to categorize tabs.

**Files:**
- Modify: `background.js:41-43`

**Step 1: Make the change**

In `background.js`, change the `tabList` mapping from:
```js
.map((t, i) => `${i}: [${t.title}] ${t.url}`)
```
to:
```js
.map((t, i) => {
  let safeUrl = t.url;
  try { const u = new URL(t.url); safeUrl = u.origin + u.pathname; } catch {}
  return `${i}: [${t.title}] ${safeUrl}`;
})
```

**Step 2: Verify manually**
Load the extension in Chrome, open a tab with a URL like `https://example.com/page?token=abc123`, click AI Group Tabs. Confirm it groups correctly and the network request in DevTools (background service worker) shows the URL without `?token=abc123`.

**Step 3: Commit**
```bash
git add background.js
git commit -m "privacy: strip URL query strings before sending to AI"
```

---

### Task 2: Wire selected tabs to AI grouping

If the user has checked any tab checkboxes, only send those tabs to the AI. This lets privacy-conscious users manually select which tabs to expose. If nothing is selected, behavior is unchanged (all tabs sent).

**Files:**
- Modify: `popup/popup.js:382-424` (`handleAIGroup` function)

**Step 1: Update handleAIGroup to respect selection**

Replace the `tabs` construction at line 394-398:
```js
const tabs = allTabs.map((t) => ({
  id: t.id,
  title: t.title,
  url: t.url,
}));
```
with:
```js
const source = selectedTabIds.size > 0
  ? allTabs.filter((t) => selectedTabIds.has(t.id))
  : allTabs;
const tabs = source.map((t) => ({ id: t.id, title: t.title, url: t.url }));
```

**Step 2: Verify manually**
Check 3 tab checkboxes in the popup, click AI Group Tabs. Confirm only those 3 tabs get grouped. Uncheck all, click again — all tabs get grouped.

**Step 3: Commit**
```bash
git add popup/popup.js
git commit -m "feat: AI grouping respects tab selection — only send checked tabs"
```

---

### Task 3: Pre-send confirmation panel (HTML + CSS)

Add a confirmation overlay that shows before tabs are sent to the AI, telling the user exactly how many tabs and which provider will receive the data.

**Files:**
- Modify: `popup/popup.html` — add confirm panel div before `</body>`
- Modify: `popup/popup.css` — add confirm panel styles
- Modify: `popup/popup.js` — show/hide panel, wire confirm/cancel

**Step 1: Add HTML for confirm panel**

In `popup/popup.html`, before `<script src="popup.js"></script>`, add:
```html
<div id="confirm-panel" class="settings-panel hidden">
  <div class="settings-header">
    <button id="confirm-cancel-btn" class="link-btn">Cancel</button>
    <h2>Confirm AI Grouping</h2>
  </div>
  <div class="settings-body confirm-body">
    <p class="confirm-message" id="confirm-message"></p>
    <p class="confirm-detail">Only tab titles and URLs (no page content) are sent. Data goes directly to your provider — not through any intermediary server.</p>
    <div class="confirm-tab-preview" id="confirm-tab-preview"></div>
    <button id="confirm-proceed-btn" class="action-btn primary">Send & Group Tabs</button>
  </div>
</div>
```

**Step 2: Add CSS for confirm panel**

In `popup/popup.css`, append:
```css
/* ── Confirm panel ───────────────────────────────────────── */

.confirm-body {
  gap: 14px;
}

.confirm-message {
  font-size: 13px;
  color: var(--text-0);
  font-weight: 500;
  line-height: 1.4;
}

.confirm-detail {
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.6;
  padding: 10px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--r);
}

.confirm-tab-preview {
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.6;
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 8px 12px;
}

.confirm-tab-preview div {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 1px 0;
}

.confirm-tab-preview div:not(:last-child) {
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
```

**Step 3: Wire the confirm panel in popup.js**

In `setupListeners()`, add two new event listeners after the existing ones:
```js
$("confirm-cancel-btn").addEventListener("click", () => {
  $("confirm-panel").classList.add("hidden");
  $("btn-group").disabled = false;
});
$("confirm-proceed-btn").addEventListener("click", () => {
  $("confirm-panel").classList.add("hidden");
  proceedWithAIGroup();
});
```

**Step 4: Split handleAIGroup into two functions**

Replace `handleAIGroup` with two functions:

```js
async function handleAIGroup() {
  const stored = await chrome.storage.local.get(["apiKey", "provider", "model", "baseUrl"]);
  if (!stored.apiKey) { showOnboarding(); return; }

  const source = selectedTabIds.size > 0
    ? allTabs.filter((t) => selectedTabIds.has(t.id))
    : allTabs;

  const provider = stored.provider || "openrouter";
  const tabWord = source.length === 1 ? "tab" : "tabs";
  $("confirm-message").textContent =
    `${source.length} ${tabWord} will be sent to ${provider}.`;

  const preview = $("confirm-tab-preview");
  preview.innerHTML = "";
  source.slice(0, 12).forEach((t) => {
    const d = document.createElement("div");
    d.textContent = t.title || t.url;
    preview.appendChild(d);
  });
  if (source.length > 12) {
    const more = document.createElement("div");
    more.style.color = "var(--text-2)";
    more.style.fontStyle = "italic";
    more.textContent = `...and ${source.length - 12} more`;
    preview.appendChild(more);
  }

  $("btn-group").disabled = true;
  $("confirm-panel").classList.remove("hidden");

  // store for use in proceedWithAIGroup
  handleAIGroup._stored = stored;
  handleAIGroup._source = source;
}

async function proceedWithAIGroup() {
  const stored = handleAIGroup._stored;
  const source = handleAIGroup._source;
  if (!stored || !source) return;

  showStatus("Analyzing tabs with AI...");
  $("btn-group").disabled = true;

  try {
    const tabs = source.map((t) => ({ id: t.id, title: t.title, url: t.url }));
    const groups = await chrome.runtime.sendMessage({
      type: "AI_GROUP_TABS",
      tabs,
      config: {
        apiKey: stored.apiKey,
        provider: stored.provider || "openrouter",
        model: stored.model || "",
        baseUrl: stored.baseUrl || "",
      },
    });
    if (!groups || groups.error) {
      showStatus(groups?.error || "No response from background.", "error");
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
```

Note: Using `handleAIGroup._stored` as a simple pass-through is fine for a single-user popup with no concurrency. No need for a class or closure.

**Step 5: Verify manually**
Click "AI Group Tabs". Confirm panel appears showing provider name, tab count, and preview list. Click Cancel — panel closes, button re-enables. Click again, then "Send & Group Tabs" — tabs get grouped normally.

**Step 6: Commit**
```bash
git add popup/popup.html popup/popup.css popup/popup.js
git commit -m "feat: add pre-send confirmation dialog for AI tab grouping"
```

---

### Task 4: Analytics disclosure in Settings panel

The extension silently tracks tab visit frequency by hostname in `chrome.storage.local`. Users deserve to know this. Add a static disclosure note and a "Clear analytics" button in the Settings panel.

**Files:**
- Modify: `popup/popup.html` — add disclosure block to settings body
- Modify: `popup/popup.js` — wire clear analytics button

**Step 1: Add HTML to settings panel**

In `popup/popup.html`, inside `<div class="settings-body">` (the settings panel, not home-tabs), add before the closing `</div>` of settings-body:
```html
<div class="privacy-disclosure">
  <span class="setting-label">Privacy</span>
  <p class="setting-hint">
    Tab visit frequency is tracked <strong>locally</strong> to power usage insights.
    This data never leaves your device.
  </p>
  <button id="clear-analytics-btn" class="action-btn">Clear local analytics</button>
</div>
```

**Step 2: Add CSS for disclosure block**

In `popup/popup.css`, append:
```css
/* ── Privacy disclosure ──────────────────────────────────── */

.privacy-disclosure {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.privacy-disclosure .setting-hint strong {
  color: var(--text-1);
  font-weight: 600;
}
```

**Step 3: Wire clear analytics button in popup.js**

In `setupListeners()`, add:
```js
$("clear-analytics-btn").addEventListener("click", async () => {
  await chrome.storage.local.remove("analytics");
  showStatus("Analytics cleared.", "success");
  hideSettings();
});
```

**Step 4: Verify manually**
Open Settings. Confirm "Privacy" section appears at the bottom with disclosure text and button. Click "Clear local analytics" — settings closes, success message shows. Open `chrome.storage.local` in DevTools and confirm `analytics` key is gone.

**Step 5: Commit**
```bash
git add popup/popup.html popup/popup.css popup/popup.js
git commit -m "feat: disclose local analytics tracking and add clear button in settings"
```

---

### Task 5: Privacy note near AI Group button

Add a small "shield" info note below the action buttons that appears on hover of the AI Group button, or as always-visible static text, reassuring users their data goes directly to their provider.

**Files:**
- Modify: `popup/popup.html` — add note element after `.actions` div
- Modify: `popup/popup.css` — style the note

**Step 1: Add HTML**

In `popup/popup.html`, after the closing `</div>` of `.actions`:
```html
<p class="privacy-note" id="privacy-note">
  Tab titles &amp; URLs sent directly to your provider — no intermediary.
</p>
```

**Step 2: Add CSS**

In `popup/popup.css`, append:
```css
/* ── Privacy note ────────────────────────────────────────── */

.privacy-note {
  font-size: 10px;
  color: var(--text-2);
  text-align: center;
  padding: 0 12px 6px;
  line-height: 1.4;
  flex-shrink: 0;
  opacity: 0.7;
}
```

**Step 3: Verify manually**
Open popup. Confirm the privacy note appears below the action buttons, small and unobtrusive.

**Step 4: Commit**
```bash
git add popup/popup.html popup/popup.css
git commit -m "feat: add privacy note below AI Group button"
```

---

### Task 6: Privacy note in onboarding panel

The onboarding panel is where new users first enter an API key and trigger AI grouping. Add a privacy statement here too.

**Files:**
- Modify: `popup/popup.html` — add line to onboarding panel

**Step 1: Add HTML**

In the onboarding panel (`#onboarding-panel`), after the existing `.onboarding-hint` paragraph, add:
```html
<p class="onboarding-hint" style="margin-top: -4px;">
  Your tab titles and URLs are sent directly to the provider using your key.
  No data passes through our servers.
</p>
```

**Step 2: Verify manually**
Click AI Group Tabs without an API key configured. Confirm onboarding panel shows the privacy statement below the "Get a free key at..." hint.

**Step 3: Commit**
```bash
git add popup/popup.html
git commit -m "feat: add privacy disclosure to onboarding panel"
```
