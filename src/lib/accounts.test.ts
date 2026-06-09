import { describe, expect, it } from "vitest";
import {
  ALL_ACCOUNTS,
  DEFAULT_ACCOUNTS,
  PRIMARY_ACCOUNT_ID,
  type Account,
  accountById,
  accountIdOf,
  accountInitials,
  accountScopeLabel,
  accountUnread,
  composeFromAccount,
  filterByAccount,
  fromIdentity,
  isKnownAccount,
  resolveAccounts,
  signatureFor,
} from "./accounts";
import { email } from "./testEmail";

const TWO: Account[] = [
  { id: "work", name: "Work", email: "w@x.co", color: "#111", signature: "Best,\nW" },
  { id: "personal", name: "Personal", email: "p@x.co", color: "#222" }, // no signature
];

const NOW = Date.parse("2026-06-06T09:00:00.000Z");

describe("accounts", () => {
  it("resolves the effective account, defaulting untagged mail to primary", () => {
    expect(accountIdOf(email({ accountId: "personal" }))).toBe("personal");
    expect(accountIdOf(email({}))).toBe(PRIMARY_ACCOUNT_ID);
  });

  it("filters by a single account and treats untagged mail as primary", () => {
    const mail = [
      email({ id: "a", accountId: "work" }),
      email({ id: "b", accountId: "personal" }),
      email({ id: "c" }), // untagged -> primary (work)
    ];
    expect(filterByAccount(mail, "work").map((e) => e.id)).toEqual(["a", "c"]);
    expect(filterByAccount(mail, "personal").map((e) => e.id)).toEqual(["b"]);
  });

  it("passes everything through for the All sentinel", () => {
    const mail = [email({ id: "a", accountId: "work" }), email({ id: "b", accountId: "personal" })];
    expect(filterByAccount(mail, ALL_ACCOUNTS)).toHaveLength(2);
    expect(filterByAccount(mail, "")).toHaveLength(2);
  });

  it("looks up accounts and recognizes known ids", () => {
    expect(accountById(DEFAULT_ACCOUNTS, "work")?.email).toBe("federico.donatone@growthcab.com");
    expect(accountById(DEFAULT_ACCOUNTS, "nope")).toBeNull();
    expect(isKnownAccount(DEFAULT_ACCOUNTS, "personal")).toBe(true);
    expect(isKnownAccount(DEFAULT_ACCOUNTS, ALL_ACCOUNTS)).toBe(true);
    expect(isKnownAccount(DEFAULT_ACCOUNTS, "ghost")).toBe(false);
  });

  it("counts unread inbox conversations per account (by thread), excluding non-inbox", () => {
    const mail = [
      email({ id: "w1", threadId: "tw", accountId: "work", read: false }),
      email({ id: "w2", threadId: "tw", accountId: "work", read: false }), // same thread
      email({ id: "w3", threadId: "tw2", accountId: "work", read: true }),
      email({ id: "w4", threadId: "tw3", accountId: "work", read: false, archived: true }),
      email({ id: "p1", threadId: "tp", accountId: "personal", read: false }),
    ];
    expect(accountUnread(mail, "work", NOW)).toBe(1); // one unread thread, archived excluded
    expect(accountUnread(mail, "personal", NOW)).toBe(1);
    expect(accountUnread(mail, ALL_ACCOUNTS, NOW)).toBe(2);
  });

  it("builds avatar initials and a scope label", () => {
    expect(accountInitials({ id: "x", name: "Growth Cab", email: "a@b.co", color: "#000" })).toBe("GC");
    expect(accountInitials({ id: "x", name: "Personal", email: "a@b.co", color: "#000" })).toBe("PE");
    expect(accountScopeLabel(DEFAULT_ACCOUNTS, ALL_ACCOUNTS)).toBe("All inboxes");
    expect(accountScopeLabel(DEFAULT_ACCOUNTS, "work")).toBe("Growthcab");
    expect(accountScopeLabel(DEFAULT_ACCOUNTS, "ghost")).toBe("All inboxes");
  });

  it("picks the compose 'from' account: reply > active scope > primary", () => {
    // Reply to a known account wins, even under a different active scope.
    expect(composeFromAccount(TWO, "work", "personal")).toBe("personal");
    // A stale reply id is ignored; falls through to the active scope.
    expect(composeFromAccount(TWO, "personal", "ghost")).toBe("personal");
    // No reply context: a single-account scope is used.
    expect(composeFromAccount(TWO, "work")).toBe("work");
    // The unified inbox (or a stale scope) defaults to the first/primary account.
    expect(composeFromAccount(TWO, ALL_ACCOUNTS)).toBe("work");
    expect(composeFromAccount(TWO, "ghost")).toBe("work");
  });

  it("resolves a signature: account override (incl. empty) else the fallback", () => {
    expect(signatureFor(TWO, "work", "GLOBAL")).toBe("Best,\nW");
    // No account signature -> global fallback.
    expect(signatureFor(TWO, "personal", "GLOBAL")).toBe("GLOBAL");
    // An explicit empty account signature means "no signature", not fallback.
    const withEmpty: Account[] = [{ ...TWO[1], signature: "" }];
    expect(signatureFor(withEmpty, "personal", "GLOBAL")).toBe("");
    // Unknown / missing id -> fallback.
    expect(signatureFor(TWO, "ghost", "GLOBAL")).toBe("GLOBAL");
    expect(signatureFor(TWO, null, "GLOBAL")).toBe("GLOBAL");
  });

  it("formats a From identity and ignores unknown ids", () => {
    expect(fromIdentity(TWO, "work")).toBe("Work <w@x.co>");
    expect(fromIdentity(TWO, "ghost")).toBe("");
    expect(fromIdentity(TWO, null)).toBe("");
  });

  it("merges persisted signatures onto the default account set", () => {
    // Missing / empty -> defaults verbatim.
    expect(resolveAccounts(undefined)).toEqual(DEFAULT_ACCOUNTS);
    expect(resolveAccounts([])).toEqual(DEFAULT_ACCOUNTS);
    // A saved signature edit is adopted; unknown saved ids can't add accounts.
    const merged = resolveAccounts([
      { id: "work", name: "x", email: "x", color: "x", signature: "Edited" },
      { id: "ghost", name: "g", email: "g", color: "g", signature: "nope" },
    ]);
    expect(merged).toHaveLength(DEFAULT_ACCOUNTS.length);
    expect(accountById(merged, "work")?.signature).toBe("Edited");
    // Non-signature fields stay from the canonical default (id set is static).
    expect(accountById(merged, "work")?.email).toBe("federico.donatone@growthcab.com");
    expect(accountById(merged, "ghost")).toBeNull();
  });
});
