import { describe, it, expect } from "vitest";
import { replyTargetMessage, focusedOrLatest, selectionPreview, selectionWordCount } from "./replyTarget";
import { email } from "./testEmail";

// oldest → newest: inbound, our reply, inbound
const thread = [
  email({ id: "m1", outbound: false }),
  email({ id: "m2", outbound: true }),
  email({ id: "m3", outbound: false }),
];

describe("replyTargetMessage", () => {
  it("replies to the focused inbound message", () => {
    expect(replyTargetMessage(thread, "m1")!.id).toBe("m1");
  });

  it("falls back to the latest inbound when the focused message is outbound", () => {
    expect(replyTargetMessage(thread, "m2")!.id).toBe("m3");
  });

  it("uses the latest inbound when nothing is focused", () => {
    expect(replyTargetMessage(thread, null)!.id).toBe("m3");
  });

  it("uses the latest message when the whole thread is outbound", () => {
    const out = [email({ id: "a", outbound: true }), email({ id: "b", outbound: true })];
    expect(replyTargetMessage(out, "a")!.id).toBe("b");
  });

  it("returns null for an empty thread", () => {
    expect(replyTargetMessage([], "x")).toBeNull();
  });
});

describe("focusedOrLatest", () => {
  it("returns the focused message even if it's outbound (forward)", () => {
    expect(focusedOrLatest(thread, "m2")!.id).toBe("m2");
  });
  it("defaults to the latest message", () => {
    expect(focusedOrLatest(thread, null)!.id).toBe("m3");
    expect(focusedOrLatest(thread, "ghost")!.id).toBe("m3");
  });
  it("returns null for an empty thread", () => {
    expect(focusedOrLatest([], null)).toBeNull();
  });
});

describe("selection helpers", () => {
  it("counts selected words conservatively", () => {
    expect(selectionWordCount("")).toBe(0);
    expect(selectionWordCount("  two\nwords\t here ")).toBe(3);
  });

  it("normalizes and truncates a visible preview", () => {
    expect(selectionPreview("  this\n is   selected  ")).toBe("this is selected");
    expect(selectionPreview("a long selected sentence", 12)).toBe("a long sele…");
  });
});
