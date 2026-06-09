import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  DEFAULT_SAVED_SEARCHES,
  createSavedSearch,
  addSavedSearch,
  removeSavedSearch,
  renameSavedSearch,
  togglePinned,
  findByQuery,
  orderedSavedSearches,
  runSavedSearch,
  savedSearchCount,
  savedSearchUnreadCount,
} from "./savedSearches";
import type { SavedSearch } from "../types";

const NOW = new Date("2026-06-06T12:00:00.000Z").getTime();

const mailbox = [
  email({ id: "a", read: false, from: { name: "Dana", email: "dana@acme.io" }, attachments: ["q3.pdf"] }),
  email({ id: "b", read: true, from: { name: "Sam", email: "sam@beta.co" } }),
  email({ id: "c", read: false, from: { name: "Dana", email: "dana@acme.io" }, trashed: true }),
];

describe("createSavedSearch", () => {
  it("trims and defaults the name to the query", () => {
    const s = createSavedSearch("  ", "  is:unread ", NOW.toString());
    expect(s.query).toBe("is:unread");
    expect(s.name).toBe("is:unread");
    expect(s.id).toMatch(/^ss-/);
  });
  it("keeps a provided name", () => {
    const s = createSavedSearch("My unread", "is:unread", "iso");
    expect(s.name).toBe("My unread");
  });
});

describe("add / remove / rename / pin", () => {
  it("adds and de-dupes by normalized query", () => {
    let list: SavedSearch[] = [];
    list = addSavedSearch(list, createSavedSearch("A", "is:unread", "1"));
    list = addSavedSearch(list, createSavedSearch("B", "IS:UNREAD", "2")); // same query
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("B"); // replaced
  });
  it("ignores empty queries", () => {
    const list = addSavedSearch([], createSavedSearch("x", "   ", "1"));
    expect(list).toHaveLength(0);
  });
  it("removes by id", () => {
    const s = createSavedSearch("A", "is:unread", "1");
    expect(removeSavedSearch([s], s.id)).toHaveLength(0);
  });
  it("renames, falling back to the old name when blank", () => {
    const s = createSavedSearch("A", "is:unread", "1");
    expect(renameSavedSearch([s], s.id, "Renamed")[0].name).toBe("Renamed");
    expect(renameSavedSearch([s], s.id, "  ")[0].name).toBe("A");
  });
  it("toggles pinned", () => {
    const s = createSavedSearch("A", "is:unread", "1");
    expect(togglePinned([s], s.id)[0].pinned).toBe(true);
    expect(togglePinned(togglePinned([s], s.id), s.id)[0].pinned).toBe(false);
  });
});

describe("findByQuery", () => {
  it("matches case-insensitively", () => {
    const s = createSavedSearch("A", "from:Dana", "1");
    expect(findByQuery([s], "FROM:dana")?.id).toBe(s.id);
    expect(findByQuery([s], "nope")).toBeUndefined();
  });
});

describe("orderedSavedSearches", () => {
  it("puts pinned first, then oldest-first", () => {
    const list: SavedSearch[] = [
      { id: "1", name: "old", query: "a", createdAt: "2026-01-01T00:00:00Z" },
      { id: "2", name: "pinned-new", query: "b", pinned: true, createdAt: "2026-02-01T00:00:00Z" },
      { id: "3", name: "new", query: "c", createdAt: "2026-03-01T00:00:00Z" },
    ];
    expect(orderedSavedSearches(list).map((s) => s.id)).toEqual(["2", "1", "3"]);
  });
});

describe("runSavedSearch", () => {
  it("excludes trashed mail by default", () => {
    const s = createSavedSearch("Dana", "from:dana", "1");
    const out = runSavedSearch(mailbox, s, NOW);
    expect(out.map((e) => e.id)).toEqual(["a"]); // 'c' is trashed
  });
  it("includes everything when the query asks for in:all", () => {
    const s = createSavedSearch("All Dana", "from:dana in:all", "1");
    const out = runSavedSearch(mailbox, s, NOW);
    expect(out.map((e) => e.id).sort()).toEqual(["a", "c"]);
  });
  it("counts total and unread matches", () => {
    const unread = createSavedSearch("Unread", "is:unread", "1");
    expect(savedSearchCount(mailbox, unread, NOW)).toBe(1); // 'a' (c is trashed)
    expect(savedSearchUnreadCount(mailbox, unread, NOW)).toBe(1);
    const attach = createSavedSearch("Files", "has:attachment", "1");
    expect(savedSearchCount(mailbox, attach, NOW)).toBe(1);
  });
});

describe("defaults", () => {
  it("ships valid, runnable starter searches", () => {
    for (const s of DEFAULT_SAVED_SEARCHES) {
      expect(s.query.length).toBeGreaterThan(0);
      // should not throw and return an array
      expect(Array.isArray(runSavedSearch(mailbox, s, NOW))).toBe(true);
    }
    expect(DEFAULT_SAVED_SEARCHES.find((s) => s.id === "ss-unread")?.pinned).toBe(true);
  });

  it("ships a 'Scheduling requests' smart view backed by is:meeting", () => {
    const meeting = DEFAULT_SAVED_SEARCHES.find((s) => s.id === "ss-meeting");
    expect(meeting?.query).toBe("is:meeting");
    const inbox = [
      email({ id: "ask", subject: "Coffee?", body: "Are you free Thursday for a quick call?" }),
      email({ id: "fyi", subject: "Notes", body: "Here are the notes, no action needed." }),
    ];
    const hits = runSavedSearch(inbox, meeting!, NOW).map((e) => e.id);
    expect(hits).toContain("ask");
    expect(hits).not.toContain("fyi");
  });

  it("ships a 'Needs an action' smart view backed by is:actionable", () => {
    const actionable = DEFAULT_SAVED_SEARCHES.find((s) => s.id === "ss-actionable");
    expect(actionable?.query).toBe("is:actionable");
    const inbox = [
      email({ id: "ask", subject: "Contract", body: "Can you review the contract by Friday?" }),
      email({ id: "fyi", subject: "Notes", body: "Here are the notes, no action needed." }),
    ];
    const hits = runSavedSearch(inbox, actionable!, NOW).map((e) => e.id);
    expect(hits).toContain("ask");
    expect(hits).not.toContain("fyi");
  });

  it("ships a 'Promised' smart view backed by is:committed", () => {
    const committed = DEFAULT_SAVED_SEARCHES.find((s) => s.id === "ss-committed");
    expect(committed?.query).toBe("is:committed");
    const inbox = [
      email({ id: "mine", subject: "Pilot", body: "I'll send the deck by Friday.", outbound: true, to: [{ name: "Jo", email: "jo@x.io" }] }),
      email({ id: "theirs", subject: "Ask", body: "I'll review it.", outbound: false, from: { name: "Dana", email: "dana@acme.io" } }),
    ];
    const hits = runSavedSearch(inbox, committed!, NOW).map((e) => e.id);
    expect(hits).toContain("mine");
    expect(hits).not.toContain("theirs");
  });
});
