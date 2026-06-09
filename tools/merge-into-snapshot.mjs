// Incremental snapshot refresh: merge a fresh Gmail read (tools/_new.json, a
// raw `search_threads` payload {threads:[...]}) into public/live-snapshot.json.
//
// Used by the session auto-refresh loop: each cycle pulls the latest inbox via
// the authorized connection, writes it to _new.json, and runs this to upsert new
// mail / updated state into the snapshot the app polls. Read-only, idempotent.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeRestMessage } from "../server/lib/normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAP = join(__dirname, "..", "public", "live-snapshot.json");
const NEW = join(__dirname, "_new.json");
const SELF = [
  "federico.donatone@growthcab.com",
  "federico@growthcab.com",
  "federicodonatone1@gmail.com",
];
const LABEL_COLORS = { Partnerships: "#42d692", Network: "#ff7537", Journalist: "#4986e7" };

if (!existsSync(SNAP)) {
  console.error("No snapshot yet — run `npm run snapshot` first.");
  process.exit(1);
}
if (!existsSync(NEW)) {
  console.error("No tools/_new.json to merge.");
  process.exit(1);
}

const snap = JSON.parse(readFileSync(SNAP, "utf8"));
const fresh = JSON.parse(readFileSync(NEW, "utf8"));
const byId = new Map(snap.emails.map((e) => [e.id, e]));

let added = 0;
let updated = 0;
for (const thread of fresh.threads ?? []) {
  for (const msg of thread.messages ?? []) {
    const email = normalizeRestMessage(msg, thread.id.replace(/-thread$/, ""), SELF);
    const prev = byId.get(email.id);
    if (!prev) {
      byId.set(email.id, email);
      added += 1;
    } else if (
      prev.read !== email.read ||
      prev.starred !== email.starred ||
      prev.archived !== email.archived ||
      JSON.stringify(prev.labels) !== JSON.stringify(email.labels)
    ) {
      // Preserve any richer body we already had; take the fresh Gmail state.
      byId.set(email.id, { ...email, body: prev.body || email.body, preview: prev.preview || email.preview });
      updated += 1;
    }
  }
}

const emails = [...byId.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
const names = new Set();
for (const e of emails) for (const l of e.labels) names.add(l);
snap.emails = emails;
snap.labels = [...names].sort().map((name) => ({ id: `gmail-${name}`, name, color: LABEL_COLORS[name], system: false }));
snap.generatedAt = new Date().toISOString();

writeFileSync(SNAP, JSON.stringify(snap, null, 2));
console.log(`merged: +${added} new · ${updated} updated · ${emails.length} total`);
