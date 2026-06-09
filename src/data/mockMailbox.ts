import type { Email, SplitCategory } from "../types";

// Deterministic timestamps (relative to a fixed "now" seed) keep dev/test stable.
const NOW = new Date("2026-06-06T09:00:00.000Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const ME = { name: "Federico Donatone", email: "federicodonatone1@gmail.com" };

interface Person {
  name: string;
  email: string;
  company?: string;
  role?: string;
}

interface MsgSpec {
  id: string;
  thread: string;
  from: Person;
  to?: Person[];
  subject: string;
  preview: string;
  body: string;
  category: SplitCategory;
  h: number; // hours ago
  opts?: Partial<Email>;
}

// Which connected account each demo thread lives in (multi-account / unified
// inbox). Work = colleagues, clients, repo + calendar; Personal = newsletters,
// receipts, social. Anything unmapped falls back to the work (primary) account.
const ACCOUNT_BY_THREAD: Record<string, string> = {
  t1: "work", t3: "work", t5: "work", t7: "work", t8: "work", t9: "work", t11: "work", t13: "work",
  t2: "personal", t4: "personal", t6: "personal", t10: "personal", t12: "personal",
};

function build(spec: MsgSpec): Email {
  const outbound = spec.from.email === ME.email;
  return {
    id: spec.id,
    threadId: spec.thread,
    accountId: ACCOUNT_BY_THREAD[spec.thread] ?? "work",
    from: spec.from,
    to: spec.to ?? [ME],
    subject: spec.subject,
    preview: spec.preview,
    body: spec.body,
    date: hoursAgo(spec.h),
    read: false,
    starred: false,
    archived: false,
    category: spec.category,
    labels: [],
    attachments: [],
    snoozedUntil: null,
    reminderAt: null,
    openedByRecipientAt: null,
    outbound,
    ...spec.opts,
  };
}

// People in the demo mailbox.
const dana: Person = { name: "Dana Whitfield", email: "dana@acme.io", company: "Acme", role: "VP Product" };
const marcus: Person = { name: "Marcus Lee", email: "marcus@northwind.dev", company: "Northwind", role: "Eng Lead" };
const priya: Person = { name: "Priya Nair", email: "priya@designco.com", company: "DesignCo", role: "Head of Design" };
const sam: Person = { name: "Sam Okoye", email: "sam@founderfund.vc", company: "FounderFund", role: "Partner" };
const renee: Person = { name: "Renée Caron", email: "renee@bigcorp.com", company: "BigCorp", role: "Procurement" };
const jordan: Person = { name: "Jordan Avery", email: "jordan@brightpath.co", company: "BrightPath", role: "COO" };

const SPECS: MsgSpec[] = [
  // ---- Thread t1: Dana / Q3 roadmap (3 messages, latest unread + starred) ----
  {
    id: "m1", thread: "t1", from: dana, subject: "Q3 roadmap — draft for sign-off",
    preview: "Sharing the draft ahead of Monday. Two open questions on the analytics milestone…",
    body: "Hi Federico,\n\nSharing the Q3 roadmap draft ahead of Monday. Two open questions on the analytics milestone — flagged inline. Want to lock scope this week.\n\nBest,\nDana",
    category: "important", h: 120, opts: { read: true, attachments: ["Q3-roadmap-draft.pdf", "analytics-milestone.xlsx"] },
  },
  {
    id: "m2", thread: "t1", from: ME, to: [dana], subject: "Re: Q3 roadmap — draft for sign-off",
    preview: "Thanks Dana — looks solid. I'd pull the dashboard work forward a sprint…",
    body: "Thanks Dana — looks solid. I'd pull the dashboard work forward a sprint so analytics lands before the board review. Otherwise +1 to scope.\n\nFederico\n\nOn Mon, Jun 1, 2025 at 9:00 AM Dana Whitfield <dana@acme.io> wrote:\n> Hi Federico,\n>\n> Sharing the Q3 roadmap draft ahead of Monday. Two open questions on the analytics milestone — flagged inline. Want to lock scope this week.\n>\n> Best,\n> Dana",
    category: "important", h: 96, opts: { read: true, openedByRecipientAt: hoursAgo(90) },
  },
  {
    id: "m3", thread: "t1", from: dana, subject: "Re: Q3 roadmap sign-off",
    preview: "Looks great — one note on the analytics milestone before we ship…",
    body: "Looks great — one note on the analytics milestone before we ship. Can we pull the dashboard work forward a sprint? Happy to jump on a quick call to finalize.\n\nBest,\nDana\n\nOn Mon, Jun 1, 2025 at 11:30 AM Federico Donatone <federico.donatone@growthcab.com> wrote:\n> Thanks Dana — looks solid. I'd pull the dashboard work forward a sprint so analytics lands before the board review. Otherwise +1 to scope.\n>\n> Federico",
    category: "important", h: 5, opts: { starred: true, cc: [priya] },
  },

  // ---- Thread t2: Stripe receipt (single) ----
  {
    id: "m4", thread: "t2", from: { name: "Stripe", email: "receipts@stripe.com", company: "Stripe" },
    subject: "Your receipt from SuperMail Inc.",
    preview: "Payment of $49.00 was successful. View your invoice…",
    body: "Thanks for your payment.\n\nAmount: $49.00\nInvoice: INV-20451\n\nView in dashboard.",
    category: "other", h: 50,
  },

  // ---- Thread t3: Marcus / OAuth pairing (single, needs reply) ----
  {
    id: "m5", thread: "t3", from: marcus, subject: "Pairing on the OAuth flow tomorrow?",
    preview: "I blocked 2pm. Want to walk through the token refresh edge cases…",
    body: "Hey — I blocked 2pm tomorrow. Want to walk through the token refresh edge cases together? I think there's a race in the callback handler.\n\nMarcus",
    category: "important", h: 7,
  },

  // ---- Thread t4: Hacker News digest (single, news) ----
  {
    id: "m6", thread: "t4", from: { name: "Hacker News Daily", email: "digest@hackernewsletter.com" },
    subject: "Top 10 stories: AI agents, Rust, and email clients",
    preview: "This week's best: building a keyboard-first inbox, the case for…",
    body: "Your weekly digest of the best stories.\n\n1. Building a keyboard-first inbox\n2. The case for local-first apps\n3. ...\n\nUnsubscribe any time.",
    category: "news", h: 30,
    opts: {
      listUnsubscribe:
        "<https://hackernewsletter.com/unsubscribe?u=8421>, <mailto:unsubscribe@hackernewsletter.com?subject=unsubscribe>",
      listUnsubscribePost: true,
    },
  },

  // ---- Thread t5: Priya / mockups (single, attachment) ----
  {
    id: "m7", thread: "t5", from: priya, subject: "Mockups for the split inbox",
    preview: "Attached the dense list variant. Curious what you think about the…",
    body: "Attached the dense list variant. Curious what you think about the unread weighting and the hover affordances.\n\nPriya",
    category: "important", h: 9, opts: { attachments: ["split-inbox-v3.fig", "dense-list-preview.png"] },
  },

  // ---- Thread t6: LinkedIn (single, social) ----
  {
    id: "m8", thread: "t6", from: { name: "LinkedIn", email: "notifications@linkedin.com" },
    subject: "You appeared in 9 searches this week",
    preview: "See who's looking at your profile…",
    body: "You appeared in 9 searches this week. Upgrade to see who.\n\nUnsubscribe from these emails.",
    category: "social", h: 14,
    opts: { listUnsubscribe: "<https://www.linkedin.com/comm/unsubscribe?token=abc123>" },
  },

  // ---- Thread t7: Sam / intro (2 messages, you replied) ----
  {
    id: "m9", thread: "t7", from: sam, subject: "Intro to a portfolio CTO",
    preview: "Loved the demo. I'd like to connect you with the CTO at one of our…",
    body: "Loved the demo. I'd like to connect you with the CTO at one of our portfolio companies — they're rethinking internal tooling. Free Thursday?\n\nSam",
    category: "important", h: 30, opts: { read: true, starred: true, attachments: ["portfolio-overview.pptx"] },
  },
  {
    id: "m10", thread: "t7", from: ME, to: [sam], subject: "Re: Intro to a portfolio CTO",
    preview: "Thursday works great — happy to make the intro. Sending a couple of times…",
    body: "Thursday works great — happy to make the intro. Sending a couple of times that work on my end; feel free to grab whatever's easiest.\n\nFederico\n\nOn Thu, May 29, 2025 at 4:00 PM Sam Okoye <sam@founderfund.vc> wrote:\n> Loved the demo. I'd like to connect you with the CTO at one of our portfolio companies — they're rethinking internal tooling. Free Thursday?\n>\n> Sam",
    category: "important", h: 28, opts: { read: true, openedByRecipientAt: hoursAgo(26) },
  },

  // ---- Thread t8: GitHub CI (single) ----
  {
    id: "m11", thread: "t8", from: { name: "GitHub", email: "noreply@github.com", company: "GitHub" },
    subject: "[supermail] CI passed on main",
    preview: "Build #482 succeeded. 0 failing checks…",
    body: "Build #482 succeeded on main. All checks green.",
    category: "other", h: 12,
  },

  // ---- Thread t9: Calendar (single) ----
  {
    id: "m12", thread: "t9", from: { name: "Calendar", email: "calendar@google.com" },
    subject: "Reminder: 1:1 with Dana at 3:00 PM",
    preview: "Starts in 1 hour. Join with Google Meet…",
    body: "1:1 with Dana starts in 1 hour. Agenda: roadmap, hiring, Q3 metrics.",
    category: "other", h: 2,
  },

  // ---- Thread t10: Twitter/X (single, social) ----
  {
    id: "m13", thread: "t10", from: { name: "Twitter / X", email: "info@x.com" },
    subject: "3 people you may know are on X",
    preview: "Follow back and see what they're posting…",
    body: "3 people you may know just joined.\n\nUnsubscribe to stop these notifications.",
    category: "social", h: 20,
    opts: { listUnsubscribe: "<mailto:unsubscribe@x.com?subject=unsub>" },
  },

  // ---- Thread t11: Renée / contract (2 messages, both inbound, needs reply) ----
  {
    id: "m14", thread: "t11", from: renee, subject: "Contract redlines — MSA v3",
    preview: "Legal sent back the MSA with a few changes. Flagging the indemnity…",
    body: "Legal sent back the MSA with a few changes. Flagging the indemnity clause in section 7 — can your team review?\n\nRenée",
    category: "important", h: 48, opts: { read: true, attachments: ["MSA-v3-redlines.pdf", "indemnity-summary.docx"] },
  },
  {
    id: "m15", thread: "t11", from: renee, subject: "Re: Contract redlines — need by Friday",
    preview: "Any update on the indemnity language? We'd love to countersign by Friday…",
    body: "Any update on the indemnity language? We'd love to countersign by Friday if your team is comfortable.\n\nRenée",
    category: "important", h: 4,
  },

  // ---- Thread t12: Product Hunt (single, news) ----
  {
    id: "m16", thread: "t12", from: { name: "Product Hunt", email: "hello@producthunt.com" },
    subject: "Today's top products in Productivity",
    preview: "The 5 launches everyone is talking about…",
    body: "Today's top products in Productivity.\n\nManage your subscription or unsubscribe.",
    category: "news", h: 22,
    opts: {
      listUnsubscribe:
        "<https://www.producthunt.com/unsubscribe/digest>, <mailto:unsub@producthunt.com>",
      listUnsubscribePost: true,
    },
  },

  // ---- Thread t13: outbound to a prospect, awaiting reply (read-status + follow-up demo) ----
  {
    id: "m17", thread: "t13", from: ME, to: [jordan], subject: "Re: SuperMail pilot — next steps",
    preview: "Great chatting today. Recapping next steps and a couple of dates for the pilot…",
    body: "Hi Jordan,\n\nGreat chatting today. Recapping next steps: we'll spin up a sandbox for your team and aim for a two-week pilot. A couple of dates that work on my end below — let me know what's easiest.\n\nBest,\nFederico",
    category: "other", h: 40,
    opts: {
      read: true,
      // Seen by the recipient but no reply yet — drives both the read-status
      // feed ("opened, no reply") and the follow-up safety net below.
      openedByRecipientAt: hoursAgo(38),
      // A follow-up safety net that's already due so the Reminders view has content.
      reminderAt: hoursAgo(1),
      remindIfNoReply: true,
    },
  },
];

export const SEED_EMAILS: Email[] = SPECS.map(build);

export function freshMockEmails(): Email[] {
  // Return deep clones so the in-memory store can mutate freely.
  return SEED_EMAILS.map((e) => ({
    ...e,
    to: e.to.map((t) => ({ ...t })),
    labels: [...e.labels],
    attachments: [...e.attachments],
  }));
}
