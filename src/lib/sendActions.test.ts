import { describe, it, expect } from "vitest";
import { isReplyDraft, postSendOutcome } from "./sendActions";
import type { Draft } from "../types";

const reply: Draft = {
  id: "d1",
  to: "dana@acme.io",
  subject: "Re: Q3",
  body: "Sounds good.",
  inReplyTo: "m3",
  threadId: "t1",
};
const fresh: Draft = { id: "d2", to: "new@x.com", subject: "Hi", body: "Hello" };

describe("sendActions", () => {
  it("identifies a reply within an existing thread", () => {
    expect(isReplyDraft(reply)).toBe(true);
    expect(isReplyDraft(fresh)).toBe(false);
    expect(isReplyDraft({ ...reply, threadId: null })).toBe(false);
    expect(isReplyDraft({ ...reply, inReplyTo: null })).toBe(false);
  });

  it("archives the thread on Send & Archive for a reply", () => {
    expect(postSendOutcome(reply, true)).toEqual({ archiveThreadId: "t1" });
  });

  it("never archives a brand-new message", () => {
    expect(postSendOutcome(fresh, true)).toEqual({ archiveThreadId: null });
  });

  it("does nothing when the intent/preference is off", () => {
    expect(postSendOutcome(reply, false)).toEqual({ archiveThreadId: null });
  });

  it("never archives a scheduled (Send Later) message", () => {
    expect(postSendOutcome(reply, true, { scheduled: true })).toEqual({ archiveThreadId: null });
  });
});
