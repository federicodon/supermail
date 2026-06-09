import { describe, it, expect } from "vitest";
import type { Snippet } from "../types";
import { deriveName, expandSnippet, matchSnippetAt, expandAtCaret } from "./snippets";

// Fixed instant so date/time tokens are deterministic (UTC).
const NOW = new Date("2026-06-06T14:05:00.000Z").getTime(); // a Saturday

const SNIPPETS: Snippet[] = [
  { id: "1", name: "Intro", shortcut: ";intro", body: "Hi {{first_name}},\n\n{{cursor}}\n\n{{my_name}}" },
  { id: "2", name: "Fu", shortcut: ";fu", body: "fu" },
  { id: "3", name: "Fuller", shortcut: ";fuller", body: "fuller" },
];

describe("deriveName", () => {
  it("splits the email local-part into first/last/full", () => {
    expect(deriveName("dana.whitman@acme.com")).toEqual({ first: "Dana", last: "Whitman", full: "Dana Whitman" });
    expect(deriveName("ravi@x.io").first).toBe("Ravi");
    expect(deriveName(undefined).first).toBe("there");
  });
});

describe("expandSnippet", () => {
  it("fills recipient + sender + date variables", () => {
    const { text } = expandSnippet("Hi {{first_name}} ({{email}}) — {{date}} {{day}}. — {{my_first_name}}", {
      recipientEmail: "dana.whitman@acme.com",
      myName: "Federico Donatone",
      now: NOW,
    });
    expect(text).toBe("Hi Dana (dana.whitman@acme.com) — 2026-06-06 Saturday. — Federico");
  });

  it("prefers an explicit recipient name over the derived one", () => {
    const { text } = expandSnippet("{{full_name}} / {{last_name}}", {
      recipientName: "Priya Raman",
      recipientEmail: "x@y.com",
      now: NOW,
    });
    expect(text).toBe("Priya Raman / Raman");
  });

  it("reports the {{cursor}} offset and strips the marker", () => {
    const { text, cursor } = expandSnippet("Hi {{first_name}},\n{{cursor}}\nBest", {
      recipientEmail: "sam@x.com",
      now: NOW,
    });
    expect(text).toBe("Hi Sam,\n\nBest");
    expect(text.slice(cursor, cursor + 4)).toBe("\nBes"); // caret sits where the marker was
  });

  it("defaults the caret to the end when there is no marker", () => {
    const { text, cursor } = expandSnippet("done", {});
    expect(cursor).toBe(text.length);
  });
});

describe("matchSnippetAt / expandAtCaret", () => {
  it("matches the longest shortcut ending at the caret", () => {
    const body = "see you ;fuller";
    const hit = matchSnippetAt(SNIPPETS, body, body.length);
    expect(hit?.snippet.id).toBe("3"); // ;fuller, not ;fu
  });

  it("returns expanded=false when nothing matches", () => {
    const res = expandAtCaret("just typing", 11, SNIPPETS, { now: NOW });
    expect(res.expanded).toBe(false);
    expect(res.body).toBe("just typing");
  });

  it("expands at the caret and positions it at {{cursor}}", () => {
    const typed = "ping: ;intro";
    const res = expandAtCaret(typed, typed.length, SNIPPETS, {
      recipientEmail: "dana@acme.com",
      myName: "Federico",
      now: NOW,
    });
    expect(res.expanded).toBe(true);
    expect(res.body).toBe("ping: Hi Dana,\n\n\n\nFederico");
    // Caret should land on the blank line between the greeting and sign-off.
    expect(res.body.slice(res.caret - 1, res.caret + 1)).toBe("\n\n");
  });

  it("only expands the part before the caret, preserving the tail", () => {
    const body = "a ;fu b";
    const caret = 5; // right after ";fu" (indices 2,3,4)
    const res = expandAtCaret(body, caret, SNIPPETS, { now: NOW });
    expect(res.body).toBe("a fu b");
    expect(res.caret).toBe(4);
  });
});
