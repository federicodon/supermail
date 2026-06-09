import { describe, it, expect } from "vitest";
import { SHORTCUTS, resolveKey, renderKeys, shortcutsByGroup, eventToKey } from "./shortcuts";

const fresh = { pending: null, at: 0 };
const ev = (key: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ key, metaKey: false, ctrlKey: false, shiftKey: false, ...mods }) as KeyboardEvent;

describe("shortcut registry integrity", () => {
  it("R is Reply, not Remind (no single-key collision)", () => {
    expect(resolveKey("r", fresh, 0).id).toBe("reply");
    // Remind me intentionally has no single key (palette / button only).
    const remind = SHORTCUTS.find((s) => s.id === "remind")!;
    expect(remind.keys).toEqual([]);
  });

  it("has no duplicate single-key bindings", () => {
    const singles = SHORTCUTS.filter((s) => s.keys.length === 1).map((s) => s.keys[0]);
    expect(new Set(singles).size).toBe(singles.length);
  });
});

describe("chord engine", () => {
  it("resolves g-chords within the window", () => {
    const afterG = resolveKey("g", fresh, 1000);
    expect(afterG.id).toBeNull();
    expect(afterG.next.pending).toBe("g");
    expect(resolveKey("i", afterG.next, 1100).id).toBe("goto-inbox");
    expect(resolveKey("p", resolveKey("g", fresh, 1).next, 50).id).toBe("goto-people");
  });

  it("times out a stale chord prefix", () => {
    const afterG = resolveKey("g", fresh, 0);
    // 2s later (> CHORD_TIMEOUT_MS) the prefix is abandoned; 'i' resolves alone (no match).
    expect(resolveKey("i", afterG.next, 2000).id).toBeNull();
  });
});

describe("eventToKey + new triage bindings", () => {
  it("normalizes plain, mod and shift-letter keys", () => {
    expect(eventToKey(ev("E"))).toBe("e"); // capitalized-without-shift lowercases
    expect(eventToKey(ev("k", { metaKey: true }))).toBe("mod+k");
    expect(eventToKey(ev("U", { shiftKey: true }))).toBe("shift+u");
    // Shift-produced symbols keep their literal character (not "shift+...").
    expect(eventToKey(ev("!", { shiftKey: true }))).toBe("!");
    expect(eventToKey(ev("#", { shiftKey: true }))).toBe("#");
  });

  it("routes # to trash, ! to spam, shift+u to mark-unread, m/p to mute/pin", () => {
    expect(resolveKey(eventToKey(ev("#", { shiftKey: true })), fresh, 0).id).toBe("trash");
    expect(resolveKey(eventToKey(ev("!", { shiftKey: true })), fresh, 0).id).toBe("spam");
    expect(resolveKey(eventToKey(ev("U", { shiftKey: true })), fresh, 0).id).toBe("mark-unread");
    expect(resolveKey(eventToKey(ev("m")), fresh, 0).id).toBe("mute");
    expect(resolveKey(eventToKey(ev("p")), fresh, 0).id).toBe("pin");
    // 'u' alone is still "back", distinct from shift+u.
    expect(resolveKey(eventToKey(ev("u")), fresh, 0).id).toBe("back");
  });

  it("distinguishes undo (⌘Z) from redo (⌘⇧Z) and o = expand-all", () => {
    expect(eventToKey(ev("z", { metaKey: true }))).toBe("mod+z");
    expect(eventToKey(ev("Z", { metaKey: true, shiftKey: true }))).toBe("mod+shift+z");
    expect(resolveKey("mod+z", fresh, 0).id).toBe("undo");
    expect(resolveKey("mod+shift+z", fresh, 0).id).toBe("redo");
    expect(resolveKey("o", fresh, 0).id).toBe("expand-all");
  });
});

describe("renderKeys", () => {
  it("renders single keys and chords", () => {
    expect(renderKeys(["r"])).toBe("R");
    expect(renderKeys(["g", "i"])).toBe("G then I");
    expect(renderKeys(["mod+k"])).toContain("Ctrl+");
    expect(renderKeys(["shift+u"])).toBe("⇧U");
    expect(renderKeys(["mod+shift+z"])).toBe("⌘/Ctrl+⇧z");
  });

  it("groups shortcuts", () => {
    const groups = shortcutsByGroup();
    expect(Object.keys(groups)).toContain("Go to");
    expect(groups["Go to"].some((s) => s.id === "goto-people")).toBe(true);
  });
});
