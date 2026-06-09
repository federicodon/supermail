import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  parseQuery,
  parseDateValue,
  matchesQuery,
  searchQuery,
  toGmailQuery,
} from "./search";

const NOW = new Date("2026-06-06T09:00:00.000Z").getTime();

describe("parseQuery", () => {
  it("splits operators from free text", () => {
    const p = parseQuery("from:dana subject:roadmap oauth");
    expect(p.filters).toEqual([
      { field: "from", value: "dana", negated: false },
      { field: "subject", value: "roadmap", negated: false },
    ]);
    expect(p.text).toEqual(["oauth"]);
  });

  it("supports quoted phrases and negation", () => {
    const p = parseQuery('subject:"q3 roadmap" -from:linkedin');
    expect(p.filters).toEqual([
      { field: "subject", value: "q3 roadmap", negated: false },
      { field: "from", value: "linkedin", negated: true },
    ]);
  });

  it("treats unknown prefixes as plain text", () => {
    const p = parseQuery("http://example.com hello");
    expect(p.filters).toHaveLength(0);
    expect(p.text).toContain("http://example.com");
  });
});

describe("parseDateValue", () => {
  it("parses relative and absolute dates", () => {
    expect(parseDateValue("7d", NOW)).toBe(NOW - 7 * 86_400_000);
    expect(parseDateValue("24h", NOW)).toBe(NOW - 24 * 3600_000);
    expect(parseDateValue("2w", NOW)).toBe(NOW - 14 * 86_400_000);
    expect(parseDateValue("2026-06-01", NOW)).toBe(new Date("2026-06-01T00:00:00Z").getTime());
    expect(parseDateValue("nonsense", NOW)).toBeNull();
  });
});

describe("matchesQuery", () => {
  const e = email({
    from: { name: "Dana Whitfield", email: "dana@acme.io", company: "Acme" },
    to: [{ name: "You", email: "me@x.com" }],
    subject: "Q3 roadmap sign-off",
    body: "Let's finalize the analytics milestone.",
    labels: ["Clients"],
    category: "important",
    read: false,
    starred: true,
    attachments: ["deck.pdf"],
    date: "2026-06-05T09:00:00Z",
  });

  it("matches field operators", () => {
    expect(matchesQuery(e, parseQuery("from:dana"), NOW)).toBe(true);
    expect(matchesQuery(e, parseQuery("from:marcus"), NOW)).toBe(false);
    expect(matchesQuery(e, parseQuery("subject:roadmap"), NOW)).toBe(true);
    expect(matchesQuery(e, parseQuery("label:clients"), NOW)).toBe(true);
    expect(matchesQuery(e, parseQuery("category:important"), NOW)).toBe(true);
    expect(matchesQuery(e, parseQuery("is:unread"), NOW)).toBe(true);
    expect(matchesQuery(e, parseQuery("is:starred"), NOW)).toBe(true);
    expect(matchesQuery(e, parseQuery("has:attachment"), NOW)).toBe(true);
  });

  it("ANDs operators with free text", () => {
    expect(matchesQuery(e, parseQuery("from:dana analytics"), NOW)).toBe(true);
    expect(matchesQuery(e, parseQuery("from:dana zzz"), NOW)).toBe(false);
  });

  it("honors negation", () => {
    expect(matchesQuery(e, parseQuery("-from:linkedin"), NOW)).toBe(true);
    expect(matchesQuery(e, parseQuery("-is:starred"), NOW)).toBe(false);
  });

  it("filters by date windows", () => {
    expect(matchesQuery(e, parseQuery("after:7d"), NOW)).toBe(true); // within last 7d
    expect(matchesQuery(e, parseQuery("before:2026-06-01"), NOW)).toBe(false); // it's Jun 5
    expect(matchesQuery(e, parseQuery("after:2026-06-04"), NOW)).toBe(true);
  });
});

