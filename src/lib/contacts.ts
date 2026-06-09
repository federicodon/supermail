import type { Contact, Email } from "../types";

// Contacts / People — a relationship graph built from the mailbox.
//
// Superhuman surfaces the people you email most, with context (company, recent
// threads, who owes whom a reply). SuperMail derives the same from the local
// mailbox: for every message, the "other party" (the sender on inbound mail, the
// recipients on outbound mail) is aggregated into a contact with interaction
// counts, the last time you talked, unread volume, and a VIP heuristic. Pure and
// deterministic so it is unit-tested and shared by the People view.

export interface ContactStats {
  name: string;
  email: string;
  company?: string;
  role?: string;
  received: number; // messages they sent you
  sent: number; // messages you sent them
  threads: number; // distinct conversations
  unread: number; // unread messages from them
  lastInteraction: string; // ISO of the most recent message either direction
  vip: boolean; // frequent / starred correspondent
}

const norm = (s: string) => s.trim().toLowerCase();

interface Acc {
  name: string;
  email: string;
  company?: string;
  role?: string;
  received: number;
  sent: number;
  unread: number;
  starred: number;
  threads: Set<string>;
  last: number;
}

// Build the contact graph. `selfEmail` is excluded (you don't list yourself).
export function buildContacts(emails: Email[], selfEmail: string): ContactStats[] {
  const self = norm(selfEmail);
  const map = new Map<string, Acc>();

  const touch = (
    person: { name: string; email: string; company?: string; role?: string },
    email: Email,
    direction: "received" | "sent"
  ) => {
    const key = norm(person.email);
    if (!key || key === self) return;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        name: person.name || person.email,
        email: person.email,
        received: 0,
        sent: 0,
        unread: 0,
        starred: 0,
        threads: new Set(),
        last: 0,
      };
      map.set(key, acc);
    }
    // Prefer a longer/real name and any company/role we learn.
    if (person.name && person.name.length > acc.name.length) acc.name = person.name;
    if (person.company && !acc.company) acc.company = person.company;
    if (person.role && !acc.role) acc.role = person.role;
    acc[direction] += 1;
    acc.threads.add(email.threadId);
    if (direction === "received" && !email.read) acc.unread += 1;
    if (email.starred) acc.starred += 1;
    acc.last = Math.max(acc.last, Date.parse(email.date) || 0);
  };

  for (const e of emails) {
    if (e.outbound) {
      for (const t of e.to) touch(t, e, "sent");
    } else {
      touch(e.from, e, "received");
    }
  }

  return [...map.values()]
    .map((a) => ({
      name: a.name,
      email: a.email,
      company: a.company,
      role: a.role,
      received: a.received,
      sent: a.sent,
      threads: a.threads.size,
      unread: a.unread,
      lastInteraction: a.last ? new Date(a.last).toISOString() : new Date(0).toISOString(),
      vip: a.received + a.sent >= 4 || a.starred > 0,
    }))
    .sort((x, y) => Date.parse(y.lastInteraction) - Date.parse(x.lastInteraction));
}

// Stats for a single contact (the person you're reading), or null if there's no
// relationship history. Drives the reader's sender card. Derived from the same
// graph as the People view so the numbers always agree.
export function contactStatsFor(
  emails: Email[],
  contactEmail: string,
  selfEmail: string
): ContactStats | null {
  const key = norm(contactEmail);
  if (!key) return null;
  return buildContacts(emails, selfEmail).find((c) => norm(c.email) === key) ?? null;
}

// The dominant external party in a conversation — "who this thread is with".
// Drives the reader's sender insight card. We count each non-self participation
// (the sender on inbound messages, every recipient on outbound ones) and return
// the most-seen person, breaking ties by most recent appearance, while learning
// the longest name + any company/role seen across the thread. Returns null for a
// thread that only involves you (e.g. a note-to-self) or an empty message list.
export function primaryCorrespondent(messages: Email[], selfEmail: string): Contact | null {
  const self = norm(selfEmail);
  const tally = new Map<string, { contact: Contact; n: number; last: number }>();

  const bump = (person: Contact, when: number) => {
    const key = norm(person.email);
    if (!key || key === self) return;
    const cur = tally.get(key);
    if (!cur) {
      tally.set(key, { contact: { ...person }, n: 1, last: when });
      return;
    }
    cur.n += 1;
    cur.last = Math.max(cur.last, when);
    if (person.name && person.name.length > cur.contact.name.length) cur.contact.name = person.name;
    if (person.company && !cur.contact.company) cur.contact.company = person.company;
    if (person.role && !cur.contact.role) cur.contact.role = person.role;
  };

  for (const m of messages) {
    const when = Date.parse(m.date) || 0;
    if (m.outbound) {
      for (const t of m.to) bump(t, when);
    } else {
      bump(m.from, when);
    }
  }

  let best: { contact: Contact; n: number; last: number } | null = null;
  for (const v of tally.values()) {
    if (!best || v.n > best.n || (v.n === best.n && v.last > best.last)) best = v;
  }
  return best ? best.contact : null;
}

export type ContactSort = "recent" | "frequent" | "name" | "unread";

export function sortContacts(contacts: ContactStats[], by: ContactSort): ContactStats[] {
  const out = contacts.slice();
  switch (by) {
    case "frequent":
      return out.sort((a, b) => b.received + b.sent - (a.received + a.sent));
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    case "unread":
      return out.sort((a, b) => b.unread - a.unread || Date.parse(b.lastInteraction) - Date.parse(a.lastInteraction));
    case "recent":
    default:
      return out.sort((a, b) => Date.parse(b.lastInteraction) - Date.parse(a.lastInteraction));
  }
}

export function searchContacts(contacts: ContactStats[], query: string): ContactStats[] {
  const q = norm(query);
  if (!q) return contacts;
  return contacts.filter((c) =>
    [c.name, c.email, c.company ?? "", c.role ?? ""].join(" ").toLowerCase().includes(q)
  );
}

// Messages where a given contact is a participant (sender or recipient).
export function emailsWithContact(emails: Email[], contactEmail: string): Email[] {
  const key = norm(contactEmail);
  return emails.filter(
    (e) => norm(e.from.email) === key || e.to.some((t) => norm(t.email) === key)
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic avatar tint from the email (CSS hsl string).
export function avatarColor(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 42%)`;
}
