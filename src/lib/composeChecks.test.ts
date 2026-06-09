import { describe, it, expect } from "vitest";
import {
  composeChecks,
  mentionsAttachment,
  parseRecipients,
  invalidRecipients,
  unfilledPlaceholders,
  blockingChecks,
  hasBlockers,
} from "./composeChecks";
import type { Draft } from "../types";

const base: Draft = {
  id: "d1",
  to: "dana@acme.io",
  subject: "Quick question",
  body: "Hey Dana, can you confirm the Q3 numbers?",
};

const codes = (d: Draft, opts?: { hasAttachment?: boolean }) =>
  composeChecks(d, opts).map((c) => c.code);

describe("composeChecks — recipients", () => {
  it("blocks when there is no recipient", () => {
    const checks = composeChecks({ ...base, to: "" });
    expect(checks.map((c) => c.code)).toContain("no-recipient");
    expect(hasBlockers(checks)).toBe(true);
    expect(blockingChecks(checks)).toHaveLength(1);
  });

  it("blocks on a whitespace-only recipient field", () => {
    expect(codes({ ...base, to: "   " })).toContain("no-recipient");
  });

  it("warns (does not block) on a malformed address", () => {
    const checks = composeChecks({ ...base, to: "dana" });
    expect(checks.map((c) => c.code)).toContain("invalid-recipient");
    expect(hasBlockers(checks)).toBe(false); // forgiving: still sendable
  });

  it("accepts a Display Name <addr> recipient", () => {
    expect(codes({ ...base, to: "Dana Lee <dana@acme.io>" })).not.toContain("invalid-recipient");
  });

  it("flags one bad address among several", () => {
    const checks = composeChecks({ ...base, to: "a@x.com, nope, b@y.com" });
    const inv = checks.find((c) => c.code === "invalid-recipient");
    expect(inv).toBeTruthy();
    expect(inv!.message).toMatch(/don’t look valid|doesn’t look/);
  });

  it("warns on a malformed Cc/Bcc without blocking", () => {
    const checks = composeChecks({ ...base, cc: "broken", bcc: "ok@x.com" });
    expect(checks.map((c) => c.code)).toContain("invalid-cc");
    expect(hasBlockers(checks)).toBe(false);
  });

  it("nudges toward Bcc for a large visible audience (To + Cc)", () => {
    const many = Array.from({ length: 8 }, (_, i) => `p${i}@x.com`).join(", ");
    expect(codes({ ...base, to: many })).toContain("many-recipients");
    // Split across To + Cc still counts together.
    expect(
      codes({ ...base, to: "a@x.com, b@x.com, c@x.com, d@x.com, e@x.com", cc: "f@x.com, g@x.com, h@x.com" }),
    ).toContain("many-recipients");
  });

  it("does not count Bcc toward the visible-audience nudge", () => {
    const manyBcc = Array.from({ length: 12 }, (_, i) => `p${i}@x.com`).join(", ");
    expect(codes({ ...base, bcc: manyBcc })).not.toContain("many-recipients");
  });

  it("stays quiet for an ordinary handful of recipients", () => {
    expect(codes({ ...base, to: "a@x.com, b@x.com, c@x.com" })).not.toContain("many-recipients");
  });
});

describe("composeChecks — subject & body", () => {
  it("warns on an empty subject", () => {
    expect(codes({ ...base, subject: "   " })).toContain("no-subject");
  });

  it("warns on an empty body", () => {
    expect(codes({ ...base, body: "" })).toContain("no-body");
  });

  it("returns no checks for a clean draft", () => {
    expect(composeChecks(base)).toEqual([]);
  });
});

