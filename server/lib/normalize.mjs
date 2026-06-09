// Gmail message -> SuperMail `Email` normalizer (shared by the live IMAP bridge
// and the one-off MCP snapshot generator).
//
// Two entry points produce the SAME `Email` shape (see ../../src/types.ts):
//   - normalizeRestMessage()  for the Gmail REST / MCP `search_threads` shape
//                             (labels are IDs, body is a snippet)
//   - normalizeImapMessage()  for an imapflow fetch object + mailparser result
//                             (labels are Gmail X-GM-LABELS names, full body)
//
// Both yield Gmail's stable hex message id as `Email.id` and X-GM-THRID (hex) as
// `Email.threadId`, so the snapshot and the live stream share one id space and
// merge cleanly.

// ---- Gmail label id -> display name (from users.labels.list) ----------------
// User/system label ids are stable per-account; this map covers the connected
// Growthcab mailbox. Unknown ids fall back to the raw id (still usable).
export const LABEL_NAMES = {
  Label_3: "[Superhuman]/Muted",
  Label_4: "[Superhuman]/ru",
  Label_5: "[Superhuman]",
  Label_6: "[Superhuman]/Is Snoozed",
  Label_7: "[Superhuman]/AI/Respond",
  Label_8: "[Superhuman]/AI/Waiting",
  Label_9: "[Superhuman]/AI/Meeting",
  Label_10: "[Superhuman]/AI/News",
  Label_11: "[Superhuman]/AI/Social",
  Label_12: "[Superhuman]/AI/Pitch",
  Label_13: "[Superhuman]/AI/Marketing",
  Label_14: "[Superhuman]/AI/AutoArchived",
  Label_1460582811481042264: "Partnerships",
  Label_3411688287133774036: "Network",
  Label_6683266858896709924: "Journalist",
};

// Gmail system labels that are state, not user-facing tags.
const SYSTEM_LABELS = new Set([
  "INBOX", "SENT", "DRAFT", "UNREAD", "STARRED", "IMPORTANT", "TRASH", "SPAM",
  "CHAT", "CATEGORY_PERSONAL", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES", "CATEGORY_FORUMS",
]);

// X-GM-LABELS (IMAP) flavour of the system labels (escaped, leading backslash).
const IMAP_SYSTEM = {
  "\\inbox": "INBOX",
  "\\sent": "SENT",
  "\\draft": "DRAFT",
  "\\drafts": "DRAFT",
  "\\important": "IMPORTANT",
  "\\starred": "STARRED",
  "\\flagged": "STARRED",
  "\\trash": "TRASH",
  "\\junk": "SPAM",
  "\\spam": "SPAM",
  "\\seen": "SEEN",
};

const ENTITIES = {
  "&amp;": "&", "&#39;": "'", "&#039;": "'", "&quot;": '"', "&lt;": "<",
  "&gt;": ">", "&nbsp;": " ", "&apos;": "'", "&hellip;": "…", "&mdash;": "—",
  "&ndash;": "–",
};

