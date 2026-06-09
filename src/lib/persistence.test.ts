import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  MemoryKV,
  STORAGE_KEY,
  STORAGE_VERSION,
  DEFAULT_SETTINGS,
  loadState,
  saveState,
  clearState,
  sanitize,
  resolveSettings,
  serializeState,
  parseImportedState,
  mergeById,
  mergeStates,
} from "./persistence";

describe("persistence round-trip", () => {
  it("saves and loads emails + ui prefs", () => {
    const kv = new MemoryKV();
    const emails = [email({ id: "a", read: true }), email({ id: "b", starred: true })];
    expect(saveState({ emails, ui: { activeSplitId: "other", recentCmds: ["archive"] } }, kv)).toBe(true);

    const loaded = loadState(kv);
    expect(loaded?.version).toBe(STORAGE_VERSION);
    expect(loaded?.emails?.map((e) => e.id)).toEqual(["a", "b"]);
    expect(loaded?.ui?.activeSplitId).toBe("other");
    expect(loaded?.savedAt).toBeTypeOf("string");
  });

  it("saves and loads drafts", () => {
    const kv = new MemoryKV();
    const drafts = [
      { id: "d1", to: "x@y.com", subject: "Hello", body: "Hi", inReplyTo: null },
      { id: "d2", to: "z@y.com", subject: "Re: Spec", body: "thoughts", inReplyTo: "m9", scheduledAt: null },
    ];
    saveState({ drafts }, kv);
    const loaded = loadState(kv);
    expect(loaded?.drafts?.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(loaded?.drafts?.[1].inReplyTo).toBe("m9");
  });

  it("saves and loads thread notes + per-person contact notes", () => {
    const kv = new MemoryKV();
    saveState({ notes: { t1: "waiting on legal" }, contactNotes: { "dana@acme.io": "economic buyer" } }, kv);
    const loaded = loadState(kv);
    expect(loaded?.notes?.t1).toBe("waiting on legal");
    expect(loaded?.contactNotes?.["dana@acme.io"]).toBe("economic buyer");
  });

  it("ignores a non-object contactNotes blob", () => {
    expect(sanitize({ version: STORAGE_VERSION, contactNotes: ["nope"] })?.contactNotes).toBeUndefined();
    expect(sanitize({ version: STORAGE_VERSION, contactNotes: "x" })?.contactNotes).toBeUndefined();
  });

  it("saves and loads manual VIP overrides (sanitized)", () => {
    const kv = new MemoryKV();
    saveState({ vips: { "BOSS@co.com": true, "noisy@list.com": false, bad: 1 as unknown as boolean } }, kv);
    const loaded = loadState(kv);
    expect(loaded?.vips?.["boss@co.com"]).toBe(true); // normalized + kept
    expect(loaded?.vips?.["noisy@list.com"]).toBe(false);
    expect(loaded?.vips?.bad).toBeUndefined(); // non-boolean dropped
  });

  it("returns null when nothing is stored", () => {
    expect(loadState(new MemoryKV())).toBeNull();
  });

  it("clearState removes the blob", () => {
    const kv = new MemoryKV();
    saveState({ emails: [email()] }, kv);
    clearState(kv);
    expect(loadState(kv)).toBeNull();
  });
});

describe("persistence resilience", () => {
  it("ignores corrupt JSON", () => {
    const kv = new MemoryKV();
    kv.setItem(STORAGE_KEY, "{not valid json");
    expect(loadState(kv)).toBeNull();
  });

  it("drops blobs from an older version", () => {
    const kv = new MemoryKV();
    kv.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION - 1, emails: [] }));
    expect(loadState(kv)).toBeNull();
  });

  it("sanitize keeps only well-typed fields", () => {
    const result = sanitize({
      version: STORAGE_VERSION,
      emails: [email()],
      splits: "nope",
      ui: { activeSplitId: "x" },
    });
    expect(result?.emails).toHaveLength(1);
    expect(result?.splits).toBeUndefined();
    expect(result?.ui?.activeSplitId).toBe("x");
  });
});

