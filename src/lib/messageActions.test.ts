import { describe, it, expect } from "vitest";
import {
  messageActions,
  replyAllParticipants,
  replyAllRecipients,
  messagePlainText,
} from "./messageActions";
import { email } from "./testEmail";

const SELF = "me@example.com";

describe("messageActions", () => {
  it("offers reply / forward / copy on a 1:1 inbound message (no reply-all)", () => {
    const m = email({
      outbound: false,
      from: { name: "Dana", email: "dana@acme.io" },
      to: [{ name: "You", email: SELF }],
    });
    const ids = messageActions(m, SELF).map((a) => a.id);
    expect(ids).toEqual(["reply", "forward", "copy"]);
  });

  it("adds reply-all when there is another party to copy", () => {
    const m = email({
      outbound: false,
      from: { name: "Dana", email: "dana@acme.io" },
      to: [
        { name: "You", email: SELF },
        { name: "Priya", email: "priya@acme.io" },
      ],
    });
    const ids = messageActions(m, SELF).map((a) => a.id);
    expect(ids).toEqual(["reply", "reply-all", "forward", "copy"]);
  });

  it("counts a Cc recipient toward reply-all eligibility", () => {
    const m = email({
      outbound: false,
      from: { name: "Dana", email: "dana@acme.io" },
      to: [{ name: "You", email: SELF }],
      cc: [{ name: "Marcus", email: "marcus@acme.io" }],
    });
    const ids = messageActions(m, SELF).map((a) => a.id);
    expect(ids).toContain("reply-all");
  });

  it("offers only forward / copy on your own outbound message", () => {
    const m = email({
      outbound: true,
      from: { name: "You", email: SELF },
      to: [
        { name: "Dana", email: "dana@acme.io" },
        { name: "Priya", email: "priya@acme.io" },
      ],
    });
    const ids = messageActions(m, SELF).map((a) => a.id);
    expect(ids).toEqual(["forward", "copy"]);
  });
});

describe("replyAllParticipants", () => {
  it("lists the sender first, then other recipients, excluding you", () => {
    const m = email({
      outbound: false,
      from: { name: "Dana", email: "dana@acme.io" },
      to: [
        { name: "You", email: SELF },
        { name: "Priya", email: "priya@acme.io" },
      ],
      cc: [{ name: "Marcus", email: "marcus@acme.io" }],
    });
    const emails = replyAllParticipants(m, SELF).map((c) => c.email);
    expect(emails).toEqual(["dana@acme.io", "priya@acme.io", "marcus@acme.io"]);
  });

  it("de-duplicates addresses case-insensitively", () => {
    const m = email({
      outbound: false,
      from: { name: "Dana", email: "Dana@Acme.io" },
      to: [
        { name: "You", email: SELF },
        { name: "Dana again", email: "dana@acme.io" },
      ],
    });
    expect(replyAllParticipants(m, SELF)).toHaveLength(1);
  });

  it("excludes you even when your address differs in casing", () => {
    const m = email({
      outbound: false,
      from: { name: "Dana", email: "dana@acme.io" },
      to: [{ name: "You", email: "ME@example.com" }],
    });
    const emails = replyAllParticipants(m, SELF).map((c) => c.email);
    expect(emails).toEqual(["dana@acme.io"]);
  });
});

describe("replyAllRecipients", () => {
  it("puts the sender in To and everyone else in Cc", () => {
    const m = email({
      outbound: false,
      from: { name: "Dana", email: "dana@acme.io" },
      to: [
        { name: "You", email: SELF },
        { name: "Priya", email: "priya@acme.io" },
      ],
      cc: [{ name: "Marcus", email: "marcus@acme.io" }],
    });
    expect(replyAllRecipients(m, SELF)).toEqual({
      to: "dana@acme.io",
      cc: "priya@acme.io, marcus@acme.io",
    });
  });

  it("returns an empty Cc for a 1:1 reply-all", () => {
    const m = email({
      outbound: false,
      from: { name: "Dana", email: "dana@acme.io" },
      to: [{ name: "You", email: SELF }],
    });
    expect(replyAllRecipients(m, SELF)).toEqual({ to: "dana@acme.io", cc: "" });
  });
});

describe("messagePlainText", () => {
  it("includes a header and the full body for an inbound message", () => {
    const m = email({
      outbound: false,
      from: { name: "Dana", email: "dana@acme.io" },
      subject: "Pilot timeline",
      body: "Can we ship Friday?",
    });
    const text = messagePlainText(m);
    expect(text).toContain("From: Dana <dana@acme.io>");
    expect(text).toContain("Subject: Pilot timeline");
    expect(text).toContain("Can we ship Friday?");
  });

  it('renders your own message as "You"', () => {
    const m = email({ outbound: true, subject: "Re: Pilot", body: "Yes." });
    expect(messagePlainText(m)).toContain("From: You");
  });
});
