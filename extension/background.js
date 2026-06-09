// SuperMail launcher — one keystroke (Ctrl/⌘+Shift+M) or one click from any
// tab. Focuses the existing SuperMail tab if one is open (pinned-tab pattern,
// like a real mail client), otherwise opens a new pinned tab.
//
// The target URL is configurable in the extension options:
//   http://localhost:8787  → your local bridge: REAL two-way Gmail sync
//   the GitHub Pages URL   → static demo (mock mailbox, no Gmail)

const DEFAULT_URL = "http://localhost:8787/";

async function supermailUrl() {
  const { url } = await chrome.storage.sync.get({ url: DEFAULT_URL });
  try {
    return new URL(url).toString();
  } catch {
    return DEFAULT_URL;
  }
}

function sameSite(tabUrl, target) {
  try {
    const a = new URL(tabUrl);
    const b = new URL(target);
    // Match by origin, and by path prefix for sub-path deploys (GitHub Pages).
    return a.origin === b.origin && a.pathname.startsWith(b.pathname.replace(/\/?$/, ""));
  } catch {
    return false;
  }
}

chrome.action.onClicked.addListener(async () => {
  const url = await supermailUrl();
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => t.url && sameSite(t.url, url));
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url, pinned: true });
  }
});
