import { describe, it, expect } from "vitest";
import {
  normVipEmail,
  vipOverride,
  isVip,
  setVip,
  clearVip,
  toggleVip,
  vipEmailSet,
  manualVipCount,
  sanitizeVips,
} from "./vips";

describe("vips", () => {
  it("normalizes addresses so a contact is one entry regardless of casing", () => {
    expect(normVipEmail("  Dana@Acme.IO ")).toBe("dana@acme.io");
    const m = setVip({}, "Dana@Acme.IO", true);
    expect(vipOverride(m, "dana@acme.io")).toBe(true);
  });

  it("blends an override with the heuristic", () => {
    const m = setVip({}, "boss@co.com", true);
    expect(isVip(m, "boss@co.com", false)).toBe(true); // forced on despite heuristic off
    const demoted = setVip({}, "noisy@list.com", false);
    expect(isVip(demoted, "noisy@list.com", true)).toBe(false); // forced off despite heuristic on
    expect(isVip({}, "x@y.com", true)).toBe(true); // no override → heuristic
  });

  it("setVip returns the same reference when nothing changes", () => {
    const m = setVip({}, "a@b.com", true);
    expect(setVip(m, "a@b.com", true)).toBe(m);
    expect(setVip(m, "A@B.com", true)).toBe(m);
  });

  it("clearVip reverts to the heuristic and is a no-op when absent", () => {
    const m = setVip({}, "a@b.com", true);
    const cleared = clearVip(m, "a@b.com");
    expect(vipOverride(cleared, "a@b.com")).toBeUndefined();
    expect(clearVip(m, "missing@b.com")).toBe(m);
  });

  it("toggleVip flips the effective state, always storing an explicit override", () => {
    // heuristic VIP, no override → toggling forces it OFF
    const off = toggleVip({}, "freq@b.com", true);
    expect(vipOverride(off, "freq@b.com")).toBe(false);
    // not VIP, no override → toggling forces it ON
    const on = toggleVip({}, "rare@b.com", false);
    expect(vipOverride(on, "rare@b.com")).toBe(true);
  });

  it("vipEmailSet applies overrides on top of the heuristic set", () => {
    const map = { ...setVip({}, "boss@co.com", true), ...setVip({}, "noisy@list.com", false) };
    const set = vipEmailSet(map, ["dana@acme.io", "NOISY@list.com"]);
    expect(set.has("dana@acme.io")).toBe(true); // heuristic kept
    expect(set.has("boss@co.com")).toBe(true); // force-on added
    expect(set.has("noisy@list.com")).toBe(false); // force-off removed
  });

  it("counts only explicitly pinned VIPs", () => {
    const m = { ...setVip({}, "a@b.com", true), ...setVip({}, "c@d.com", false) };
    expect(manualVipCount(m)).toBe(1);
  });

  it("sanitizes junk on load", () => {
    const cleaned = sanitizeVips({ "A@B.com": true, "c@d.com": "yes", bad: 1, "": true });
    expect(cleaned).toEqual({ "a@b.com": true });
    expect(sanitizeVips(null)).toEqual({});
    expect(sanitizeVips([1, 2])).toEqual({});
  });
});
