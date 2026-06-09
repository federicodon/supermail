import { describe, expect, it } from "vitest";
import {
  buildShortcutDrills,
  nextDrillIndex,
  scoreShortcutAttempt,
  shortcutPracticeStats,
} from "./shortcutCoach";
import type { ShortcutDef } from "../types";

const shortcuts: ShortcutDef[] = [
  { id: "reply", keys: ["r"], label: "Reply", group: "Compose" },
  { id: "archive", keys: ["e"], label: "Archive", group: "Triage" },
  { id: "goto-inbox", keys: ["g", "i"], label: "Go to Inbox", group: "Go to" },
  { id: "remind", keys: [], label: "Remind me", group: "Triage" },
  { id: "custom", keys: ["z"], label: "Custom action", group: "Other" },
];

describe("shortcut coach", () => {
  it("builds prioritized drills and skips keyless commands", () => {
    const drills = buildShortcutDrills(shortcuts, 3);

    expect(drills.map((d) => d.id)).toEqual(["archive", "reply", "goto-inbox"]);
    expect(drills.some((d) => d.id === "remind")).toBe(false);
    expect(drills[0].prompt).toContain("Archive");
    expect(drills[0].prompt).toContain("E");
  });

  it("scores single-key and chord attempts", () => {
    const archive = buildShortcutDrills(shortcuts).find((d) => d.id === "archive")!;
    const inbox = buildShortcutDrills(shortcuts).find((d) => d.id === "goto-inbox")!;

    expect(scoreShortcutAttempt(archive, [])).toBe("pending");
    expect(scoreShortcutAttempt(archive, ["e"])).toBe("correct");
    expect(scoreShortcutAttempt(archive, ["r"])).toBe("wrong");
    expect(scoreShortcutAttempt(inbox, ["g"])).toBe("partial");
    expect(scoreShortcutAttempt(inbox, ["g", "i"])).toBe("correct");
    expect(scoreShortcutAttempt(inbox, ["g", "x"])).toBe("wrong");
  });

  it("advances toward unmastered drills first", () => {
    const drills = buildShortcutDrills(shortcuts, 4);

    expect(nextDrillIndex(drills, 0, [{ id: drills[1].id, correct: true }])).toBe(2);
    expect(
      nextDrillIndex(
        drills,
        0,
        drills.map((d) => ({ id: d.id, correct: true }))
      )
    ).toBe(1);
  });

  it("summarizes accuracy and current streak", () => {
    expect(shortcutPracticeStats([])).toEqual({ attempted: 0, correct: 0, missed: 0, accuracy: 0, streak: 0 });
    expect(
      shortcutPracticeStats([
        { id: "archive", correct: true },
        { id: "reply", correct: false },
        { id: "compose", correct: true },
        { id: "search", correct: true },
      ])
    ).toEqual({ attempted: 4, correct: 3, missed: 1, accuracy: 75, streak: 2 });
  });
});
