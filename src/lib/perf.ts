// Performance instrumentation + a reproducible mailbox benchmark.
//
// Superhuman's brand promise is "every interaction under 100ms". SuperMail
// makes the same promise *measurable* in-product:
//
//  - `recordLatency` / `latencySnapshot`: every keyboard triage action is timed
//    from keydown to the next committed frame (wired in App.tsx) into a small
//    ring buffer; the Stats view shows live p50 / p95 / max.
//  - `synthesizeMailbox` + `runPipelineBenchmark`: a deterministic 10,000-email
//    mailbox pushed through the real production pipeline (thread grouping →
//    query search → priority ranking), timed. One click in Stats → hard
//    numbers on this machine, not marketing copy.
//
// Everything here is pure & dependency-injected enough to unit test; only the
// default clock touches `performance`.

import type { Contact, Email, SplitCategory } from "../types";
import { groupThreads } from "./threads";
import { searchQuery } from "./search";
import { focusThreads } from "./priority";

// ---- Interaction latency (input → next painted frame) ----

export interface LatencyStats {
  count: number;
  p50: number;
  p95: number;
  max: number;
}

export const LATENCY_CAP = 400;

const samples: number[] = [];

// Nearest-rank percentile on an unsorted sample set (copies before sorting).
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
}

export function recordLatency(ms: number, store: number[] = samples): void {
  if (!isFinite(ms) || ms < 0) return;
  store.push(ms);
  if (store.length > LATENCY_CAP) store.splice(0, store.length - LATENCY_CAP);
}

export function latencySnapshot(store: number[] = samples): LatencyStats {
  return {
    count: store.length,
    p50: percentile(store, 50),
    p95: percentile(store, 95),
    max: store.length ? Math.max(...store) : 0,
  };
}

export function clearLatency(store: number[] = samples): void {
  store.length = 0;
}

// ---- Deterministic synthetic mailbox ----

const FIRST = ["Dana", "Marcus", "Priya", "Jordan", "Elena", "Sam", "Noah", "Maya", "Leo", "Ava"];
const LAST = ["Kim", "Reyes", "Patel", "Lund", "Rossi", "Chen", "Novak", "Diaz", "Wolf", "Sato"];
const DOMAINS = ["acme.io", "northwind.dev", "globex.com", "initech.co", "umbrella.org"];
const TOPICS = [
  "Q3 roadmap review",
  "Contract renewal",
  "Design feedback",
  "Pilot kickoff",
  "Invoice 2041",
  "Weekly metrics",
  "Offsite planning",
  "API migration",
  "Security audit",
  "Press briefing",
];
const CATEGORIES: SplitCategory[] = ["important", "other", "news", "social"];

// Tiny deterministic PRNG (mulberry32) so every benchmark run — and every
// test — sees the identical mailbox.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BENCH_EPOCH = Date.UTC(2026, 0, 15, 12, 0, 0); // fixed "now" for generated dates

export function synthesizeMailbox(n: number, seed = 42): Email[] {
  const rand = mulberry32(seed);
  const emails: Email[] = [];
  const threadCount = Math.max(1, Math.floor(n / 3));
  for (let i = 0; i < n; i++) {
    const senderIdx = Math.floor(rand() * 100);
    const from: Contact = {
      name: `${FIRST[senderIdx % FIRST.length]} ${LAST[Math.floor(senderIdx / 10) % LAST.length]}`,
      email: `sender${senderIdx}@${DOMAINS[senderIdx % DOMAINS.length]}`,
    };
    const topic = TOPICS[i % TOPICS.length];
    const ageMs = Math.floor(rand() * 90) * 86_400_000 + Math.floor(rand() * 86_400_000);
    emails.push({
      id: `bench-${i}`,
      threadId: `bench-t-${i % threadCount}`,
      from,
      to: [{ name: "You", email: "you@supermail.dev" }],
      subject: `${topic} #${i % threadCount}`,
      preview: `Quick update on ${topic.toLowerCase()} — see details inside.`,
      body: `Hi,\n\nQuick update on ${topic.toLowerCase()}. Could you take a look by Friday?\n\n— ${from.name}`,
      date: new Date(BENCH_EPOCH - ageMs).toISOString(),
      read: rand() < 0.6,
      starred: rand() < 0.08,
      archived: rand() < 0.25,
      category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)],
      labels: rand() < 0.2 ? ["Clients"] : [],
      attachments: rand() < 0.12 ? [`deck-${i}.pdf`] : [],
      snoozedUntil: null,
      reminderAt: null,
      openedByRecipientAt: null,
      outbound: false,
    });
  }
  return emails;
}

// ---- Pipeline benchmark ----

export interface BenchResult {
  n: number; // emails pushed through
  threads: number; // conversations produced
  groupMs: number; // thread grouping
  searchMs: number; // operator query over every message
  rankMs: number; // Focus priority ranking over every thread
  totalMs: number;
  opsPerSec: number; // full pipeline passes per second
}

type Clock = () => number;

function defaultClock(): Clock {
  return typeof performance !== "undefined" ? () => performance.now() : () => Date.now();
}

// Push a synthetic n-email mailbox through the real production pipeline and
// time each stage. `rounds` repeats (best-of) smooth out scheduler noise.
export function runPipelineBenchmark(n = 10_000, rounds = 3, clock: Clock = defaultClock()): BenchResult {
  const emails = synthesizeMailbox(n);
  const vips = new Set<string>(["sender3@initech.co"]);
  let groupMs = Infinity;
  let searchMs = Infinity;
  let rankMs = Infinity;
  let threads = 0;

  for (let r = 0; r < rounds; r++) {
    const t0 = clock();
    const grouped = groupThreads(emails);
    const t1 = clock();
    searchQuery(emails, "from:sender3 is:unread", BENCH_EPOCH);
    const t2 = clock();
    focusThreads(grouped, vips, BENCH_EPOCH);
    const t3 = clock();
    threads = grouped.length;
    groupMs = Math.min(groupMs, t1 - t0);
    searchMs = Math.min(searchMs, t2 - t1);
    rankMs = Math.min(rankMs, t3 - t2);
  }

  const totalMs = groupMs + searchMs + rankMs;
  return {
    n,
    threads,
    groupMs,
    searchMs,
    rankMs,
    totalMs,
    opsPerSec: totalMs > 0 ? 1000 / totalMs : Infinity,
  };
}

export function formatMs(ms: number): string {
  if (!isFinite(ms)) return "—";
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${Math.round(ms)}ms`;
}