export function decodeEntities(s = "") {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    // Strip the zero-width / soft-hyphen padding bulk senders inject into snippets.
    .replace(/[͏​-‏­⁠﻿]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Parse an RFC 5322 address ("Name <a@b.com>" | "a@b.com" | "\"Last, First\" <..>")
// into { name, email }. Resilient to bare emails and missing display names.
export function parseContact(value) {
  if (!value) return { name: "", email: "" };
  if (typeof value === "object") {
    // mailparser address object: { name, address }
    const email = (value.address ?? "").trim();
    return { name: (value.name || email.split("@")[0] || email).trim(), email };
  }
  const str = String(value).trim();
  const angle = str.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (angle) {
    const email = angle[2].trim();
    return { name: (angle[1].trim() || email.split("@")[0]).trim(), email };
  }
  const email = str.replace(/^<|>$/g, "").trim();
  return { name: (email.split("@")[0] || email).trim(), email };
}

function parseContactList(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : String(value).split(",");
  return arr.map(parseContact).filter((c) => c.email);
}

function categoryFromLabels(labelNames) {
  const set = new Set(labelNames);
  if (set.has("CATEGORY_SOCIAL") || labelNames.some((l) => /\/Social$/i.test(l)))
    return "social";
  if (
    set.has("CATEGORY_PROMOTIONS") ||
    set.has("CATEGORY_UPDATES") ||
    labelNames.some((l) => /\/(News|Marketing)$/i.test(l))
  )
    return "news";
  if (set.has("IMPORTANT")) return "important";
  return "other";
}

// User-facing labels only: drop Gmail state labels + Gmail categories.
function userLabels(labelNames) {
  return labelNames.filter(
    (l) => !SYSTEM_LABELS.has(l) && !l.startsWith("CATEGORY_")
  );
}

function buildEmail({
  id,
  threadId,
  fromRaw,
  toRaw,
  ccRaw,
  subject,
  body,
  preview,
  dateIso,
  labelNames,
  attachments,
  selfEmails,
  listUnsubscribe,
  listUnsubscribePost,
}) {
  const from = parseContact(fromRaw);
  const labels = labelNames ?? [];
  const has = (l) => labels.includes(l);
  const self = new Set((selfEmails ?? []).map((e) => e.toLowerCase()));
  const outbound = has("SENT") || (!!from.email && self.has(from.email.toLowerCase()));
  const cleanBody = decodeEntities(body || preview || "");
  return {
    id,
    threadId: threadId || id,
    accountId: "work",
    from,
    to: parseContactList(toRaw),
    cc: ccRaw && parseContactList(ccRaw).length ? parseContactList(ccRaw) : undefined,
    subject: decodeEntities(subject) || "(no subject)",
    preview: decodeEntities(preview || body || "").slice(0, 200),
    body: cleanBody,
    date: dateIso,
    read: !has("UNREAD"),
    starred: has("STARRED"),
    archived: !has("INBOX"),
    category: categoryFromLabels(labels),
    labels: userLabels(labels),
    attachments: attachments ?? [],
    snoozedUntil: null,
    trashed: has("TRASH"),
    muted: labels.some((l) => /\/Muted$/i.test(l)),
    reminderAt: null,
    openedByRecipientAt: null,
    outbound,
    listUnsubscribe: listUnsubscribe || undefined,
    listUnsubscribePost: !!listUnsubscribePost,
  };
}

// ---- Gmail REST / MCP search_threads message --------------------------------
// Shape: { id, threadId?, date, sender, subject, snippet, labelIds,
//          toRecipients, ccRecipients }
export function normalizeRestMessage(msg, threadId, selfEmails) {
  const labelNames = (msg.labelIds ?? []).map((id) => LABEL_NAMES[id] ?? id);
  return buildEmail({
    id: msg.id,
    threadId: threadId ?? msg.threadId ?? msg.id,
    fromRaw: msg.sender ?? msg.from,
    toRaw: msg.toRecipients ?? msg.to,
    ccRaw: msg.ccRecipients ?? msg.cc,
    subject: msg.subject ?? "",
    body: msg.plaintext_body ?? msg.body ?? msg.snippet ?? "",
    preview: msg.snippet ?? "",
    dateIso: msg.date ? new Date(msg.date).toISOString() : new Date(0).toISOString(),
    labelNames,
    attachments: msg.attachments ?? [],
    selfEmails,
  });
}

// ---- imapflow fetch object + mailparser result ------------------------------
// `fetched`: imapflow FetchMessageObject ({ uid, emailId, threadId, labels:Set,
//   flags:Set, envelope }). `parsed`: mailparser ParsedMail (from, to, cc,
//   subject, text, html, date, attachments, headers).
export function normalizeImapMessage(fetched, parsed, selfEmails) {
  const gmLabels = labelsFromImap(fetched);
  const env = parsed || {};
  const headerUnsub = headerValue(parsed, "list-unsubscribe");
  const unsubPost = headerValue(parsed, "list-unsubscribe-post");
  const id = hexId(fetched?.emailId) || env.messageId || String(fetched?.uid ?? "");
  const threadId = hexId(fetched?.threadId) || id;
  const bodyText =
    (env.text && env.text.trim()) ||
    (env.html ? htmlToText(env.html) : "") ||
    "";
  return buildEmail({
    id,
    threadId,
    fromRaw: env.from?.value?.[0] ?? env.from?.text ?? "",
    toRaw: env.to?.value ?? env.to?.text ?? "",
    ccRaw: env.cc?.value ?? env.cc?.text ?? "",
    subject: env.subject ?? "",
    body: bodyText,
    preview: bodyText.slice(0, 200),
    dateIso: (env.date instanceof Date ? env.date : new Date(env.date ?? Date.now())).toISOString(),
    labelNames: gmLabels,
    attachments: (env.attachments ?? []).map((a) => a.filename).filter(Boolean),
    selfEmails,
    listUnsubscribe: headerUnsub,
    listUnsubscribePost: /one-click/i.test(unsubPost || ""),
  });
}

// X-GM-LABELS arrive as a Set/array of strings: system ("\\Inbox", "\\Sent",
// "\\Important", "\\Starred") + user label names ("Partnerships", "[Superhuman]/..").
// Map to our internal label-name space (system normalized, user kept verbatim).
function labelsFromImap(fetched) {
  const out = [];
  const raw = fetched?.labels ? Array.from(fetched.labels) : [];
  for (const l of raw) {
    const sys = IMAP_SYSTEM[String(l).toLowerCase()];
    if (sys) {
      if (sys !== "SEEN") out.push(sys);
    } else {
      out.push(String(l).replace(/^"|"$/g, ""));
    }
  }
  // IMAP \Seen flag -> read state. Absence of \Seen => UNREAD.
  const flags = fetched?.flags ? Array.from(fetched.flags).map((f) => String(f).toLowerCase()) : [];
  if (!flags.includes("\\seen")) out.push("UNREAD");
  if (flags.includes("\\flagged") && !out.includes("STARRED")) out.push("STARRED");
  return out;
}

function headerValue(parsed, name) {
  try {
    const h = parsed?.headers;
    if (h && typeof h.get === "function") {
      const v = h.get(name);
      return typeof v === "string" ? v : v?.text ?? "";
    }
  } catch {
    /* ignore */
  }
  return "";
}

// Gmail OBJECTID emailId/threadId may come back as a decimal X-GM-MSGID; the REST
// API id is its hex form. Normalize to lowercase hex so all sources align.
function hexId(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  if (/^[0-9a-f]+$/i.test(s) && /[a-f]/i.test(s)) return s.toLowerCase(); // already hex
  if (/^\d+$/.test(s)) {
    try {
      return BigInt(s).toString(16);
    } catch {
      return s;
    }
  }
  return s.toLowerCase();
}

function htmlToText(html) {
  return decodeEntities(
    String(html)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\n{3,}/g, "\n\n")
  );
}