describe("export / import", () => {
  it("serializeState round-trips through parseImportedState", () => {
    const json = serializeState(
      {
        emails: [email({ id: "a" })],
        snippets: [{ id: "s1", name: "Intro", shortcut: ";intro", body: "Hi {{first_name}}" }],
        settings: { signature: "Cheers" },
        ui: { activeSplitId: "news", recentCmds: [], activeAccountId: "all" },
      },
      "2026-06-06T00:00:00.000Z"
    );
    const parsed = parseImportedState(json);
    expect(parsed?.version).toBe(STORAGE_VERSION);
    expect(parsed?.emails?.[0].id).toBe("a");
    expect(parsed?.snippets?.[0].shortcut).toBe(";intro");
    expect(parsed?.settings?.signature).toBe("Cheers");
    expect(parsed?.ui?.activeSplitId).toBe("news");
    expect(parsed?.savedAt).toBe("2026-06-06T00:00:00.000Z");
  });

  it("parseImportedState rejects garbage and version mismatches", () => {
    expect(parseImportedState("not json")).toBeNull();
    expect(parseImportedState(JSON.stringify({ version: STORAGE_VERSION - 1, emails: [] }))).toBeNull();
    expect(parseImportedState(JSON.stringify("a string"))).toBeNull();
  });

  it("an exported snapshot can be loaded back into a store", () => {
    const json = serializeState({ vips: { "BOSS@co.com": true } });
    const kv = new MemoryKV();
    const parsed = parseImportedState(json)!;
    const { version: _v, savedAt: _s, ...rest } = parsed;
    saveState(rest, kv);
    expect(loadState(kv)?.vips?.["boss@co.com"]).toBe(true);
  });
});

describe("settings merge", () => {
  it("fills missing keys from defaults", () => {
    const merged = resolveSettings({ signature: "Cheers" });
    expect(merged.signature).toBe("Cheers");
    expect(merged.undoWindowMs).toBe(DEFAULT_SETTINGS.undoWindowMs);
    expect(merged.autoAdvance).toBe(DEFAULT_SETTINGS.autoAdvance);
  });

  it("resolves to all defaults when nothing persisted", () => {
    expect(resolveSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("back-fills newer toggles (autoFollowUp) on an older settings blob", () => {
    // A blob saved before the field existed must resolve to the safe default.
    const merged = resolveSettings({ signature: "Hi" } as Partial<typeof DEFAULT_SETTINGS>);
    expect(merged.autoFollowUp).toBe(false);
  });
});

describe("mergeById", () => {
  const k = (x: { id: string; v: number }) => x.id;

  it("returns the other side when one is undefined", () => {
    const arr = [{ id: "a", v: 1 }];
    expect(mergeById(undefined, arr, k)).toBe(arr);
    expect(mergeById(arr, undefined, k)).toBe(arr);
  });

  it("unions by id, the imported copy winning on a collision, current-only kept", () => {
    const current = [{ id: "a", v: 1 }, { id: "b", v: 2 }];
    const imported = [{ id: "b", v: 99 }, { id: "c", v: 3 }];
    expect(mergeById(current, imported, k)).toEqual([
      { id: "a", v: 1 },
      { id: "b", v: 99 }, // imported wins
      { id: "c", v: 3 }, // imported-only appended
    ]);
  });
});

describe("mergeStates", () => {
  it("merges emails by id (imported wins) and keeps current-only mail", () => {
    const current = { version: STORAGE_VERSION, emails: [email({ id: "a", read: false }), email({ id: "b" })] };
    const imported = { version: STORAGE_VERSION, emails: [email({ id: "a", read: true, starred: true })] };
    const merged = mergeStates(current, imported);
    const a = merged.emails!.find((e) => e.id === "a")!;
    expect(a.read).toBe(true); // imported triage state wins
    expect(a.starred).toBe(true);
    expect(merged.emails!.map((e) => e.id).sort()).toEqual(["a", "b"]); // b (current-only) preserved
  });

  it("unions note maps with imported winning per key", () => {
    const current = { version: STORAGE_VERSION, notes: { t1: "mine", t2: "keep" } };
    const imported = { version: STORAGE_VERSION, notes: { t1: "theirs", t3: "new" } };
    expect(mergeStates(current, imported).notes).toEqual({ t1: "theirs", t2: "keep", t3: "new" });
  });

  it("shallow-merges settings fragments, imported winning", () => {
    const current = { version: STORAGE_VERSION, settings: { signature: "Mine", autoAdvance: false } };
    const imported = { version: STORAGE_VERSION, settings: { signature: "Theirs" } };
    expect(mergeStates(current, imported).settings).toEqual({ signature: "Theirs", autoAdvance: false });
  });

  it("always stamps the live storage version", () => {
    expect(mergeStates({ version: 999 }, { version: 999 }).version).toBe(STORAGE_VERSION);
  });
});
