import { describe, it, expect } from "vitest";
import {
  getContactNote,
  hasContactNote,
  setContactNote,
  contactNoteEmails,
  contactNoteCount,
  sanitizeContactNotes,
  normEmail,
} from "./contactNotes";

describe("contactNotes", () => {
  it("normalizes the email key (case / whitespace insensitive)", () => {
    expect(normEmail("  Dana@Acme.IO ")).toBe("dana@acme.io");
    const m = setContactNote({}, "Dana@Acme.IO", "economic buyer");
    expect(getContactNote(m, "dana@acme.io")).toBe("economic buyer");
    expect(getContactNote(m, "  DANA@ACME.io ")).toBe("economic buyer");
    expect(hasContactNote(m, "dana@acme.io")).toBe(true);
  });

  it("get/has default to empty for an unknown contact", () => {
    expect(getContactNote({}, "nobody@x.io")).toBe("");
    expect(hasContactNote({}, "nobody@x.io")).toBe(false);
    expect(hasContactNote({ "a@b.io": "   " }, "a@b.io")).toBe(false); // whitespace-only
  });

  it("setContactNote trims and clears on empty", () => {
    let m = setContactNote({}, "a@b.io", "  keep it short  ");
    expect(m["a@b.io"]).toBe("keep it short");
    m = setContactNote(m, "a@b.io", "   ");
    expect("a@b.io" in m).toBe(false);
  });

  it("returns the same reference on a no-op (clear missing / identical set)", () => {
    const base = { "a@b.io": "note" };
    expect(setContactNote(base, "missing@x.io", "")).toBe(base); // clearing absent key
    expect(setContactNote(base, "a@b.io", "note")).toBe(base); // identical value
    expect(setContactNote(base, "a@b.io", "changed")).not.toBe(base);
    expect(setContactNote({}, "", "x")).toEqual({}); // empty email ignored
  });

  it("lists and counts noted contacts", () => {
    const m = setContactNote(setContactNote({}, "a@b.io", "x"), "c@d.io", "y");
    expect(contactNoteEmails(m).sort()).toEqual(["a@b.io", "c@d.io"]);
    expect(contactNoteCount(m)).toBe(2);
    expect(contactNoteCount({})).toBe(0);
  });

  it("sanitizes a corrupt blob (normalize keys, drop non-strings/empties)", () => {
    const raw = { "A@B.io": "  hi ", "x@y.io": 5, "z@z.io": "", " m@n.io ": "ok" };
    const clean = sanitizeContactNotes(raw);
    expect(clean).toEqual({ "a@b.io": "hi", "m@n.io": "ok" });
    expect(sanitizeContactNotes(null)).toEqual({});
    expect(sanitizeContactNotes(["a"])).toEqual({});
    expect(sanitizeContactNotes("nope")).toEqual({});
  });
});
