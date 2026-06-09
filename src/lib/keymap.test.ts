import { describe, expect, it } from "vitest";
import { SHORTCUTS, resolveKey } from "./shortcuts";
import {
  type Keymap,
  conflictFor,
  customizedCount,
  effectiveKeysFor,
  effectiveShortcuts,
  isRebindable,
  resetAll,
  resetBinding,
  setBinding,
} from "./keymap";

const def = (id: string) => SHORTCUTS.find((s) => s.id === id)!;

describe("keymap", () => {
  it("knows which shortcuts are rebindable", () => {
    expect(isRebindable(def("archive"))).toBe(true); // single-key triage
    expect(isRebindable(def("remind"))).toBe(true); // key-less, can gain one
    expect(isRebindable(def("goto-inbox"))).toBe(false); // chord
    expect(isRebindable(def("palette"))).toBe(false); // locked
    expect(isRebindable(def("escape"))).toBe(false); // locked
  });

  it("applies overrides onto the base registry without mutating it", () => {
    const overrides: Keymap = { archive: ["y"] };
    const eff = effectiveShortcuts(overrides);
    expect(eff.find((s) => s.id === "archive")!.keys).toEqual(["y"]);
    // base registry untouched
    expect(def("archive").keys).toEqual(["e"]);
    expect(effectiveKeysFor("archive", overrides)).toEqual(["y"]);
    expect(effectiveKeysFor("snooze", overrides)).toEqual(["h"]); // default
  });

  it("detects conflicts against the effective map", () => {
    // 'h' is snooze by default; binding archive to 'h' should conflict.
    expect(conflictFor("h", "archive", {})?.id).toBe("snooze");
    // no conflict for an unused key ('z' is free in the default registry)
    expect(conflictFor("z", "archive", {})).toBeNull();
    // excluding the id itself never self-conflicts
    expect(conflictFor("e", "archive", {})).toBeNull();
  });

  it("setBinding drops the override when set back to default, and can unbind", () => {
    let m: Keymap = setBinding({}, "archive", "y");
    expect(m.archive).toEqual(["y"]);
    m = setBinding(m, "archive", "e"); // default for archive
    expect("archive" in m).toBe(false); // override removed
    m = setBinding({}, "star", null); // explicit unbind
    expect(m.star).toEqual([]);
  });

  it("ignores attempts to rebind locked / chord shortcuts", () => {
    expect(setBinding({}, "palette", "z")).toEqual({});
    expect(setBinding({}, "goto-inbox", "z")).toEqual({});
  });

  it("resetBinding / resetAll / customizedCount behave", () => {
    const m: Keymap = { archive: ["y"], star: ["b"] };
    expect(customizedCount(m)).toBe(2);
    expect("archive" in resetBinding(m, "archive")).toBe(false);
    expect(resetAll()).toEqual({});
  });

  it("resolveKey honors an overridden effective registry", () => {
    const eff = effectiveShortcuts({ archive: ["y"] });
    const blank = { pending: null, at: 0 };
    // 'y' now archives
    expect(resolveKey("y", blank, 0, eff).id).toBe("archive");
    // 'e' (old archive key) no longer matches archive
    expect(resolveKey("e", blank, 0, eff).id).not.toBe("archive");
  });
});
