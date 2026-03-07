# Onboarding & Copy Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve first-run onboarding by showing an inline setup card when no API key is set, change default provider/model to free OpenRouter, and update all store/manifest copy.

**Architecture:** All changes are in `popup/popup.js`, `popup/popup.html`, and `manifest.json`. No new files needed. The onboarding card is rendered inline in the popup (replaces the main view when no key is detected on AI Group click, or on load). Settings panel keeps all fields visible but defaults change.

**Tech Stack:** Plain HTML/CSS/JS (no build step), Chrome Extension MV3.

---

### Task 1: Update manifest.json description

**Files:**
- Modify: `manifest.json`

**Step 1: Edit the description field**

In `manifest.json`, change:
```json
"description": "Manage your browser tabs intelligently with AI",
```
to:
```json
"description": "Snap your tabs into smart groups with one click. Powered by free AI — no signup, just your own API key.",
```

**Step 2: Verify**

Open `manifest.json` and confirm the change looks correct. No automated test — visual check.

**Step 3: Commit**
```bash
git add manifest.json
git commit -m "chore: update manifest description for store listing"
```

---

### Task 2: Change default provider and model in settings

**Files:**
- Modify: `popup/popup.js:541-566` (PROVIDER_INFO block)
- Modify: `popup/popup.js:584-594` (loadSettings function)

**Step 1: Update PROVIDER_INFO for openrouter**

In `popup/popup.js`, find the `openrouter` entry in `PROVIDER_INFO` (around line 548) and change:
```js
openrouter: {
  hint: 'Free models available. Get your key at <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>',
  placeholder: "sk-or-...",
  defaultModel: "meta-llama/llama-3.1-8b-instruct:free",
  showBaseUrl: false,
},
```
to:
```js
openrouter: {
  hint: 'Free models — no credit card needed. Get your key at <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>',
  placeholder: "sk-or-...",
  defaultModel: "arcee-ai/trinity-large-preview:free",
  showBaseUrl: false,
},
```

**Step 2: Change default provider in loadSettings**

In `loadSettings()` (around line 585), change:
```js
const provider = stored.provider || "anthropic";
```
to:
```js
const provider = stored.provider || "openrouter";
```

**Step 3: Also pre-fill the model input with the default when no model is saved**

In `loadSettings()`, change:
```js
$("model-input").value = stored.model || "";
```
to:
```js
const defaultModel = (PROVIDER_INFO[provider] || {}).defaultModel || "";
$("model-input").value = stored.model || defaultModel;
```

**Step 4: Verify**

Reload the extension in `chrome://extensions/`. Open the popup → Settings. Confirm:
- Provider dropdown shows "OpenRouter (free models)" selected by default
- Model field shows `arcee-ai/trinity-large-preview:free`
- Hint text reads "Free models — no credit card needed..."

**Step 5: Commit**
```bash
git add popup/popup.js
git commit -m "feat: default to OpenRouter free model for new users"
```

---

### Task 3: Add inline onboarding card

**Files:**
- Modify: `popup/popup.html` — add onboarding panel markup
- Modify: `popup/popup.js` — show/hide onboarding card, save key + fire grouping

**Step 1: Add onboarding panel HTML**

In `popup/popup.html`, after `<div id="app">` and the `<header>` block (after line 29, before `<div class="search-bar">`), add:

```html
<div id="onboarding-panel" class="onboarding-panel hidden">
  <div class="onboarding-icon">✦</div>
  <h2 class="onboarding-title">AI Tab Grouping</h2>
  <p class="onboarding-body">
    Group all your open tabs in one click — for free.<br>
    No account. No signup. Just a free API key.
  </p>
  <input type="password" id="onboarding-key-input" placeholder="sk-or-..." autocomplete="off">
  <button id="onboarding-submit" class="action-btn primary">Get started →</button>
  <p class="onboarding-hint">
    Get a free key at
    <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>
  </p>
</div>
```

**Step 2: Add onboarding CSS to popup.css**

In `popup/popup.css`, append at the end:

