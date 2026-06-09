import type { Email, OutboxItem } from "../types";
import type { CalendarEvent } from "./calendar";
import { dayKey, formatClockTime, formatTimeRange } from "./calendar";
import { hasReplyAfter } from "./reminders";

// "Today" — a unified daily agenda.
//
// Superhuman scatters time-anchored work across Reminders, Snoozed, the Outbox
// and the Calendar. This view pulls every one of those onto a single
// chronological timeline so a power user can answer "what's on my plate today
// and next?" in one glance:
//
//   • Calendar events still ahead (meetings, focus blocks)
//   • Reminders / follow-ups about to fire
//   • Snoozed conversations returning to the inbox
//   • Scheduled "send later" messages about to leave
//
// Everything here is PURE and DETERMINISTIC — `now` is injected, day grouping
// and time formatting are done in UTC (consistent with calendar.ts) so the
// unit tests are stable on any machine and the labels never drift from the
// Calendar view.

const DAY = 86_400_000;

export type AgendaKind = "event" | "reminder" | "followup" | "snoozed" | "send";
export type AgendaRef = "thread" | "event" | "outbox";

export interface AgendaItem {
  id: string; // stable composite id, e.g. "reminder:t3"
  kind: AgendaKind;
  at: string; // ISO anchor instant (event start / reminder / snooze return / send time)
  endAt?: string; // ISO end (events only)
  ts: number; // Date.parse(at), for sorting / grouping
  title: string;
  subtitle: string;
  icon: string;
  refId: string; // what a click resolves to: a message id (thread), event id, or outbox id
  refKind: AgendaRef;
  overdue: boolean; // a task-like item whose time has passed (needs attention)
  allDay?: boolean;
}

export interface AgendaInput {
  emails: Email[];
  events: CalendarEvent[];
  outbox: OutboxItem[];
}

export interface AgendaDay {
  key: string; // dayKey ("Mon, Jun 8") or the synthetic "overdue"
  label: string; // "Overdue" / "Today" / "Tomorrow" / "Mon, Jun 8"
  dayStart: number; // UTC start-of-day ms (sort key)
  overdue?: boolean; // the synthetic overdue bucket
  items: AgendaItem[];
}