describe("cc: (matches Cc recipients)", () => {
  const e = email({
    from: { name: "Dana", email: "dana@acme.io" },
    to: [{ name: "You", email: "me@x.com" }],
    cc: [{ name: "Marcus North", email: "marcus@nw.dev" }],
    subject: "Roadmap",
  });
  const noCc = email({ id: "n", to: [{ name: "You", email: "me@x.com" }] });

  it("matches a Cc'd party by name or email", () => {
    expect(matchesQuery(e, parseQuery("cc:marcus"), NOW)).toBe(true);
    expect(matchesQuery(e, parseQuery("cc:nw.dev"), NOW)).toBe(true);
    expect(matchesQuery(e, parseQuery("cc:north"), NOW)).toBe(true);
  });
  it("does not match a non-Cc'd party, the To party, or a message with no Cc", () => {
    expect(matchesQuery(e, parseQuery("cc:dana"), NOW)).toBe(false); // sender, not Cc
    expect(matchesQuery(e, parseQuery("cc:me@x.com"), NOW)).toBe(false); // To, not Cc
    expect(matchesQuery(noCc, parseQuery("cc:anyone"), NOW)).toBe(false); // cc undefined
  });
  it("honors negation", () => {
    expect(matchesQuery(e, parseQuery("-cc:marcus"), NOW)).toBe(false);
    expect(matchesQuery(e, parseQuery("-cc:nobody"), NOW)).toBe(true);
  });
  it("maps natively to Gmail's cc: operator", () => {
    expect(toGmailQuery(parseQuery("cc:marcus"))).toBe("cc:marcus");
    expect(toGmailQuery(parseQuery("-cc:marcus"))).toBe("-cc:marcus");
  });
});

describe("searchQuery", () => {
  const list = [
    email({ id: "1", from: { name: "Dana", email: "dana@acme.io" }, subject: "Roadmap", read: false }),
    email({ id: "2", from: { name: "LinkedIn", email: "n@linkedin.com" }, subject: "Searches", read: true }),
    email({ id: "3", from: { name: "Marcus", email: "m@nw.dev" }, subject: "OAuth", read: false, starred: true }),
  ];
  it("returns all on empty query", () => {
    expect(searchQuery(list, "  ", NOW)).toHaveLength(3);
  });
  it("combines operators", () => {
    expect(searchQuery(list, "is:unread", NOW).map((e) => e.id)).toEqual(["1", "3"]);
    expect(searchQuery(list, "is:unread is:starred", NOW).map((e) => e.id)).toEqual(["3"]);
    expect(searchQuery(list, "-from:linkedin", NOW).map((e) => e.id)).toEqual(["1", "3"]);
  });
});

describe("is:meeting (scheduling-request filter)", () => {
  const list = [
    email({ id: "1", subject: "Roadmap", body: "Are you free Thursday for a quick call?" }),
    email({ id: "2", subject: "Report", body: "Here's the report you asked for." }),
    email({ id: "3", subject: "Re: sync", body: "Let's schedule a call to walk through it." }),
    email({ id: "4", subject: "My note", body: "Sharing a couple of times that work — grab whatever's easiest.", outbound: true }),
  ];
  it("matches inbound messages that read as scheduling requests", () => {
    expect(searchQuery(list, "is:meeting", NOW).map((e) => e.id)).toEqual(["1", "3"]);
  });
  it("excludes our own outbound scheduling messages", () => {
    expect(matchesQuery(list[3], parseQuery("is:meeting"), NOW)).toBe(false);
  });
  it("combines with other operators and negation", () => {
    expect(searchQuery(list, "is:meeting subject:roadmap", NOW).map((e) => e.id)).toEqual(["1"]);
    expect(searchQuery(list, "-is:meeting", NOW).map((e) => e.id)).toEqual(["2", "4"]);
  });
  it("is dropped from the Gmail query (no server equivalent)", () => {
    expect(toGmailQuery(parseQuery("is:meeting"))).toBe("");
    expect(toGmailQuery(parseQuery("from:dana is:meeting"))).toBe("from:dana");
  });
});

describe("is:actionable (asks-something-of-you filter)", () => {
  const list = [
    email({ id: "1", subject: "Contract", body: "Hi — can you review the contract this week?" }),
    email({ id: "2", subject: "Report", body: "Here's the report you asked for. All good." }),
    email({ id: "3", subject: "Deck", body: "Please send the signed deck by Friday." }),
    email({ id: "4", subject: "My note", body: "Can you confirm the budget?", outbound: true }),
  ];
  it("matches inbound messages that ask something of you", () => {
    expect(searchQuery(list, "is:actionable", NOW).map((e) => e.id)).toEqual(["1", "3"]);
  });
  it("accepts the is:ask alias", () => {
    expect(searchQuery(list, "is:ask", NOW).map((e) => e.id)).toEqual(["1", "3"]);
  });
  it("excludes our own outbound asks", () => {
    expect(matchesQuery(list[3], parseQuery("is:actionable"), NOW)).toBe(false);
  });
  it("combines with other operators and negation", () => {
    expect(searchQuery(list, "is:actionable subject:deck", NOW).map((e) => e.id)).toEqual(["3"]);
    expect(searchQuery(list, "-is:actionable", NOW).map((e) => e.id)).toEqual(["2", "4"]);
  });
  it("is dropped from the Gmail query (no server equivalent)", () => {
    expect(toGmailQuery(parseQuery("is:actionable"))).toBe("");
    expect(toGmailQuery(parseQuery("from:dana is:ask"))).toBe("from:dana");
  });
});

