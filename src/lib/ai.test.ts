import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  summarize,
  summarizeThread,
  instantReplies,
  writeWithAi,
  suggestLabels,
  shouldSuggestArchive,
  autoArchiveCandidates,
  autoOrganizePlan,
  organizeSummary,
  followUpDraft,
  askInbox,
  inboxDigest,
  formatDigest,
  loadAiConfig,
  rephrase,
  REWRITE_MODES,
} from "./ai";

const NOW = new Date("2026-06-06T09:00:00.000Z").getTime();

describe("AI summarize / replies / write", () => {
  it("summarize returns a non-empty extractive summary", () => {
    const e = email({ body: "The roadmap looks great. We should pull the analytics milestone forward. Can we ship sooner? Happy to help." });
    const s = summarize(e);
    expect(s.startsWith("Summary:")).toBe(true);
    expect(s.length).toBeGreaterThan(10);
  });

  it("instantReplies adapts to meetings and questions", () => {
    const meeting = instantReplies(email({ from: { name: "Sam Lee", email: "s@x.com" }, body: "Can we find time to sync this week?" }));
    expect(meeting.some((r) => /30 minutes|calendar/i.test(r))).toBe(true);
    const q = instantReplies(email({ body: "What's the status on the contract?" }));
    expect(q.some((r) => /look into it|get back/i.test(r))).toBe(true);
    expect(instantReplies(email()).length).toBeLessThanOrEqual(3);
  });

  it("instantReplies honors the detected meeting length and ignores bare mentions", () => {
    // A quick-call ask proposes a 15-minute slot.
    const quick = instantReplies(email({ body: "Fancy a quick call tomorrow?" }));
    expect(quick.some((r) => /15 minutes/.test(r))).toBe(true);
    // A *mention* of a past call must NOT produce a meeting-style suggestion.
    const mention = instantReplies(email({ body: "Thanks for the call earlier — really helpful!" }));
    expect(mention.some((r) => /could we find .* minutes|calendar invite/i.test(r))).toBe(false);
  });

  it("writeWithAi builds a subject + greeting from intent and recipient", () => {
    const { subject, body } = writeWithAi("ask Dana for the Q3 numbers", "dana@acme.io");
    expect(subject.toLowerCase()).toContain("ask dana");
    expect(body).toContain("Hi Dana,");
    expect(body).toContain("Q3 numbers");
  });
});

describe("AI auto-labels / auto-archive / follow-up", () => {
  it("suggestLabels classifies finance and recruiting", () => {
    expect(suggestLabels(email({ subject: "Your invoice", body: "payment received" }))).toContain("Finance");
    expect(suggestLabels(email({ subject: "Interview with a candidate", body: "resume attached" }))).toContain("Recruiting");
  });

  it("shouldSuggestArchive flags low-signal bulk but not directed mail", () => {
    expect(shouldSuggestArchive(email({ category: "news", from: { name: "Digest", email: "digest@x.com" }, body: "weekly roundup" }))).toBe(true);
    expect(shouldSuggestArchive(email({ category: "news", body: "Can you reply by Friday?" }))).toBe(false); // directed
    expect(shouldSuggestArchive(email({ starred: true, category: "news", body: "x" }))).toBe(false); // starred
  });

  it("autoArchiveCandidates excludes already archived", () => {
    const emails = [
      email({ id: "a", category: "social", from: { name: "X", email: "notifications@x.com" }, body: "fyi" }),
      email({ id: "b", category: "social", archived: true, body: "fyi" }),
    ];
    expect(autoArchiveCandidates(emails).map((e) => e.id)).toEqual(["a"]);
  });

  it("followUpDraft references the subject", () => {
    expect(followUpDraft(email({ subject: "Q3 sign-off" }))).toContain("Q3 sign-off");
  });
});

describe("autoOrganizePlan", () => {
  it("plans only labels a message doesn't already have, skipping archived/trashed", () => {
    const emails = [
      email({ id: "fin", subject: "Your invoice", body: "payment received" }), // Finance
      email({ id: "rec", subject: "Interview", body: "candidate resume attached" }), // Recruiting
      email({ id: "already", subject: "Your invoice", body: "payment", labels: ["Finance"] }), // no change
      email({ id: "arch", subject: "Your invoice", body: "payment", archived: true }), // skipped
    ];
    const plan = autoOrganizePlan(emails);
    const ids = plan.changes.map((c) => c.id).sort();
    expect(ids).toEqual(["fin", "rec"]);
    expect(plan.totalLabels).toBe(2);
    expect(plan.byLabel.Finance).toBe(1);
    expect(plan.byLabel.Recruiting).toBe(1);
  });

  it("organizeSummary renders a sorted count string", () => {
    const emails = [
      email({ id: "a", subject: "invoice", body: "payment" }),
      email({ id: "b", subject: "invoice", body: "billing" }),
      email({ id: "c", subject: "interview", body: "candidate" }),
    ];
    const s = organizeSummary(autoOrganizePlan(emails));
    expect(s).toMatch(/Finance ×2/);
    expect(s).toMatch(/Recruiting ×1/);
  });

  it("returns an empty plan when nothing matches", () => {
    const plan = autoOrganizePlan([email({ subject: "lunch?", body: "wanna grab food" })]);
    expect(plan.totalLabels).toBe(0);
    expect(plan.changes).toHaveLength(0);
  });
});

