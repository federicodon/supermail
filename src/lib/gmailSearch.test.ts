import { describe, it, expect } from "vitest";
import { buildGmailLiveSearch } from "./gmailSearch";

const NOW = new Date("2026-06-06T12:00:00.000Z").getTime();

describe("buildGmailLiveSearch", () => {
  it("maps SuperMail search into a guarded Gmail query", () => {
    expect(buildGmailLiveSearch("from:dana is:unread has:attachment", NOW)).toEqual({
      q: "from:dana is:unread has:attachment -in:spam -in:trash",
      localOnly: false,
    });
  });

  it("keeps explicit anywhere/spam/trash scopes untouched", () => {
    expect(buildGmailLiveSearch("from:dana in:anywhere", NOW).q).toBe("from:dana in:anywhere");
    expect(buildGmailLiveSearch("in:trash subject:invoice", NOW).q).toBe("in:trash subject:invoice");
  });

  it("returns localOnly for filters Gmail cannot run by themselves", () => {
    expect(buildGmailLiveSearch("is:meeting", NOW)).toEqual({ q: null, localOnly: true });
    expect(buildGmailLiveSearch("has:link", NOW)).toEqual({ q: null, localOnly: true });
  });

  it("keeps server-searchable parts when local virtual filters are mixed in", () => {
    expect(buildGmailLiveSearch("from:dana is:meeting", NOW)).toEqual({
      q: "from:dana -in:spam -in:trash",
      localOnly: false,
    });
  });

  it("translates relative dates with the existing Gmail syntax mapper", () => {
    expect(buildGmailLiveSearch("newer_than:7d", NOW).q).toBe("after:2026/5/30 -in:spam -in:trash");
  });
});
