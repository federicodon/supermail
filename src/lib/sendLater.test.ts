import { describe, it, expect } from "vitest";
import type { Draft } from "../types";
import {
  enqueue,
  isDue,
  tickOutbox,
  cancel,
  reschedule,
  pending,
  canUndo,
  sendLaterLabel,
  DEFAULT_UNDO_WINDOW_MS,
} from "./sendLater";

const NOW = 1_000_000_000_000;
const draft: Draft = { id: "d1", to: "a@b.com", subject: "Hi", body: "Body" };

describe("sendLater outbox", () => {
  it("normal send leaves after the undo window", () => {
    const item = enqueue(draft, NOW);
    expect(new Date(item.sendAt).getTime()).toBe(NOW + DEFAULT_UNDO_WINDOW_MS);
    expect(isDue(item, NOW)).toBe(false);
    expect(isDue(item, NOW + DEFAULT_UNDO_WINDOW_MS)).toBe(true);
  });

  it("scheduled send uses the explicit time", () => {
    const at = new Date(NOW + 3600_000).toISOString();
    const item = enqueue({ ...draft, scheduledAt: at }, NOW);
    expect(item.sendAt).toBe(at);
  });

  it("tickOutbox marks due items sent and reports them once", () => {
    const a = enqueue(draft, NOW);
    const b = enqueue({ ...draft, scheduledAt: new Date(NOW + 10 * 3600_000).toISOString() }, NOW);
    const later = NOW + DEFAULT_UNDO_WINDOW_MS + 1;
    const r1 = tickOutbox([a, b], later);
    expect(r1.justSent.map((i) => i.id)).toEqual([a.id]);
    expect(r1.outbox.find((i) => i.id === a.id)!.status).toBe("sent");
    // Ticking again does not re-send the already-sent item.
    const r2 = tickOutbox(r1.outbox, later);
    expect(r2.justSent).toEqual([]);
  });

  it("cancel only affects scheduled items and removes them from pending", () => {
    const a = enqueue(draft, NOW);
    const canceled = cancel([a], a.id);
    expect(canceled[0].status).toBe("canceled");
    expect(pending(canceled)).toEqual([]);
  });

  it("canUndo true while the item is still scheduled and in the future", () => {
    const a = enqueue(draft, NOW);
    expect(canUndo(a, NOW)).toBe(true);
    expect(canUndo(a, NOW + DEFAULT_UNDO_WINDOW_MS + 1)).toBe(false);
  });

  it("sendLaterLabel renders friendly relative time", () => {
    const a = enqueue({ ...draft, scheduledAt: new Date(NOW + 2 * 3600_000).toISOString() }, NOW);
    expect(sendLaterLabel(a, NOW)).toBe("in 2h");
    const soon = enqueue({ ...draft, scheduledAt: new Date(NOW + 30 * 60_000).toISOString() }, NOW);
    expect(sendLaterLabel(soon, NOW)).toBe("in 30m");
  });

  it("reschedule moves a scheduled send and keeps the draft in sync", () => {
    const a = enqueue({ ...draft, scheduledAt: new Date(NOW + 3600_000).toISOString() }, NOW);
    const at = new Date(NOW + 5 * 3600_000).toISOString();
    const next = reschedule([a], a.id, at);
    expect(next[0].sendAt).toBe(at);
    expect(next[0].draft.scheduledAt).toBe(at);
    expect(next[0].status).toBe("scheduled");
  });

  it("reschedule is a no-op (same ref) for unknown id, same time, or non-scheduled item", () => {
    const a = enqueue({ ...draft, scheduledAt: new Date(NOW + 3600_000).toISOString() }, NOW);
    const list = [a];
    expect(reschedule(list, "nope", new Date(NOW + 2 * 3600_000).toISOString())).toBe(list);
    expect(reschedule(list, a.id, a.sendAt)).toBe(list); // unchanged time
    const sent = tickOutbox([enqueue(draft, NOW)], NOW + DEFAULT_UNDO_WINDOW_MS + 1).outbox;
    expect(reschedule(sent, sent[0].id, new Date(NOW + 9 * 3600_000).toISOString())).toBe(sent);
  });
});
