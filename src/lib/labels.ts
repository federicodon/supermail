import type { Email, Label } from "../types";

// Gmail-style labels. Labels can be nested with "/" (e.g. "Clients/Acme"), and
// a few are system labels that can't be removed.

export const SYSTEM_LABELS: Label[] = [
  { id: "INBOX", name: "Inbox", system: true },
  { id: "STARRED", name: "Starred", system: true },
  { id: "IMPORTANT", name: "Important", system: true },
  { id: "SENT", name: "Sent", system: true },
];

export const DEFAULT_LABELS: Label[] = [
  { id: "l-clients", name: "Clients", color: "#3b82f6" },
  { id: "l-clients-acme", name: "Clients/Acme", color: "#2563eb" },
  { id: "l-team", name: "Team", color: "#10b981" },
  { id: "l-finance", name: "Finance", color: "#f59e0b" },
  { id: "l-recruiting", name: "Recruiting", color: "#a855f7" },
  { id: "l-readlater", name: "Read later", color: "#64748b" },
];

export function labelName(id: string, labels: Label[]): string {
  return labels.find((l) => l.id === id)?.name ?? id;
}

// ---- Label management (create / rename / recolor / delete) -----------------
//
// Note: emails store label *names* (not ids), so renaming or deleting a label
// must propagate to the mailbox — see renameLabelInEmails / removeLabelFromEmails.

// A stable id derived from the name, e.g. "Clients/Acme" -> "l-clients-acme".
export function slugifyLabelId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `l-${slug || "label"}`;
}

// A normalized, non-empty name is valid (case/space-insensitive de-dupe key).
export function isValidLabelName(name: string): boolean {
  return name.trim().length > 0;
}

// Find a label by case-insensitive name (labels are unique by name in Gmail).
export function findLabelByName(labels: Label[], name: string): Label | undefined {
  const n = name.trim().toLowerCase();
  return labels.find((l) => l.name.toLowerCase() === n);
}

// Insert a label, de-duped by name. Returns the (possibly unchanged) list and
// the resolved label so callers can create-and-apply in one step. Ids are made
// unique even when two different names slug to the same base.
export function addLabel(
  labels: Label[],
  name: string,
  color?: string
): { labels: Label[]; label: Label } {
  const existing = findLabelByName(labels, name);
  if (existing) return { labels, label: existing };
  const base = slugifyLabelId(name);
  let id = base;
  for (let i = 2; labels.some((l) => l.id === id); i++) id = `${base}-${i}`;
  const label: Label = { id, name: name.trim(), color };
  return { labels: [...labels, label], label };
}

// Rename a (non-system) label. No-op for a blank new name or a system label.
export function renameLabel(labels: Label[], id: string, newName: string): Label[] {
  const name = newName.trim();
  if (!name) return labels;
  return labels.map((l) => (l.id === id && !l.system ? { ...l, name } : l));
}

export function recolorLabel(labels: Label[], id: string, color: string): Label[] {
  return labels.map((l) => (l.id === id ? { ...l, color } : l));
}

// Delete a (non-system) label from the list.
export function deleteLabel(labels: Label[], id: string): Label[] {
  return labels.filter((l) => l.id !== id || l.system);
}

// Propagate a rename across the mailbox (emails carry label names).
export function renameLabelInEmails(emails: Email[], oldName: string, newName: string): Email[] {
  if (oldName === newName) return emails;
  return emails.map((e) =>
    e.labels.includes(oldName)
      ? { ...e, labels: e.labels.map((l) => (l === oldName ? newName : l)) }
      : e
  );
}

// Strip a deleted label from every message that carried it.
export function removeLabelFromEmails(emails: Email[], name: string): Email[] {
  return emails.map((e) => (e.labels.includes(name) ? removeLabel(e, name) : e));
}

export function applyLabel(email: Email, labelName: string): Email {
  if (email.labels.includes(labelName)) return email;
  return { ...email, labels: [...email.labels, labelName] };
}

export function removeLabel(email: Email, labelName: string): Email {
  return { ...email, labels: email.labels.filter((l) => l !== labelName) };
}

export function toggleLabel(email: Email, labelName: string): Email {
  return email.labels.includes(labelName)
    ? removeLabel(email, labelName)
    : applyLabel(email, labelName);
}

export function emailsWithLabel(emails: Email[], name: string): Email[] {
  return emails.filter((e) => e.labels.includes(name));
}

export function labelCount(emails: Email[], name: string): number {
  return emails.filter((e) => e.labels.includes(name) && !e.archived).length;
}

// Build a parent/child tree for rendering nested labels.
export interface LabelNode {
  segment: string;
  fullName: string;
  children: LabelNode[];
}

export function labelTree(labels: Label[]): LabelNode[] {
  const roots: LabelNode[] = [];
  const find = (nodes: LabelNode[], segment: string) =>
    nodes.find((n) => n.segment === segment);
  for (const label of labels) {
    const parts = label.name.split("/");
    let level = roots;
    let path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      let node = find(level, part);
      if (!node) {
        node = { segment: part, fullName: path, children: [] };
        level.push(node);
      }
      level = node.children;
    }
  }
  return roots;
}
