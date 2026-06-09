import { describe, it, expect } from "vitest";
import { splitQuoted, hasQuoted, quotedLineCount, isQuoteLine, quoteText } from "./quotedText";

describe("quotedText", () => {
  it("returns the whole body as visible when there's no quoted history", () => {
    const body = "Hi Dana,\n\nThanks — looks good.\n\nFederico";
    const r = splitQuoted(body);
    expect(r.quoted).toBeNull();
    expect(r.visible).toBe(body);
    expect(hasQuoted(body)).toBe(false);
  });

  it("splits on a Gmail-style 'On … wrote:' attribution", () => {
    const body =
      "Sounds great, let's do Monday.\n\n" +
      "On Mon, Jun 2, 2025 at 9:01 AM Dana Lee <dana@x.com> wrote:\n" +
      "> Are you free Monday?\n> — Dana";
    const r = splitQuoted(body);
    expect(r.visible).toBe("Sounds great, let's do Monday.");
    expect(r.quoted).toContain("On Mon, Jun 2");
    expect(r.quoted).toContain("> Are you free Monday?");
  });

  it("splits on bare '>' quoted lines and pulls the attribution above them in", () => {
    const body = "Yes.\n\nDana wrote:\n> original question\n> second line";
    const r = splitQuoted(body);
    expect(r.visible).toBe("Yes.");
    expect(r.quoted).toBe("Dana wrote:\n> original question\n> second line");
  });

  it("does not treat an ordinary sentence starting with 'On' as a quote", () => {
    const body = "On Monday I'll send the report.\n\nThanks!";
    const r = splitQuoted(body);
    expect(r.quoted).toBeNull();
    expect(r.visible).toBe(body);
  });

  it("recognizes an Outlook 'Original Message' separator", () => {
    const body =
      "See below.\n\n-----Original Message-----\nFrom: Dana\nSubject: Q3\n\nDetails…";
    const r = splitQuoted(body);
    expect(r.visible).toBe("See below.");
    expect(r.quoted).toContain("Original Message");
  });

  it("recognizes an Outlook 'From:' header block but not a casual 'From:' line", () => {
    const quotedBody = "Thanks.\n\nFrom: Dana Lee\nSent: Monday\nTo: Federico\n\nHi…";
    expect(hasQuoted(quotedBody)).toBe(true);
    const casual = "From: the whole team — thank you so much!";
    expect(hasQuoted(casual)).toBe(false);
  });

  it("counts the non-empty quoted lines for the toggle label", () => {
    const body = "Hi.\n\nOn Tue Dana wrote:\n> a\n\n> b\n> c";
    const { quoted } = splitQuoted(body);
    expect(quotedLineCount(quoted)).toBe(4); // attribution + a + b + c (blank skipped)
    expect(quotedLineCount(null)).toBe(0);
  });

  it("handles a message that is only quoted history (empty visible)", () => {
    const body = "On Mon Dana wrote:\n> forwarded content";
    const r = splitQuoted(body);
    expect(r.visible).toBe("");
    expect(r.quoted).toContain("forwarded content");
  });

  it("isQuoteLine detects nested quote depth", () => {
    expect(isQuoteLine("> one")).toBe(true);
    expect(isQuoteLine(">> two")).toBe(true);
    expect(isQuoteLine("  > indented")).toBe(true);
    expect(isQuoteLine("not quoted")).toBe(false);
  });

  it("quoteText prefixes each selected line with '> '", () => {
    expect(quoteText("first line\nsecond line")).toBe("> first line\n> second line");
  });

  it("quoteText collapses blank lines to a bare '>' and trims the edges", () => {
    expect(quoteText("\n\nkeep this\n\nand this\n\n")).toBe("> keep this\n>\n> and this");
  });

  it("quoteText normalizes CRLF and preserves leading indentation", () => {
    expect(quoteText("a\r\n  indented")).toBe("> a\n>   indented");
  });

  it("quoteText returns empty string for blank/whitespace selections", () => {
    expect(quoteText("")).toBe("");
    expect(quoteText("   \n  \n")).toBe("");
  });

  it("quoteText output reads as quoted history (round-trips through isQuoteLine)", () => {
    const out = quoteText("hello\nworld");
    expect(out.split("\n").every((l) => isQuoteLine(l))).toBe(true);
  });
});