describe("is:committed (a promise you made)", () => {
  const list = [
    email({ id: "1", subject: "Pilot", body: "Thanks! I'll send the deck by Friday.", outbound: true, to: [{ name: "Jo", email: "jo@x.io" }] }),
    email({ id: "2", subject: "Re: Pilot", body: "Sounds great, let me know what works.", outbound: true, to: [{ name: "Jo", email: "jo@x.io" }] }),
    email({ id: "3", subject: "Recap", body: "We'll spin up a sandbox for your team.", outbound: true, to: [{ name: "Jo", email: "jo@x.io" }] }),
    email({ id: "4", subject: "Ask", body: "I'll review it.", outbound: false, from: { name: "Dana", email: "dana@acme.io" } }),
  ];
  it("matches outbound messages where you made a promise", () => {
    expect(searchQuery(list, "is:committed", NOW).map((e) => e.id)).toEqual(["1", "3"]);
  });
  it("accepts the is:promised alias", () => {
    expect(searchQuery(list, "is:promised", NOW).map((e) => e.id)).toEqual(["1", "3"]);
  });
  it("excludes an inbound promise — it's not your commitment", () => {
    expect(matchesQuery(list[3], parseQuery("is:committed"), NOW)).toBe(false);
  });
  it("combines with other operators and negation", () => {
    expect(searchQuery(list, "is:committed subject:recap", NOW).map((e) => e.id)).toEqual(["3"]);
    expect(searchQuery(list, "-is:committed", NOW).map((e) => e.id)).toEqual(["2", "4"]);
  });
  it("is dropped from the Gmail query (no server equivalent)", () => {
    expect(toGmailQuery(parseQuery("is:committed"))).toBe("");
    expect(toGmailQuery(parseQuery("from:dana is:promised"))).toBe("from:dana");
  });
});

describe("has:link (contains a URL)", () => {
  const list = [
    email({ id: "1", subject: "Doc", body: "Here's the plan: https://docs.example.com/q3 — take a look." }),
    email({ id: "2", subject: "Figma", body: "Mock is up at www.figma.com/file/abc, thoughts?" }),
    email({ id: "3", subject: "Sync", body: "Let's chat tomorrow about the roadmap." }),
    email({ id: "4", subject: "Intro", body: "Ping dana@acme.io when you're ready." }),
  ];
  it("matches messages whose body contains a URL", () => {
    expect(searchQuery(list, "has:link", NOW).map((e) => e.id)).toEqual(["1", "2"]);
  });
  it("accepts the has:url and has:links aliases", () => {
    expect(searchQuery(list, "has:url", NOW).map((e) => e.id)).toEqual(["1", "2"]);
    expect(searchQuery(list, "has:links", NOW).map((e) => e.id)).toEqual(["1", "2"]);
  });
  it("does not treat a bare email address as a link", () => {
    expect(matchesQuery(list[3], parseQuery("has:link"), NOW)).toBe(false);
  });
  it("combines with other operators and negation", () => {
    expect(searchQuery(list, "has:link subject:doc", NOW).map((e) => e.id)).toEqual(["1"]);
    expect(searchQuery(list, "-has:link", NOW).map((e) => e.id)).toEqual(["3", "4"]);
  });
  it("is dropped from the Gmail query (no server equivalent)", () => {
    expect(toGmailQuery(parseQuery("has:link"))).toBe("");
    expect(toGmailQuery(parseQuery("from:dana has:url"))).toBe("from:dana");
    // attachment still maps
    expect(toGmailQuery(parseQuery("has:link has:attachment"))).toBe("has:attachment");
  });
});

