import { describe, it, expect } from "vitest";
import { agendaActions, hasAgendaActions, type AgendaActionId } from "./agendaActions";
import type { AgendaItem, AgendaKind } from "./agenda";

// Minimal agenda item — agendaActions only reads `kind`.
const item = (kind: AgendaKind): AgendaItem => ({
  id: `${kind}:x`,
  kind,
  at: "2026-06-06T10:00:00.000Z",
  ts: Date.parse("2026-06-06T10:00:00.000Z"),
  title: "t",
  subtitle: "s",
  icon: "•",
  refId: "m1",
  refKind: kind === "event" ? "event" : kind === "send" ? "outbox" : "thread",
  overdue: false,
});

const ids = (kind: AgendaKind): AgendaActionId[] => agendaActions(item(kind)).map((a) => a.id);

describe("agendaActions", () => {
  it("offers Done on a reminder and a follow-up", () => {
    expect(ids("reminder")).toEqual(["done"]);
    expect(ids("followup")).toEqual(["done"]);
  });

  it("offers Return now on a snoozed conversation", () => {
    expect(ids("snoozed")).toEqual(["unsnooze"]);
  });

  it("offers Cancel on a scheduled send", () => {
    expect(ids("send")).toEqual(["cancelSend"]);
  });

  it("offers nothing on a calendar event (never mutated)", () => {
    expect(agendaActions(item("event"))).toEqual([]);
    expect(hasAgendaActions(item("event"))).toBe(false);
  });

  it("reports whether an item has any quick-action", () => {
    expect(hasAgendaActions(item("reminder"))).toBe(true);
    expect(hasAgendaActions(item("send"))).toBe(true);
    expect(hasAgendaActions(item("event"))).toBe(false);
  });

  it("gives every action a label, icon and title", () => {
    for (const kind of ["reminder", "followup", "snoozed", "send"] as AgendaKind[]) {
      for (const a of agendaActions(item(kind))) {
        expect(a.label).toBeTruthy();
        expect(a.icon).toBeTruthy();
        expect(a.title).toBeTruthy();
      }
    }
  });
});