function startOfUTCDay(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Stable tie-break when two items share an instant: events anchor the slot,
// then the things that "happen to you", then the things you sent out.
const KIND_ORDER: Record<AgendaKind, number> = {
  event: 0,
  reminder: 1,
  followup: 2,
  snoozed: 3,
  send: 4,
};

function firstName(c?: { name?: string; email?: string }): string {
  if (!c) return "them";
  const n = (c.name ?? "").trim();
  if (n) return n.split(/\s+/)[0];
  return (c.email ?? "them").split("@")[0];
}

// Pick the latest-dated message in each thread that carries the field, so a
// multi-message conversation yields a single agenda row.
function latestPerThread(emails: Email[], has: (e: Email) => boolean): Email[] {
  const byThread = new Map<string, Email>();
  for (const e of emails) {
    if (e.trashed) continue;
    if (!has(e)) continue;
    const cur = byThread.get(e.threadId);
    if (!cur || Date.parse(e.date) > Date.parse(cur.date)) byThread.set(e.threadId, e);
  }
  return [...byThread.values()];
}

function eventSubtitle(e: CalendarEvent): string {
  if (e.tentative) return "Tentative hold";
  if (e.location) return e.location;
  if (e.conference) return "Video call";
  if (e.attendees && e.attendees.length) {
    return e.attendees.length === 1
      ? `with ${e.attendees[0]}`
      : `${e.attendees.length} attendees`;
  }
  return "Event";
}

// Build the full, sorted agenda from every time-anchored source.
export function buildAgenda(input: AgendaInput, now: number): AgendaItem[] {
  const { emails, events, outbox } = input;
  const items: AgendaItem[] = [];

  // --- Calendar events still relevant (haven't ended) ---
  for (const e of events) {
    const startTs = Date.parse(e.start);
    if (isNaN(startTs)) continue;
    // An all-day event stays relevant through the end of its day.
    const endTs = e.allDay ? startOfUTCDay(startTs) + DAY : Date.parse(e.end || e.start);
    if (!isNaN(endTs) && endTs < now) continue; // already over
    items.push({
      id: `event:${e.id}`,
      kind: "event",
      at: e.start,
      endAt: e.allDay ? undefined : e.end,
      ts: startTs,
      title: e.title || "(untitled event)",
      subtitle: eventSubtitle(e),
      icon: e.tentative ? "📌" : "📅",
      refId: e.id,
      refKind: "event",
      overdue: false, // a meeting isn't "overdue"; it just is when it is
      allDay: e.allDay,
    });
  }

  // --- Reminders / follow-ups (one row per thread) ---
  for (const e of latestPerThread(emails, (m) => !!m.reminderAt)) {
    // A "remind if no reply" that already got its reply is resolved — drop it.
    if (e.remindIfNoReply && hasReplyAfter(emails, e.threadId, e.reminderAt!)) continue;
    const ts = Date.parse(e.reminderAt!);
    const followup = !!e.remindIfNoReply;
    items.push({
      id: `${followup ? "followup" : "reminder"}:${e.threadId}`,
      kind: followup ? "followup" : "reminder",
      at: e.reminderAt!,
      ts,
      title: e.subject || "(no subject)",
      subtitle: followup
        ? `Follow up with ${firstName(e.outbound ? e.to[0] : e.from)} if no reply`
        : "Reminder",
      icon: followup ? "↩︎" : "🔔",
      refId: e.id,
      refKind: "thread",
      overdue: ts <= now,
    });
  }

  // --- Snoozed conversations returning to the inbox ---
  for (const e of latestPerThread(emails, (m) => !!m.snoozedUntil)) {
    const ts = Date.parse(e.snoozedUntil!);
    items.push({
      id: `snoozed:${e.threadId}`,
      kind: "snoozed",
      at: e.snoozedUntil!,
      ts,
      title: e.subject || "(no subject)",
      subtitle: "Snoozed — returns to the inbox",
      icon: "💤",
      refId: e.id,
      refKind: "thread",
      overdue: ts <= now,
    });
  }

  // --- Scheduled "send later" messages still queued ---
  for (const item of outbox) {
    if (item.status !== "scheduled") continue;
    const ts = Date.parse(item.sendAt);
    items.push({
      id: `send:${item.id}`,
      kind: "send",
      at: item.sendAt,
      ts,
      title: item.draft.subject || "(no subject)",
      subtitle: `Scheduled send → ${item.draft.to || "—"}`,
      icon: "🛫",
      refId: item.id,
      refKind: "outbox",
      overdue: ts <= now,
    });
  }

  return items.sort((a, b) => a.ts - b.ts || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

// Relative day header: "Today" / "Tomorrow" / "Yesterday" / "Mon, Jun 8".
export function relativeDayLabel(dayStart: number, now: number): string {
  const diff = Math.round((dayStart - startOfUTCDay(now)) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return dayKey(new Date(dayStart).toISOString());
}

// Group the agenda into day buckets. Any past-due task-like item (a reminder,
// follow-up, snooze return or send whose time has slipped past `now`) collapses
// into a single leading "Overdue" bucket — even one from earlier today —
// instead of being buried under its day, so nothing late gets lost. Events are
// never "overdue"; they always sit on their own day.
export function groupAgendaByDay(items: AgendaItem[], now: number): AgendaDay[] {
  const todayStart = startOfUTCDay(now);
  const overdue: AgendaItem[] = [];
  const byDay = new Map<number, AgendaItem[]>();
  for (const it of items) {
    if (it.overdue) {
      overdue.push(it);
      continue;
    }
    const ds = startOfUTCDay(it.ts);
    if (!byDay.has(ds)) byDay.set(ds, []);
    byDay.get(ds)!.push(it);
  }
  const days: AgendaDay[] = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ds, its]) => ({
      key: dayKey(new Date(ds).toISOString()),
      label: relativeDayLabel(ds, now),
      dayStart: ds,
      items: its.sort((a, b) => a.ts - b.ts || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]),
    }));
  if (overdue.length) {
    days.unshift({
      key: "overdue",
      label: "Overdue",
      dayStart: todayStart - DAY,
      overdue: true,
      items: overdue.sort((a, b) => a.ts - b.ts),
    });
  }
  return days;
}

export interface AgendaSummary {
  total: number;
  overdue: number;
  events: number;
  reminders: number; // reminders + follow-ups
  snoozed: number;
  sends: number;
  todayCount: number; // anchored today or earlier (the actionable-now count)
  next: AgendaItem | null; // the soonest item still ahead of `now`
}

export function agendaSummary(items: AgendaItem[], now: number): AgendaSummary {
  const todayEnd = startOfUTCDay(now) + DAY;
  let events = 0,
    reminders = 0,
    snoozed = 0,
    sends = 0,
    overdue = 0,
    todayCount = 0;
  let next: AgendaItem | null = null;
  for (const it of items) {
    if (it.kind === "event") events++;
    else if (it.kind === "reminder" || it.kind === "followup") reminders++;
    else if (it.kind === "snoozed") snoozed++;
    else if (it.kind === "send") sends++;
    if (it.overdue) overdue++;
    if (it.ts < todayEnd) todayCount++;
    if (it.ts >= now && (!next || it.ts < next.ts)) next = it;
  }
  return { total: items.length, overdue, events, reminders, snoozed, sends, todayCount, next };
}

// The sidebar badge: how many agenda items land today or are already overdue.
export function agendaTodayCount(items: AgendaItem[], now: number): number {
  const todayEnd = startOfUTCDay(now) + DAY;
  return items.reduce((n, it) => (it.ts < todayEnd ? n + 1 : n), 0);
}

// The time column for a row: a range for an event, a clock time otherwise.
export function agendaTimeText(item: AgendaItem): string {
  if (item.allDay) return "All day";
  if (item.endAt) return formatTimeRange({ start: item.at, end: item.endAt });
  return formatClockTime(item.at);
}
