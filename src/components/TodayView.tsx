import {
  type AgendaItem,
  type AgendaKind,
  agendaSummary,
  agendaTimeText,
  groupAgendaByDay,
} from "../lib/agenda";
import { agendaActions, type AgendaActionId } from "../lib/agendaActions";

const KIND_LABEL: Record<AgendaKind, string> = {
  event: "Event",
  reminder: "Reminder",
  followup: "Follow-up",
  snoozed: "Snoozed",
  send: "Send later",
};

// "Today" — a unified daily agenda that pulls calendar events, reminders /
// follow-ups, returning snoozed conversations and scheduled sends onto one
// chronological timeline. Past-due task-like items collapse into a leading
// "Overdue" bucket. Clicking a row jumps to the underlying thread / calendar /
// outbox. Read-only — nothing here ever sends or mutates a real account.
export function TodayView({
  agenda,
  now,
  onOpenItem,
  onItemAction,
}: {
  agenda: AgendaItem[];
  now: number;
  onOpenItem: (item: AgendaItem) => void;
  // Act on an item without opening it (clear a reminder, return snoozed mail,
  // cancel a scheduled send). Routes to the same handlers as the other views.
  onItemAction: (item: AgendaItem, action: AgendaActionId) => void;
}) {
  const days = groupAgendaByDay(agenda, now);
  const s = agendaSummary(agenda, now);

  const parts = [
    s.overdue ? `${s.overdue} overdue` : null,
    s.events ? `${s.events} event${s.events > 1 ? "s" : ""}` : null,
    s.reminders ? `${s.reminders} reminder${s.reminders > 1 ? "s" : ""}` : null,
    s.snoozed ? `${s.snoozed} returning` : null,
    s.sends ? `${s.sends} scheduled send${s.sends > 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  return (
    <div className="today-view">
      <header className="today-head">
        <h2>
          🗓 Today <span className="muted">· your unified agenda</span>
        </h2>
        <p className="muted today-sub">
          {s.total === 0
            ? "Nothing scheduled — you're all clear."
            : parts.join(" · ")}
        </p>
      </header>

      {days.length === 0 ? (
        <div className="today-empty">
          <div className="today-empty-emoji">✨</div>
          <p>No reminders, returning mail, scheduled sends or meetings ahead.</p>
          <p className="muted">Snooze a thread or remind yourself and it'll show up here.</p>
        </div>
      ) : (
        days.map((d) => (
          <section key={d.key} className={`today-day${d.overdue ? " overdue" : ""}`}>
            <h3 className="today-day-head">
              {d.overdue && <span className="today-overdue-dot" aria-hidden>!</span>}
              {d.label}
              <span className="muted today-day-count">{d.items.length}</span>
            </h3>
            <ul className="today-list">
              {d.items.map((it) => (
                <li
                  key={it.id}
                  className={`today-row kind-${it.kind}${it.overdue ? " is-overdue" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenItem(it)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenItem(it);
                    }
                  }}
                  title={`Open — ${KIND_LABEL[it.kind]}`}
                >
                  <span className="today-time">{agendaTimeText(it)}</span>
                  <span className="today-icon" aria-hidden>
                    {it.icon}
                  </span>
                  <span className="today-main">
                    <span className="today-title">{it.title}</span>
                    <span className="today-sub2 muted">{it.subtitle}</span>
                  </span>
                  {agendaActions(it).length > 0 && (
                    <span className="today-actions">
                      {agendaActions(it).map((a) => (
                        <button
                          key={a.id}
                          className="today-action"
                          title={a.title}
                          aria-label={a.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            onItemAction(it, a.id);
                          }}
                        >
                          <span aria-hidden>{a.icon}</span> {a.label}
                        </button>
                      ))}
                    </span>
                  )}
                  <span className={`today-kind kind-${it.kind}`}>{KIND_LABEL[it.kind]}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <p className="muted today-note">
        Times in UTC. Reminders, returning snoozed mail and scheduled sends sit here alongside your
        calendar — SuperMail never sends or changes anything automatically.
      </p>
    </div>
  );
}
