import { describe, expect, it } from "vitest";
import {
  type NoteMap,
  getNote,
  hasNote,
  noteCount,
  notedThreadIds,
  sanitizeNotes,
  setNote,
} from "./notes";

describe("notes", () => {
  it("reads a note, defaulting to empty", () => {
    const notes: NoteMap = { t1: "call them back" };
    expect(getNote(notes, "t1")).toBe("call them back");
    expect(getNote(notes, "missing")).toBe("");
  });

  it("sets a note immutably and trims whitespace", () => {
    const before: NoteMap = {};
    const after = setNote(before, "t1", "  waiting on legal  ");
    expect(after).toEqual({ t1: "waiting on legal" });
    expect(before).toEqual({}); // unchanged
  });

  it("clears the key when the note becomes empty", () => {
    const notes: NoteMap = { t1: "x", t2: "y" };
    expect(setNote(notes, "t1", "")).toEqual({ t2: "y" });
    expect(setNote(notes, "t1", "   ")).toEqual({ t2: "y" });
  });

  it("returns the same reference when clearing a missing key (no churn)", () => {
    const notes: NoteMap = { t1: "x" };
    expect(setNote(notes, "ghost", "")).toBe(notes);
  });

  it("reports presence ignoring whitespace-only values", () => {
    expect(hasNote({ t1: "note" }, "t1")).toBe(true);
    expect(hasNote({ t1: "   " }, "t1")).toBe(false);
    expect(hasNote({}, "t1")).toBe(false);
  });

  it("lists and counts noted threads", () => {
    const notes: NoteMap = { a: "1", b: "2", c: "   " };
    expect(notedThreadIds(notes).sort()).toEqual(["a", "b"]);
    expect(noteCount(notes)).toBe(2);
  });

  it("sanitizes a corrupt blob to string-only non-empty entries", () => {
    const raw = { a: "keep", b: 42, c: "", d: "   ", e: null };
    expect(sanitizeNotes(raw)).toEqual({ a: "keep" });
    expect(sanitizeNotes(null)).toEqual({});
    expect(sanitizeNotes([1, 2])).toEqual({});
    expect(sanitizeNotes("nope")).toEqual({});
  });
});
