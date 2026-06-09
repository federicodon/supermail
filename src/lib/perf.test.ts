import { describe, expect, it } from "vitest";
import {
  LATENCY_CAP,
  clearLatency,
  formatMs,
  latencySnapshot,
  percentile,
  recordLatency,
  runPipelineBenchmark,
  synthesizeMailbox,
} from "./perf";
import { groupThreads } from "./threads";

describe("percentile", () => {
  it("nearest-rank percentiles", () => {
    const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(v, 50)).toBe(50);
    expect(percentile(v, 95)).toBe(100);
    expect(percentile(v, 100)).toBe(100);
    expect(percentile([7], 50)).toBe(7);
    expect(percentile([], 50)).toBe(0);
  });

  it("does not mutate its input", () => {
    const v = [3, 1, 2];
    percentile(v, 50);
    expect(v).toEqual([3, 1, 2]);
  });
});

describe("latency ring buffer", () => {
  it("records, snapshots and caps", () => {
    const store: number[] = [];
    for (let i = 1; i <= LATENCY_CAP + 50; i++) recordLatency(i, store);
    expect(store.length).toBe(LATENCY_CAP);
    expect(store[0]).toBe(51); // oldest 50 dropped
    const s = latencySnapshot(store);
    expect(s.count).toBe(LATENCY_CAP);
    expect(s.max).toBe(LATENCY_CAP + 50);
    expect(s.p50).toBeGreaterThan(0);
    clearLatency(store);
    expect(latencySnapshot(store)).toEqual({ count: 0, p50: 0, p95: 0, max: 0 });
  });

  it("ignores junk samples", () => {
    const store: number[] = [];
    recordLatency(NaN, store);
    recordLatency(-5, store);
    recordLatency(Infinity, store);
    expect(store.length).toBe(0);
  });
});

describe("synthesizeMailbox", () => {
  it("is deterministic for a given seed", () => {
    const a = synthesizeMailbox(200);
    const b = synthesizeMailbox(200);
    expect(a).toEqual(b);
    expect(synthesizeMailbox(200, 7)).not.toEqual(a);
  });

  it("produces n unique well-formed emails across ~n/3 threads", () => {
    const emails = synthesizeMailbox(300);
    expect(emails.length).toBe(300);
    expect(new Set(emails.map((e) => e.id)).size).toBe(300);
    const threads = groupThreads(emails);
    expect(threads.length).toBeGreaterThan(50);
    expect(threads.length).toBeLessThanOrEqual(100);
    for (const e of emails.slice(0, 10)) {
      expect(e.from.email).toContain("@");
      expect(new Date(e.date).getTime()).not.toBeNaN();
    }
  });
});

describe("runPipelineBenchmark", () => {
  it("runs the real pipeline and reports finite stage timings", () => {
    const r = runPipelineBenchmark(600, 2);
    expect(r.n).toBe(600);
    expect(r.threads).toBe(200);
    for (const v of [r.groupMs, r.searchMs, r.rankMs, r.totalMs]) {
      expect(isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(r.opsPerSec).toBeGreaterThan(0);
  });

  it("accepts an injected clock (fully deterministic)", () => {
    let t = 0;
    const r = runPipelineBenchmark(60, 1, () => (t += 5));
    expect(r.groupMs).toBe(5);
    expect(r.searchMs).toBe(5);
    expect(r.rankMs).toBe(5);
    expect(r.totalMs).toBe(15);
    expect(r.opsPerSec).toBeCloseTo(1000 / 15);
  });
});

describe("formatMs", () => {
  it("picks a sensible unit", () => {
    expect(formatMs(0.42)).toBe("420µs");
    expect(formatMs(12.34)).toBe("12.3ms");
    expect(formatMs(250)).toBe("250ms");
    expect(formatMs(Infinity)).toBe("—");
  });
});