describe("is:newsletter (bulk / mailing-list mail)", () => {
  const list = [
    email({ id: "1", subject: "Weekly digest", listUnsubscribe: "<https://list.example/u?id=9>" }),
    email({ id: "2", subject: "Product news", category: "news" }),
    email({ id: "3", subject: "Marketing blast", from: { name: "Marketing", email: "marketing@acme.io" } }),
    email({ id: "4", subject: "Lunch?", from: { name: "Dana", email: "dana@acme.io" }, body: "Free to grab lunch?" }),
  ];
  it("matches list mail via header / category / automated sender", () => {
    expect(searchQuery(list, "is:newsletter", NOW).map((e) => e.id)).toEqual(["1", "2", "3"]);
  });
  it("accepts the is:bulk and is:list aliases", () => {
    expect(searchQuery(list, "is:bulk", NOW).map((e) => e.id)).toEqual(["1", "2", "3"]);
    expect(searchQuery(list, "is:list", NOW).map((e) => e.id)).toEqual(["1", "2", "3"]);
  });
  it("does not match an ordinary personal message", () => {
    expect(matchesQuery(list[3], parseQuery("is:newsletter"), NOW)).toBe(false);
  });
  it("combines with other operators and negation", () => {
    expect(searchQuery(list, "is:newsletter subject:news", NOW).map((e) => e.id)).toEqual(["2"]);
    expect(searchQuery(list, "-is:newsletter", NOW).map((e) => e.id)).toEqual(["4"]);
  });
  it("is dropped from the Gmail query (no exact server equivalent)", () => {
    expect(toGmailQuery(parseQuery("is:newsletter"))).toBe("");
    expect(toGmailQuery(parseQuery("from:dana is:bulk"))).toBe("from:dana");
  });
});

describe("toGmailQuery", () => {
  it("maps operators to Gmail syntax", () => {
    expect(toGmailQuery(parseQuery("from:dana is:unread oauth"))).toBe("from:dana is:unread oauth");
    expect(toGmailQuery(parseQuery('subject:"q3 roadmap" -from:linkedin'))).toBe('subject:"q3 roadmap" -from:linkedin');
    expect(toGmailQuery(parseQuery("has:attachment"))).toBe("has:attachment");
  });
  it("formats dates as YYYY/M/D", () => {
    expect(toGmailQuery(parseQuery("before:2026-06-01"), NOW)).toBe("before:2026/6/1");
  });
  it("maps newer_than / older_than to Gmail after: / before:", () => {
    expect(toGmailQuery(parseQuery("newer_than:7d"), NOW)).toBe("after:2026/5/30");
    expect(toGmailQuery(parseQuery("older_than:1w"), NOW)).toBe("before:2026/5/30");
  });
});

describe("richer operators (is:pinned/muted, newer_than/older_than)", () => {
  it("matches is:pinned and is:muted", () => {
    const pinned = email({ id: "p", pinned: true });
    const muted = email({ id: "m", muted: true });
    const plain = email({ id: "x" });
    expect(matchesQuery(pinned, parseQuery("is:pinned"), NOW)).toBe(true);
    expect(matchesQuery(plain, parseQuery("is:pinned"), NOW)).toBe(false);
    expect(matchesQuery(muted, parseQuery("is:muted"), NOW)).toBe(true);
    expect(matchesQuery(plain, parseQuery("is:muted"), NOW)).toBe(false);
  });

  it("supports newer_than / older_than relative spans", () => {
    const recent = email({ id: "r", date: "2026-06-06T06:00:00.000Z" }); // 3h ago
    const old = email({ id: "o", date: "2026-05-01T09:00:00.000Z" }); // ~5w ago
    expect(matchesQuery(recent, parseQuery("newer_than:7d"), NOW)).toBe(true);
    expect(matchesQuery(recent, parseQuery("older_than:7d"), NOW)).toBe(false);
    expect(matchesQuery(old, parseQuery("older_than:2w"), NOW)).toBe(true);
    expect(matchesQuery(old, parseQuery("newer_than:7d"), NOW)).toBe(false);
  });

  it("parses newer_than/older_than as fields, not free text", () => {
    const p = parseQuery("newer_than:7d older_than:1w");
    expect(p.filters).toEqual([
      { field: "newer_than", value: "7d", negated: false },
      { field: "older_than", value: "1w", negated: false },
    ]);
    expect(p.text).toEqual([]);
  });
});
