import type { Email, Contact } from "../types";

// Per-message actions inside an open conversation.
//
// Gmail and Superhuman attach their own action set to every message in a thread
// (not just the conversation as a whole): you can reply to *that* message, reply
// to everyone on it, forward it on its own, or copy its text. SuperMail mirrors
// that with a compact action row under each expanded message. This pure helper
// decides which actions a message offers and builds the reply-all recipient
// split, so the App stays thin and the logic is unit-tested.

export type MessageActionId = "reply" | "reply-all" | "forward" | "copy";

export interface MessageAction {
  id: MessageActionId;
  label: string;
  icon: string;
  title: string; // tooltip
}

const normEmail = (e: string): string => e.trim().toLowerCase();

// Everyone other than you who would be on a reply-all to this message: the
// original sender first, then every To / Cc recipient — de-duplicated by address
// and with your own address removed. Drives both the "is reply-all meaningful?"
// decision and the recipient split below.
export function replyAllParticipants(m: Email, selfEmail: string): Contact[] {
  const self = normEmail(selfEmail);
  const seen = new Set<string>();
  const out: Contact[] = [];
  const consider = (c: Contact | undefined): void => {
    if (!c || !c.email) return;
    const key = normEmail(c.email);
    if (!key || key === self || seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };
  // The sender is the primary reply target — skip it for your own outbound mail
  // (you don't reply to yourself; To stays the original audience instead).
  if (!m.outbound) consider(m.from);
  for (const c of m.to ?? []) consider(c);
  for (const c of m.cc ?? []) consider(c);
  return out;
}

export interface ReplyAllRecipients {
  to: string; // comma-joined addresses
  cc: string; // comma-joined addresses
}

// Recipients for a reply-all to an inbound message: To is the original sender,
// Cc is everyone else who was on it (the other To + Cc), minus you and minus the
// sender, de-duplicated. Addresses are comma-joined, ready for a Draft.
export function replyAllRecipients(m: Email, selfEmail: string): ReplyAllRecipients {
  const sender = normEmail(m.from.email);
  const others = replyAllParticipants(m, selfEmail).filter(
    (c) => normEmail(c.email) !== sender
  );
  return {
    to: m.outbound ? "" : m.from.email,
    cc: others.map((c) => c.email).join(", "),
  };
}

// Ordered action set for a single message.
// - An inbound message can be replied to; reply-all appears only when there is
//   at least one *other* party to copy (so a 1:1 doesn't show a pointless
//   reply-all).
// - Every message — yours or theirs — can be forwarded and copied.
export function messageActions(m: Email, selfEmail: string): MessageAction[] {
  const actions: MessageAction[] = [];
  if (!m.outbound) {
    actions.push({ id: "reply", label: "Reply", icon: "↩", title: "Reply to this message" });
    if (replyAllParticipants(m, selfEmail).length > 1) {
      actions.push({
        id: "reply-all",
        label: "Reply all",
        icon: "⤵",
        title: "Reply to everyone on this message",
      });
    }
  }
  actions.push({ id: "forward", label: "Forward", icon: "↪", title: "Forward this message" });
  actions.push({ id: "copy", label: "Copy", icon: "⧉", title: "Copy this message's text" });
  return actions;
}

// A plain-text rendering of a single message for the clipboard — a short header
// (who / when / subject) followed by the full body. Used by the "Copy" action.
export function messagePlainText(m: Email): string {
  const when = new Date(m.date).toLocaleString();
  const who = m.outbound ? "You" : `${m.from.name} <${m.from.email}>`;
  return `From: ${who}\nDate: ${when}\nSubject: ${m.subject}\n\n${m.body}`;
}