```css
/* ─── Onboarding ─────────────────────────────────────────────────────────── */

.onboarding-panel {
  padding: 20px 16px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}

.onboarding-panel.hidden { display: none; }

.onboarding-icon {
  font-size: 28px;
  color: #7c6af7;
  line-height: 1;
}

.onboarding-title {
  font-size: 15px;
  font-weight: 600;
  color: #e8e8f0;
  margin: 0;
}

.onboarding-body {
  font-size: 12px;
  color: #9090b0;
  line-height: 1.5;
  margin: 0;
}

.onboarding-panel input[type="password"] {
  width: 100%;
  box-sizing: border-box;
  background: #1e1e2e;
  border: 1px solid #3a3a52;
  border-radius: 6px;
  color: #e8e8f0;
  font-size: 12px;
  padding: 7px 10px;
  outline: none;
}

.onboarding-panel input[type="password"]:focus {
  border-color: #7c6af7;
}

.onboarding-panel .action-btn {
  width: 100%;
}

.onboarding-hint {
  font-size: 11px;
  color: #6060a0;
  margin: 0;
}

.onboarding-hint a {
  color: #7c6af7;
  text-decoration: none;
}
```

**Step 3: Wire up onboarding logic in popup.js**

In `popup/popup.js`, add these two functions before `handleAIGroup`:

```js
// ─── Onboarding ───────────────────────────────────────────────────────────────

function showOnboarding() {
  $("onboarding-panel").classList.remove("hidden");
}

function hideOnboarding() {
  $("onboarding-panel").classList.add("hidden");
}
```

Then add the onboarding submit handler inside `setupListeners()`, after the existing listeners:

```js
$("onboarding-submit").addEventListener("click", async () => {
  const key = $("onboarding-key-input").value.trim();
  if (!key) {
    showStatus("Please enter an API key.", "error");
    return;
  }
  await chrome.storage.local.set({
    apiKey: key,
    provider: "openrouter",
    model: "arcee-ai/trinity-large-preview:free",
  });
  hideOnboarding();
  await handleAIGroup();
});
```

**Step 4: Show onboarding instead of toast when no key**

In `handleAIGroup()`, replace:
```js
if (!stored.apiKey) {
  showStatus("No API key set. Click ⚙ Settings to add your key.", "error");
  return;
}
```
with:
```js
if (!stored.apiKey) {
  showOnboarding();
  return;
}
```

**Step 5: Verify end-to-end**

1. Clear storage: open DevTools → Application → Storage → Clear all for the extension
2. Reload extension, open popup
3. Click "AI Group Tabs" — onboarding card should appear
4. Paste a real or dummy `sk-or-...` key and click "Get started →"
5. Confirm it fires the AI grouping flow and the onboarding card disappears
6. Open Settings — confirm Provider = OpenRouter, Model = `arcee-ai/trinity-large-preview:free`

**Step 6: Commit**
```bash
git add popup/popup.html popup/popup.js popup/popup.css
git commit -m "feat: add inline onboarding card for first-time API key setup"
```

---

### Task 4: Store listing copy (reference doc)

No code changes — this is copy to paste into the Chrome Web Store dashboard.

**Manifest description (already done in Task 1):**
```
Snap your tabs into smart groups with one click. Powered by free AI — no signup, just your own API key.
```

**Store listing — short tagline:**
```
One button. All your tabs, organized. Free AI, no signup.
```

**Store listing — full description:**
```
TabSnap uses AI to instantly group your open tabs by topic — with a single click. No accounts, no subscriptions. Just paste a free API key from OpenRouter and you're done.

What it does:
• ✦ AI Group Tabs — one click groups everything intelligently
• See when you last visited each tab, right in the list
• Close duplicate tabs automatically (same URL, one click)
• Suspend inactive tabs to save memory
• Save your daily tabs as a "home" set

Completely free to start. OpenRouter offers free models (no credit card). For more control, swap in any provider: Anthropic, Groq, or any OpenAI-compatible API.

Your API key stays on your device. TabSnap never touches your data.
```

**Step 1: Save this copy**

No commit needed — paste into the Chrome Web Store Developer Dashboard when submitting.

---
