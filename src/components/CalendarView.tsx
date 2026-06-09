import { useMemo, useState } from "react";
import {
  type CalendarEvent,
  type TimeSlot,
  dayKey,
  findAvailability,
  formatAvailabilityText,
  formatSlot,
  formatTimeRange,
  upcomingEvents,
} from "../lib/calendar";

const DAY = 86_400_000;

// Calendar surface: see upcoming meetings, "Find a time" across a window that
// honors working hours + existing events, then insert a paste-ready
// availability block into a draft or hold a slot (mock only — never writes to a
// real calendar and never sends mail).
export function CalendarView({
  events,
  now,
  onCompose,
  onSchedule,
  onRelease,
}: {
  events: CalendarEvent[];
  now: number;
  onCompose: (text: string) => void;
  onSchedule: (slot: TimeSlot, title: string) => void;
  onRelease?: (id: string) => void;
}) {
  const [duration, setDuration] = useState(30);
  const [days, setDays] = useState(7);
  const [participants, setParticipants] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of upcomingEvents(events, now, 12)) {
      const k = dayKey(e.start);
      const arr = map.get(k);
      if (arr) arr.push(e);
      else map.set(k, [e]);
    }
    return [...map.entries()];
  }, [events, now]);

  const busy = useMemo(
    () =>
      participants
        .split(/[,;]\s*/)
        .map((s) => s.trim())
        .filter(Boolean),
    [participants]
  );

  const slots = useMemo(
    () =>
      findAvailability(events, {
        start: new Date(now).toISOString(),
        end: new Date(now + days * DAY).toISOString(),
        durationMinutes: duration,
        maxSlots: 6,
      }),
    [events, now, days, duration]
  );

  const text = () =>
    formatAvailabilityText(slots, {
      tzLabel: "UTC",
      intro: busy.length
        ? `Here are a few times that work for me to meet${busy.length ? ` with ${busy.join(", ")}` : ""} (times in UTC):`
        : undefined,
    });

  return (
    <div className="calendar-view">
      <div className="cal-col cal-events">
        <h2>
          Calendar <span className="muted">· times in UTC</span>
        </h2>
        {grouped.length === 0 && <p className="muted">No upcoming events.</p>}
        {grouped.map(([day, evs]) => (
          <section key={day} className="cal-day">
            <h3>{day}</h3>
            <ul className="cal-list">
              {evs.map((e) => (
                <li key={e.id} className={`cal-event${e.tentative ? " tentative" : ""}`}>
                  <span className="cal-when">
                    {e.allDay ? "All day" : formatTimeRange({ start: e.start, end: e.end })}
                  </span>
                  <span className="cal-title">
                    {e.title}
                    {e.tentative && <span className="chip cal-hold-chip" title="Tentative hold">HOLD</span>}
                    {e.conference && <span className="chip" title="Video meeting">📹</span>}
                    {e.location && <span className="muted"> · {e.location}</span>}
                  </span>
                  {e.attendees?.length ? <span className="muted cal-att">{e.attendees.join(", ")}</span> : null}
                  {e.tentative && onRelease && (
                    <button className="cal-release" title="Release this hold" onClick={() => onRelease(e.id)}>
                      Release
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="cal-col cal-find">
        <h2>Find a time</h2>
        <div className="cal-controls">
          <label>
            Duration
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </label>
          <label>
            Window
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={3}>Next 3 days</option>
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 2 weeks</option>
            </select>
          </label>
        </div>
        <input
          className="cal-participants"
          placeholder="Participants (optional, comma-separated)"
          value={participants}
          onChange={(e) => setParticipants(e.target.value)}
        />

        <div className="cal-slots">
          {slots.length === 0 && <p className="muted">No open working-hours slots in this window.</p>}
          {slots.map((s) => (
            <div key={s.start} className="cal-slot">
              <span>{formatSlot(s)}</span>
              <button onClick={() => onSchedule(s, busy.length ? `Meeting with ${busy.join(", ")}` : "Hold")}>
                Hold
              </button>
            </div>
          ))}
        </div>

        <div className="cal-send">
          <button className="primary" disabled={!slots.length} onClick={() => onCompose(text())}>
            Insert availability into a new email
          </button>
          <p className="muted">
            Builds a paste-ready “here are some times” block. Review &amp; send manually — SuperMail never sends.
          </p>
        </div>
      </div>
    </div>
  );
}
