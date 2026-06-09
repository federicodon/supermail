import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  buildContacts,
  contactStatsFor,
  primaryCorrespondent,
  sortContacts,
  searchContacts,
  emailsWithContact,
  initials,
  avatarColor,
} from "./contacts";

const SELF = "me@example.com";
const dana = { name: "Dana Whitfield", email: "dana@acme.io", company: "Acme", role: "VP" };
const me = { name: "Me", email: SELF };

const emails = [
  // 2 inbound from Dana (one unread, one starred), 1 outbound to Dana
  email({ id: "a", threadId: "t1", from: dana, to: [me], read: false, date: "2026-06-06T08:00:00Z" }),
  email({ id: "b", threadId: "t1", from: dana, to: [me], read: true, starred: true, date: "2026-06-05T08:00:00Z" }),
  email({ id: "c", threadId: "t1", from: me, to: [dana], outbound: true, read: true, date: "2026-06-04T08:00:00Z" }),
  // 1 inbound from Marcus, different thread
  email({
    id: "d",
    threadId: "t2",
    from: { name: "Marcus Lee", email: "marcus@northwind.dev" },
    to: [me],
    read: true,
    date: "2026-06-01T08:00:00Z",
  }),
];

describe("buildContacts", () => {
  it("aggregates the other party with counts, threads, unread", () => {
    const contacts = buildContacts(emails, SELF);
    const d = contacts.find((c) => c.email === "dana@acme.io")!;
    expect(d).toBeTruthy();
    expect(d.received).toBe(2);
    expect(d.sent).toBe(1);
    expect(d.threads).toBe(1);
    expect(d.unread).toBe(1);
    expect(d.company).toBe("Acme");
    expect(d.role).toBe("VP");
    expect(d.vip).toBe(true); // starred interaction
  });

  it("excludes self and sorts most-recent first", () => {
    const contacts = buildContacts(emails, SELF);
    expect(contacts.some((c) => c.email === SELF)).toBe(false);
    expect(contacts[0].email).toBe("dana@acme.io"); // most recent interaction
    expect(contacts.map((c) => c.email)).toContain("marcus@northwind.dev");
  });

  it("vip is false for an infrequent, unstarred contact", () => {
    const contacts = buildContacts(emails, SELF);
    expect(contacts.find((c) => c.email === "marcus@northwind.dev")!.vip).toBe(false);
  });

  it("contactStatsFor returns a single contact's stats (or null)", () => {
    const d = contactStatsFor(emails, "DANA@acme.io", SELF); // case-insensitive
    expect(d?.received).toBe(2);
    expect(d?.company).toBe("Acme");
    expect(contactStatsFor(emails, "nobody@nowhere.com", SELF)).toBeNull();
    expect(contactStatsFor(emails, SELF, SELF)).toBeNull(); // self excluded
    expect(contactStatsFor(emails, "", SELF)).toBeNull();
  });
});

describe("primaryCorrespondent", () => {
  it("picks the dominant external party in a thread (the card subject)", () => {
    const t1 = emails.filter((e) => e.threadId === "t1");
    const c = primaryCorrespondent(t1, SELF);
    expect(c?.email).toBe("dana@acme.io");
    expect(c?.name).toBe("Dana Whitfield");
    expect(c?.company).toBe("Acme"); // learned across the thread
  });

  it("uses the recipient when the thread is all outbound", () => {
    const out = [
      email({ id: "o1", threadId: "tx", from: me, to: [{ name: "Sam Pott", email: "sam@x.io" }], outbound: true, date: "2026-06-06T08:00:00Z" }),
    ];
    expect(primaryCorrespondent(out, SELF)?.email).toBe("sam@x.io");
  });

  it("breaks frequency ties by most recent appearance", () => {
    const a = { name: "Alice", email: "alice@x.io" };
    const b = { name: "Bob", email: "bob@x.io" };
    const thread = [
      email({ id: "m1", threadId: "tt", from: a, to: [me], date: "2026-06-01T08:00:00Z" }),
      email({ id: "m2", threadId: "tt", from: b, to: [me], date: "2026-06-05T08:00:00Z" }),
    ];
    expect(primaryCorrespondent(thread, SELF)?.email).toBe("bob@x.io"); // 1–1 tie, Bob is newer
  });

  it("returns null for a thread that only involves you, or no messages", () => {
    const selfOnly = [email({ id: "s1", threadId: "ts", from: me, to: [me], outbound: true })];
    expect(primaryCorrespondent(selfOnly, SELF)).toBeNull();
    expect(primaryCorrespondent([], SELF)).toBeNull();
  });
});

describe("sort + search + participants", () => {
  it("sorts by frequency, name, unread", () => {
    const c = buildContacts(emails, SELF);
    expect(sortContacts(c, "frequent")[0].email).toBe("dana@acme.io"); // 3 interactions
    expect(sortContacts(c, "name")[0].name.startsWith("Dana")).toBe(true);
    expect(sortContacts(c, "unread")[0].email).toBe("dana@acme.io");
  });

  it("searches name/email/company", () => {
    const c = buildContacts(emails, SELF);
    expect(searchContacts(c, "acme").map((x) => x.email)).toEqual(["dana@acme.io"]);
    expect(searchContacts(c, "northwind").map((x) => x.email)).toEqual(["marcus@northwind.dev"]);
    expect(searchContacts(c, "").length).toBe(c.length);
  });

  it("finds all emails a contact participates in", () => {
    expect(emailsWithContact(emails, "dana@acme.io").map((e) => e.id).sort()).toEqual(["a", "b", "c"]);
    expect(emailsWithContact(emails, "marcus@northwind.dev").map((e) => e.id)).toEqual(["d"]);
  });
});

describe("display helpers", () => {
  it("initials + deterministic avatar color", () => {
    expect(initials("Dana Whitfield")).toBe("DW");
    expect(initials("Stripe")).toBe("ST");
    expect(initials("")).toBe("?");
    expect(avatarColor("a@b.com")).toBe(avatarColor("a@b.com"));
    expect(avatarColor("a@b.com")).toMatch(/^hsl\(/);
  });
});
