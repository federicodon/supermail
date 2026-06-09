import { useEffect, useMemo, useState } from "react";
import type { Email } from "../types";
import {
  avatarColor,
  buildContacts,
  emailsWithContact,
  initials,
  searchContacts,
  sortContacts,
  type ContactSort,
  type ContactStats,
} from "../lib/contacts";
import type { NoteMap } from "../lib/notes";
import { getContactNote } from "../lib/contactNotes";
import { ContactNoteField } from "./ContactNoteField";
import { groupThreads } from "../lib/threads";

export function PeopleView({
  emails,
  selfEmail,
  now,
  focusEmail,
  contactNotes,
  onSaveContactNote,
  onOpenThread,
  onCompose,
  vipEmails,
  onToggleVip,
}: {
  emails: Email[];
  selfEmail: string;
  now: number;
  // When set (e.g. opened from a sender card), pre-select this contact.
  focusEmail?: string | null;
  // Private per-person notes (normalized-email -> text) + writer; shared with the
  // reader's sender card so a note edited in either place stays in sync.
  contactNotes: NoteMap;
  onSaveContactNote: (email: string, text: string) => void;
  onOpenThread: (messageId: string) => void;
  onCompose: (toEmail: string) => void;
  // Effective VIP address set (heuristic + manual overrides) + a toggle that
  // takes the heuristic guess so it flips the effective status. Shared with the
  // reader's sender card so VIP stays in sync everywhere.
  vipEmails: Set<string>;
  onToggleVip: (email: string, name: string, heuristicVip: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ContactSort>("recent");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(focusEmail ?? null);

  // Honor a focus request arriving after mount (re-entering the view for a
  // different person without an unmount).
  useEffect(() => {
    if (focusEmail) setSelectedEmail(focusEmail);
  }, [focusEmail]);

  const contacts = useMemo(() => buildContacts(emails, selfEmail), [emails, selfEmail]);
  const shown = useMemo(
    () => sortContacts(searchContacts(contacts, query), sort),
    [contacts, query, sort]
  );
  const selectedLc = selectedEmail?.toLowerCase() ?? null;
  const selected =
    shown.find((c) => c.email.toLowerCase() === selectedLc) ?? shown[0] ?? null;

  const rel = (iso: string) => {
    const d = Math.round((now - Date.parse(iso)) / 86_400_000);
    if (d <= 0) return "today";
    if (d === 1) return "yesterday";
    if (d < 30) return `${d}d ago`;
    return `${Math.round(d / 30)}mo ago`;
  };

  return (
    <div className="people-view">
      <div className="people-head">
        <h2>People <span className="muted">({contacts.length})</span></h2>
        <input
          className="search people-search"
          placeholder="Search people — name, email, company…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as ContactSort)}>
          <option value="recent">Most recent</option>
          <option value="frequent">Most frequent</option>
          <option value="unread">Most unread</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      <div className="people-panes">
        <ul className="people-list">
          {shown.length === 0 && <li className="empty">No people match.</li>}
          {shown.map((c) => (
            <li
              key={c.email}
              className={`person-row ${selected?.email === c.email ? "sel" : ""}`}
              onClick={() => setSelectedEmail(c.email)}
            >
              <span className="avatar" style={{ background: avatarColor(c.email) }}>
                {initials(c.name)}
              </span>
              <span className="person-main">
                <span className="person-name">
                  {c.name}
                  {vipEmails.has(c.email.toLowerCase()) && <span className="vip-badge">VIP</span>}
                </span>
                <span className="person-sub muted">{c.company || c.email}</span>
              </span>
              {c.unread > 0 && <span className="count">{c.unread}</span>}
            </li>
          ))}
        </ul>

        <section className="person-detail">
          {selected ? (
            <ContactCard
              contact={selected}
              emails={emails}
              rel={rel}
              note={getContactNote(contactNotes, selected.email)}
              onSaveNote={(text) => onSaveContactNote(selected.email, text)}
              onOpenThread={onOpenThread}
              onCompose={onCompose}
              vip={vipEmails.has(selected.email.toLowerCase())}
              onToggleVip={() => onToggleVip(selected.email, selected.name || selected.email, selected.vip)}
            />
          ) : (
            <div className="reader-empty">
              <p className="muted">No contacts yet — they appear here as you exchange mail.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ContactCard({
  contact,
  emails,
  rel,
  note,
  onSaveNote,
  onOpenThread,
  onCompose,
  vip,
  onToggleVip,
}: {
  contact: ContactStats;
  emails: Email[];
  rel: (iso: string) => string;
  note: string;
  onSaveNote: (text: string) => void;
  onOpenThread: (messageId: string) => void;
  onCompose: (toEmail: string) => void;
  vip: boolean;
  onToggleVip: () => void;
}) {
  const threads = useMemo(
    () => groupThreads(emailsWithContact(emails, contact.email)).slice(0, 8),
    [emails, contact.email]
  );
  const firstName = contact.name.split(/\s+/)[0] || contact.email;
  return (
    <article className="contact-card">
      <header className="contact-hero">
        <span className="avatar lg" style={{ background: avatarColor(contact.email) }}>
          {initials(contact.name)}
        </span>
        <div>
          <h3>
            {contact.name}
            {vip && <span className="vip-badge">VIP</span>}
          </h3>
          <div className="muted">{contact.email}</div>
          {(contact.company || contact.role) && (
            <div className="muted">{[contact.role, contact.company].filter(Boolean).join(" · ")}</div>
          )}
        </div>
        <div className="contact-hero-actions">
          <button
            className={`vip-toggle ${vip ? "on" : ""}`}
            onClick={onToggleVip}
            title={vip ? "Remove from VIPs" : "Mark as VIP — boost their threads in Focus"}
          >
            {vip ? "★ VIP" : "☆ VIP"}
          </button>
          <button className="send contact-compose" onClick={() => onCompose(contact.email)}>
            Compose
          </button>
        </div>
      </header>

      <ContactNoteField key={contact.email} note={note} firstName={firstName} onSave={onSaveNote} />

      <dl className="contact-stats">
        <div><dt>Received</dt><dd>{contact.received}</dd></div>
        <div><dt>Sent</dt><dd>{contact.sent}</dd></div>
        <div><dt>Threads</dt><dd>{contact.threads}</dd></div>
        <div><dt>Unread</dt><dd>{contact.unread}</dd></div>
        <div><dt>Last</dt><dd>{rel(contact.lastInteraction)}</dd></div>
      </dl>

      <h4 className="contact-threads-title">Recent conversations</h4>
      <ul className="contact-threads">
        {threads.length === 0 && <li className="muted">No conversations.</li>}
        {threads.map((t) => (
          <li key={t.id}>
            <button className="rem-open" onClick={() => onOpenThread(t.latest.id)}>
              <strong>{t.subject}</strong>
              <span className="muted"> — {t.latest.preview}</span>
            </button>
            <span className="rem-when">{rel(t.latestDate)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
