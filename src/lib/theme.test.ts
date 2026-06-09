import { describe, expect, it } from "vitest";
import {
  ACCENTS,
  DEFAULT_THEME_ID,
  THEMES,
  THEME_VARS,
  getTheme,
  nextTheme,
  resolveAccent,
  themeVars,
  themesByGroup,
} from "./theme";

describe("theme", () => {
  it("every theme defines all required CSS variables with hex values", () => {
    for (const t of THEMES) {
      for (const v of THEME_VARS) {
        expect(t.vars[v], `${t.id} ${v}`).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      }
    }
  });

  it("has unique theme ids and both groups populated", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = themesByGroup();
    expect(groups.dark.length).toBeGreaterThan(0);
    expect(groups.light.length).toBeGreaterThan(0);
  });

  it("getTheme falls back to the first theme for unknown ids", () => {
    expect(getTheme("midnight").id).toBe("midnight");
    expect(getTheme("nope").id).toBe(THEMES[0].id);
    expect(DEFAULT_THEME_ID).toBe("superhuman");
  });

  it("themeVars applies an accent override only when set", () => {
    const plain = themeVars("midnight");
    expect(plain["--accent"]).toBe(getTheme("midnight").vars["--accent"]);
    const accented = themeVars("midnight", "blue");
    expect(accented["--accent"]).toBe("#2563eb");
    // other vars untouched
    expect(accented["--bg"]).toBe(getTheme("midnight").vars["--bg"]);
    // default accent token is a no-op
    expect(themeVars("midnight", "")["--accent"]).toBe(plain["--accent"]);
  });

  it("resolveAccent maps ids and raw hex, ignoring junk", () => {
    expect(resolveAccent("teal")).toBe("#14b8a6");
    expect(resolveAccent("#abc")).toBe("#abc");
    expect(resolveAccent("")).toBe("");
    expect(resolveAccent("not-a-color")).toBe("");
    expect(ACCENTS[0].value).toBe(""); // first option is "theme default"
  });

  it("nextTheme cycles through every theme and wraps", () => {
    let id = THEMES[0].id;
    const seen = new Set<string>();
    for (let i = 0; i < THEMES.length; i++) {
      seen.add(id);
      id = nextTheme(id);
    }
    expect(seen.size).toBe(THEMES.length);
    expect(id).toBe(THEMES[0].id); // wrapped back to start
  });
});
