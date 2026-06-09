import { describe, it, expect } from "vitest";
import { fuzzyScore } from "../components/CommandPalette";

describe("fuzzyScore", () => {
  it("returns null when the query is not a subsequence", () => {
    expect(fuzzyScore("zzz", "Archive selected")).toBeNull();
  });

  it("matches subsequences and rewards word-starts", () => {
    expect(fuzzyScore("arc", "Archive selected")).not.toBeNull();
    // "as" (Archive Selected word-starts) should outrank an in-word match.
    const wordStarts = fuzzyScore("as", "Archive Selected")!;
    const inWord = fuzzyScore("as", "Glass shards")!;
    expect(wordStarts).toBeGreaterThan(inWord);
  });

  it("empty query scores 0 (everything matches)", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
  });

  it("prefers shorter targets for equal matches", () => {
    const short = fuzzyScore("go", "Go")!;
    const long = fuzzyScore("go", "Go to a very long destination name")!;
    expect(short).toBeGreaterThan(long);
  });
});