describe("askInbox Q&A router", () => {
  const emails = [
    email({ id: "u1", read: false, subject: "Unread one", from: { name: "Dana", email: "dana@acme.io" } }),
    email({ id: "r1", read: false, outbound: false, body: "Can you review by Friday?", subject: "Contract" }),
    email({ id: "f1", read: true, attachments: ["spec.pdf"], from: { name: "Priya", email: "priya@x.com" } }),
    email({ id: "s1", starred: true, subject: "Important deal" }),
  ];

  it("answers unread, needs-reply, attachments, starred, by-sender", () => {
    expect(askInbox(emails, "what's unread?", NOW).text).toMatch(/unread/i);
    expect(askInbox(emails, "what needs a reply?", NOW).sources).toContain("r1");
    expect(askInbox(emails, "anything with attachments?", NOW).text).toMatch(/spec\.pdf/);
    expect(askInbox(emails, "what's starred?", NOW).text).toMatch(/Important deal/);
    const fromDana = askInbox(emails, "messages from Dana", NOW);
    expect(fromDana.sources!.length).toBeGreaterThan(0);
  });

  it("falls back gracefully and always marks answers local", () => {
    const a = askInbox(emails, "zzz nonexistent topic qwerty", NOW);
    expect(a.local).toBe(true);
    expect(a.text.length).toBeGreaterThan(0);
  });

  it("answers 'what do I need to do?' by extracting action items", () => {
    const a = askInbox(emails, "what are my action items?", NOW);
    expect(a.local).toBe(true);
    expect(a.text).toMatch(/action item/i);
    expect(a.sources).toContain("r1"); // "Can you review by Friday?" → a deadline ask
  });

  it("reports a clean inbox when there are no action items", () => {
    const none = [email({ id: "z", outbound: false, body: "Thanks so much, all looks great!" })];
    expect(askInbox(none, "anything on my to-do list?", NOW).text).toMatch(/couldn't find|✨/i);
  });

  it("answers 'what did I promise?' by extracting your commitments", () => {
    const inbox = [
      email({ id: "p1", outbound: true, to: [{ name: "Jordan", email: "j@x.io" }], body: "I'll send the deck by Friday." }),
      email({ id: "i1", outbound: false, body: "Can you review by Friday?" }), // an ask, not a promise
    ];
    const a = askInbox(inbox, "what did I promise?", NOW);
    expect(a.local).toBe(true);
    expect(a.text).toMatch(/commitment/i);
    expect(a.sources).toContain("p1");
    expect(a.sources).not.toContain("i1"); // an inbound ask is not your commitment
    // empty case
    expect(askInbox([email({ id: "x", outbound: false })], "what are my commitments?", NOW).text).toMatch(/couldn't find|✨/i);
  });

  it("answers 'what's urgent / needs my attention?' via the Focus priority engine", () => {
    const inbox = [
      email({ id: "hot", threadId: "th", read: false, outbound: false, subject: "Contract review", body: "Can you review by Friday?" }),
      email({ id: "calm", threadId: "tn", read: true, outbound: false, category: "social", subject: "Weekend pics", body: "great photos, no action needed" }),
    ];
    const a = askInbox(inbox, "what needs my attention?", NOW);
    expect(a.local).toBe(true);
    expect(a.text).toMatch(/need your attention/i);
    expect(a.sources).toContain("hot"); // unread + a direct ask → high priority
    // "urgent" / "important" / "priority" route to the same engine, not starred.
    expect(askInbox(inbox, "what's urgent right now?", NOW).text).toMatch(/attention/i);
    expect(askInbox(inbox, "what's most important?", NOW).text).toMatch(/attention/i);
  });

  it("keeps 'what's starred?' a literal starred list (narrowed trigger)", () => {
    // Regression guard: narrowing the starred branch to starred|flagged must not
    // reroute the literal question to the attention engine.
    expect(askInbox(emails, "what's starred?", NOW).text).toMatch(/Important deal/);
  });

  it("reports a calm inbox when nothing crosses the attention threshold", () => {
    const calm = [email({ id: "n", read: true, outbound: false, category: "news", subject: "Newsletter", body: "weekly digest" })];
    expect(askInbox(calm, "anything urgent?", NOW).text).toMatch(/nothing|calm|✨/i);
  });

  it("answers reminder / follow-up questions, splitting due vs upcoming", () => {
    const withRems = [
      email({ id: "rd", subject: "Chase invoice", reminderAt: new Date(NOW - 3600_000).toISOString(), remindIfNoReply: true }),
      email({ id: "ru", subject: "Ping Sam", reminderAt: new Date(NOW + 3600_000).toISOString() }),
      email({ id: "plain", subject: "no reminder" }),
    ];
    const a = askInbox(withRems, "what follow-ups do I have?", NOW);
    expect(a.text).toMatch(/2 reminders/);
    expect(a.text).toMatch(/due now/);
    expect(a.text).toMatch(/Chase invoice/);
    expect(a.text).toMatch(/if no reply/);
    expect(a.text).toMatch(/upcoming/);
    expect(a.sources).toEqual(expect.arrayContaining(["rd", "ru"]));
    expect(a.sources).not.toContain("plain");
  });

  it("reports when there are no reminders set", () => {
    expect(askInbox(emails, "any reminders?", NOW).text).toMatch(/No reminders/i);
  });

  it("answers 'what am I waiting on?' from threads where my message is the latest", () => {
    const waiting = [
      email({ id: "in", threadId: "tw", outbound: false, date: new Date(NOW - 7200_000).toISOString() }),
      email({ id: "mine", threadId: "tw", outbound: true, archived: false, subject: "Sent the proposal", to: [{ name: "Sam", email: "sam@x.com" }], date: new Date(NOW - 3600_000).toISOString() }),
    ];
    const a = askInbox(waiting, "what am I waiting on?", NOW);
    expect(a.text).toMatch(/awaiting a reply/i);
    expect(a.text).toMatch(/Sam/);
    expect(a.sources).toContain("mine");
  });

  it("distinguishes 'waiting on me' (needs reply) from 'waiting on them'", () => {
    // "waiting on me" must route to needs-reply, not the awaiting-others branch.
    const needs = [email({ id: "q", read: false, outbound: false, body: "Can you confirm?", subject: "Confirm?" })];
    expect(askInbox(needs, "what's waiting on me?", NOW).sources).toContain("q");
  });

  it("answers 'any scheduling requests?' with detected meeting asks", () => {
    const sched = [
      email({ id: "m1", threadId: "ta", subject: "Coffee?", body: "Are you free Thursday for a quick call?" }),
      email({ id: "m2", threadId: "tb", subject: "Deck", body: "Here's the deck, no rush." }),
      email({ id: "m3", threadId: "tc", subject: "Sync", body: "Can we schedule a call next week?" }),
      email({ id: "m4", threadId: "td", subject: "My ask", body: "Are you free to meet?", outbound: true }),
    ];
    const a = askInbox(sched, "any scheduling requests?", NOW);
    expect(a.text).toMatch(/2 scheduling requests/);
    expect(a.sources).toEqual(expect.arrayContaining(["m1", "m3"]));
    expect(a.sources).not.toContain("m2"); // not a request
    expect(a.sources).not.toContain("m4"); // our own outbound
  });

  it("reports cleanly when nobody is asking to meet", () => {
    const none = [email({ id: "x", subject: "FYI", body: "Just sharing an update." })];
    expect(askInbox(none, "who wants to meet?", NOW).text).toMatch(/No open scheduling requests/i);
  });
});

describe("AI rewrite / tone-shift", () => {
  it("formal expands contractions and lifts casual words", () => {
    const out = rephrase("hey, I'm gonna send it asap. thanks!", "formal");
    expect(out).toContain("I am");
    expect(out).toContain("going to");
    expect(out).toContain("as soon as possible");
    expect(out).toMatch(/Hello/);
    expect(out).not.toMatch(/\bgonna\b/);
  });

  it("casual adds contractions and warms greetings", () => {
    const out = rephrase("Hello. I am going to review it. Thank you.", "casual");
    expect(out).toContain("I'm");
    expect(out).toMatch(/^Hi\./);
    expect(out).toContain("Thanks");
  });

  it("shorter trims filler and caps at two sentences per paragraph", () => {
    const out = rephrase(
      "I just really think we should basically ship. This is actually great. We can iterate later. One more thought.",
      "shorter"
    );
    expect(out).not.toMatch(/\b(just|really|basically|actually)\b/);
    // Two sentences kept, the 3rd/4th dropped.
    expect(out).not.toContain("One more thought");
  });

  it("longer appends a courteous close once (idempotent)", () => {
    const a = rephrase("Here is the update.", "longer");
    expect(a.length).toBeGreaterThan("Here is the update.".length);
    const b = rephrase(a, "longer");
    expect(b).toBe(a); // doesn't stack
  });

  it("polish fixes capitalization, spacing and terminal punctuation", () => {
    const out = rephrase("hello  world.   i will   send it", "polish");
    expect(out.startsWith("Hello world.")).toBe(true);
    expect(out).toContain(" I will");
    expect(out.endsWith(".")).toBe(true);
    expect(out).not.toContain("  "); // no double spaces
  });

  it("exposes a stable set of rewrite modes", () => {
    expect(REWRITE_MODES.map((m) => m.mode)).toEqual(["shorter", "longer", "formal", "casual", "polish"]);
  });

  it("returns the input unchanged for empty text", () => {
    expect(rephrase("   ", "formal")).toBe("   ");
  });
});

describe("summarizeThread", () => {
  it("falls back to single-message summary for a 1-message thread", () => {
    const s = summarizeThread([email({ body: "Quick note about the launch plan." })]);
    expect(s.startsWith("Summary")).toBe(true);
  });

  it("notes participant + message counts and surfaces the latest ask", () => {
    const thread = [
      email({ id: "m1", threadId: "t", date: "2026-06-01T09:00:00Z", outbound: false, from: { name: "Dana Whitfield", email: "dana@acme.io" }, body: "Kicking off the Q3 planning. The roadmap needs an owner." }),
      email({ id: "m2", threadId: "t", date: "2026-06-02T09:00:00Z", outbound: true, from: { name: "You", email: "me@x.com" }, body: "Thanks — I can own the roadmap." }),
      email({ id: "m3", threadId: "t", date: "2026-06-03T09:00:00Z", outbound: false, from: { name: "Sam Lee", email: "sam@x.com" }, body: "Great. Can you share the timeline by Friday?" }),
    ];
    const s = summarizeThread(thread);
    expect(s).toMatch(/3 messages/);
    expect(s).toMatch(/2 people/);
    expect(s).toMatch(/Latest ask from Sam/);
    expect(s).toContain("?");
  });

  it("handles an empty thread", () => {
    expect(summarizeThread([])).toMatch(/empty/);
  });
});

describe("inboxDigest / formatDigest / catch-me-up", () => {
  const emails = [
    email({ id: "n1", threadId: "tn", read: false, category: "important", from: { name: "Dana Whitfield", email: "dana@acme.io" }, subject: "Q3 plan", body: "Can you confirm the budget?" }),
    email({ id: "n2", threadId: "tn2", read: false, category: "important", from: { name: "Dana Whitfield", email: "dana@acme.io" }, subject: "Follow up", body: "Just checking in." }),
    email({ id: "news", threadId: "tnews", read: false, category: "news", from: { name: "Digest", email: "digest@x.com" }, body: "weekly roundup" }),
    // a thread where we sent last → awaiting reply
    email({ id: "o1", threadId: "to", date: "2026-06-01T09:00:00Z", outbound: false, from: { name: "Priya", email: "p@x.com" }, body: "Here's the doc." }),
    email({ id: "o2", threadId: "to", date: "2026-06-02T09:00:00Z", outbound: true, from: { name: "You", email: "me@x.com" }, subject: "Re: doc", body: "Thanks, reviewing." }),
  ];

  it("computes counts, needs-reply, awaiting-reply and top senders", () => {
    const d = inboxDigest(emails, NOW);
    expect(d.unread).toBeGreaterThanOrEqual(2);
    expect(d.needsReply.map((e) => e.id)).toContain("n1"); // unread question
    expect(d.awaitingReply.map((e) => e.id)).toContain("o2"); // we sent last
    expect(d.newsletters).toBe(1);
    expect(d.topSenders[0].name).toBe("Dana Whitfield");
  });

  it("formatDigest renders a multi-line briefing", () => {
    const text = formatDigest(inboxDigest(emails, NOW));
    expect(text).toMatch(/inbox/i);
    expect(text.split("\n").length).toBeGreaterThan(1);
  });

  it("askInbox routes catch-me-up intents to the digest", () => {
    const a = askInbox(emails, "catch me up", NOW);
    expect(a.local).toBe(true);
    expect(a.text).toMatch(/unread/i);
    expect(a.sources!.length).toBeGreaterThan(0);
    expect(askInbox(emails, "what did i miss", NOW).text).toMatch(/inbox|reply|unread/i);
  });
});

describe("loadAiConfig", () => {
  it("defaults to a disabled local provider", () => {
    const cfg = loadAiConfig();
    expect(cfg.enabled).toBe(false);
    expect(typeof cfg.model).toBe("string");
  });
});
