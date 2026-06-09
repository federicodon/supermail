# SuperMail Chrome extension

One keystroke from anywhere in Chrome to your mail: **Ctrl/⌘+Shift+M** (or the
toolbar ⚡ button) opens SuperMail — focusing the already-open tab if there is
one (pinned-tab pattern), otherwise opening a new pinned tab.

## Install (≈30 seconds)

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. **Load unpacked** → select this `extension/` folder
4. Optional: pin the ⚡ icon (puzzle-piece menu → pin), and adjust the shortcut
   at `chrome://extensions/shortcuts`

## Point it at your SuperMail

Right-click the ⚡ icon → **Options** (or chrome://extensions → SuperMail →
Details → Extension options):

| URL | What you get |
| --- | --- |
| `http://localhost:8787/` *(default)* | **Real two-way Gmail sync** via the local bridge |
| `http://localhost:5273/` | Vite dev server (`npm run dev` / `npm run live`) |
| `https://federicodon.github.io/supermail/` | Static demo (mock mailbox, no Gmail) |

For the real-Gmail setup, from the repo root:

```bash
npm run build     # build the UI once (the bridge serves it)
npm run sync      # keep the bridge running (or install the LaunchAgent — see main README)
```

Then SuperMail lives at `http://localhost:8787/`, fully synced with Gmail in
real time, one keystroke away. No extension store, no third-party servers: the
extension only stores your chosen URL (`chrome.storage.sync`) and opens tabs.

## The keyboard loop it unlocks

`⌘⇧M` (open SuperMail) → `j`/`k` (move) → `Enter` (open → **reply** when
reading) → `⌘J` (tell AI what to write, `Enter` writes it) → edit if needed →
`⌘↵` (send, with undo window) → next.
