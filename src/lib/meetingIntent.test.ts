import { describe, it, expect } from "vitest";
import {
  detectMeetingRequest,
  meetingRequestInThread,
  inferDurationMinutes,
  meetingScanText,
  meetingReasonText,
} from "./meetingIntent";
import { email } from "./testEmail";

describe("detectMeetingRequest", () => {
  it("detects an explicit availability ask", () => {
    const intent = detectMeetingRequest(email({ body: "Could you share your availability next week?" }));
    expect(intent).not.toBeNull();
    expect(intent!.reasons[0]).toMatch(/availability/);
  });

  it("detects 'are you free' questions", () => {
    expect(detectMeetingRequest(email({ body: "Are you free Thursday afternoon?" }))).not.toBeNull();
    expect(detectMeetingRequest(email({ body: "When are you free to chat?" }))).not.toBeNull();
  });

  it("detects 'let's meet / hop on a call' phrasing", () => {
    expect(detectMeetingRequest(email({ body: "Let's catch up soon." }))).not.toBeNull();
    expect(detectMeetingRequest(email({ body: "Want to hop on a quick call tomorrow?" }))).not.toBeNull();
    expect(detectMeetingRequest(email({ body: "Can we schedule a meeting to go over this?" }))).not.toBeNull();
  });

  it("detects intent in the subject line too", () => {
    const intent = detectMeetingRequest(email({ subject: "Quick call this week?", body: "Wanted to reconnect." }));
    expect(intent).not.toBeNull();
  });

  it("returns up to two distinct reasons", () => {
    const intent = detectMeetingRequest(
      email({ body: "Are you free this week? Happy to share your availability and book a slot." })
    );
    expect(intent).not.toBeNull();
    expect(intent!.reasons.length).toBeLessThanOrEqual(2);
    expect(intent!.reasons.length).toBeGreaterThanOrEqual(1);
  });

  it("never fires on an outbound (our own) message", () => {
    expect(
      detectMeetingRequest(email({ outbound: true, body: "Are you free Thursday? Let's meet." }))
    ).toBeNull();
  });

  it("ignores a meeting *mention* with no scheduling intent", () => {
    expect(detectMeetingRequest(email({ body: "The meeting notes are attached. Great call earlier!" }))).toBeNull();
    expect(detectMeetingRequest(email({ body: "Our last meeting went really well, thanks." }))).toBeNull();
  });

  it("is not tripped by 'feel free' or 'free trial'", () => {
    expect(detectMeetingRequest(email({ body: "Feel free to ignore this. Your free trial ends Friday." }))).toBeNull();
  });

  it("only scans fresh text, not the quoted reply trail", () => {
    const body = [
      "Thanks, sounds good.",
      "",
      "On Mon, Jun 1, 2026 at 9:00 AM Dana <dana@acme.io> wrote:",
      "> Are you free Thursday? Let's schedule a call.",
      "> Best, Dana",
    ].join("\n");
    expect(detectMeetingRequest(email({ body }))).toBeNull();
  });

  it("still detects fresh intent above a quoted trail", () => {
    const body = [
      "Are you free for a quick call Thursday?",
      "",
      "On Mon, Jun 1, 2026 at 9:00 AM Dana <dana@acme.io> wrote:",
      "> Earlier message here.",
    ].join("\n");
    expect(detectMeetingRequest(email({ body }))).not.toBeNull();
  });

  it("handles empty / missing bodies safely", () => {
    expect(detectMeetingRequest(email({ subject: "", body: "" }))).toBeNull();
    expect(detectMeetingRequest(null)).toBeNull();
    expect(detectMeetingRequest(undefined)).toBeNull();
  });
});

describe("inferDurationMinutes", () => {
  it("reads explicit minute counts", () => {
    expect(inferDurationMinutes("can we do 15 minutes?")).toBe(15);
    expect(inferDurationMinutes("a 45-min review")).toBe(45);
    expect(inferDurationMinutes("let's grab 30 minutes")).toBe(30);
  });

  it("reads hour / half-hour phrasing", () => {
    expect(inferDurationMinutes("do you have an hour?")).toBe(60);
    expect(inferDurationMinutes("half an hour works")).toBe(30);
  });

  it("treats 'quick call' as a short slot", () => {
    expect(inferDurationMinutes("just a quick call")).toBe(15);
  });

  it("defaults to 30 minutes when unspecified", () => {
    expect(inferDurationMinutes("let's meet sometime")).toBe(30);
  });
});

describe("meetingScanText", () => {
  it("joins subject and the visible body, lower-cased", () => {
    const text = meetingScanText(email({ subject: "Sync", body: "Let's MEET" }));
    expect(text).toContain("sync");
    expect(text).toContain("let's meet");
    expect(text).not.toMatch(/MEET/);
  });
});

describe("meetingRequestInThread", () => {
  it("returns the latest inbound meeting request in a thread", () => {
    const msgs = [
      email({ id: "m1", body: "Hi there, thanks for the intro." }),
      email({ id: "m2", body: "Are you free Thursday for a quick call?" }),
      email({ id: "m3", outbound: true, body: "Sure, let me check my calendar." }),
    ];
    const found = meetingRequestInThread(msgs);
    expect(found).not.toBeNull();
    expect(found!.message.id).toBe("m2");
    expect(found!.intent.matched).toBe(true);
  });

  it("prefers the most recent request when several match", () => {
    const msgs = [
      email({ id: "m1", body: "Can we schedule a call?" }),
      email({ id: "m2", body: "Actually, are you free Friday instead?" }),
    ];
    expect(meetingRequestInThread(msgs)!.message.id).toBe("m2");
  });

  it("returns null when nothing in the thread is a request", () => {
    const msgs = [
      email({ id: "m1", body: "Here's the report." }),
      email({ id: "m2", outbound: true, body: "Thanks!" }),
    ];
    expect(meetingRequestInThread(msgs)).toBeNull();
  });
});

describe("meetingReasonText", () => {
  it("joins reasons with a separator", () => {
    expect(meetingReasonText({ matched: true, reasons: ["a", "b"], durationMinutes: 30 })).toBe("a · b");
  });
});