describe("composeChecks — forgot the attachment", () => {
  it("warns when the body promises an attachment but none is attached", () => {
    expect(codes({ ...base, body: "Please find attached the report." })).toContain(
      "forgot-attachment",
    );
  });

  it("catches an attachment mention in the subject too", () => {
    expect(codes({ ...base, subject: "Deck attached", body: "See the attached." })).toContain(
      "forgot-attachment",
    );
  });

  it("suppresses the nudge when a file is attached", () => {
    expect(
      codes({ ...base, body: "Please find attached the report." }, { hasAttachment: true }),
    ).not.toContain("forgot-attachment");
  });

  it("does not fire on a 'see attached' buried in the quoted reply trail", () => {
    const replyBody = [
      "Thanks, that works for me.",
      "",
      "On Mon, Jun 2, 2025 at 9:01 AM Dana Lee <dana@acme.io> wrote:",
      "> Here is the update — please find attached the deck.",
    ].join("\n");
    expect(codes({ ...base, body: replyBody })).not.toContain("forgot-attachment");
  });

  it("does not false-positive on 'attached to' an idea/person", () => {
    expect(mentionsAttachment("I'm really attached to this plan.")).toBe(false);
    expect(mentionsAttachment("Don't get too attached to the first draft.")).toBe(false);
    expect(codes({ ...base, body: "I'm attached to the original concept." })).not.toContain(
      "forgot-attachment",
    );
  });

  it("matches PFA only as a standalone token", () => {
    expect(mentionsAttachment("PFA the signed contract.")).toBe(true);
    expect(mentionsAttachment("The pfander group met today.")).toBe(false);
  });
});

describe("composeChecks — unfilled placeholders", () => {
  it("warns on a leftover {{merge}} variable in the body", () => {
    expect(codes({ ...base, body: "Hi {{first_name}}, quick one." })).toContain("placeholder");
  });

  it("warns on a bracketed filler keyed on a known word", () => {
    expect(codes({ ...base, body: "Let's meet on [date] to discuss." })).toContain("placeholder");
    expect(codes({ ...base, body: "Paste the deck here: [insert link]." })).toContain(
      "placeholder",
    );
    expect(codes({ ...base, subject: "Intro for [Company]" })).toContain("placeholder");
  });

  it("leaves ordinary brackets alone (footnotes, tags, checkboxes)", () => {
    expect(codes({ ...base, body: "See the data [1] and the note [2]." })).not.toContain(
      "placeholder",
    );
    expect(codes({ ...base, subject: "[EXTERNAL] Q3 numbers" })).not.toContain("placeholder");
    expect(codes({ ...base, body: "- [x] shipped\n- [ ] pending" })).not.toContain("placeholder");
  });

  it("does not fire on a {{token}} buried in the quoted reply trail", () => {
    const replyBody = [
      "Sounds good, thanks.",
      "",
      "On Mon, Jun 2, 2025 at 9:01 AM Dana Lee <dana@acme.io> wrote:",
      "> Hi {{first_name}}, here's the template.",
    ].join("\n");
    expect(codes({ ...base, body: replyBody })).not.toContain("placeholder");
  });

  it("collects distinct placeholders across both families", () => {
    const found = unfilledPlaceholders("Hi {{first_name}}, your [company] order on [date].");
    expect(found).toContain("{{first_name}}");
    expect(found.some((p) => /\[company\]/i.test(p))).toBe(true);
    expect(found.some((p) => /\[date\]/i.test(p))).toBe(true);
  });

  it("de-duplicates a repeated token", () => {
    expect(unfilledPlaceholders("{{name}} … {{name}}")).toEqual(["{{name}}"]);
  });
});

describe("composeChecks — parsing helpers", () => {
  it("parses comma/semicolon/newline separated recipients", () => {
    expect(parseRecipients("a@x.com, b@y.com; c@z.com")).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
    ]);
    expect(parseRecipients("")).toEqual([]);
    expect(parseRecipients(undefined)).toEqual([]);
  });

  it("identifies invalid addresses", () => {
    expect(invalidRecipients("a@x.com, dana, b@")).toEqual(["dana", "b@"]);
    expect(invalidRecipients("good@x.com")).toEqual([]);
  });
});
