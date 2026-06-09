import type { Email } from "../types";

// Attachments hub.
//
// Superhuman lets you find any file fast. This module flattens every attachment
// across the mailbox into a searchable, type-aware list (the demo stores file
// names; a real Gmail integration would resolve `get_attachment` lazily). Pure
// and unit-testable.

export type AttachmentKind =
  | "pdf"
  | "image"
  | "doc"
  | "sheet"
  | "slide"
  | "design"
  | "archive"
  | "code"
  | "calendar"
  | "other";

export interface AttachmentRef {
  filename: string;
  ext: string; // lowercased, no dot
  kind: AttachmentKind;
  messageId: string;
  threadId: string;
  from: string; // display name ("You" for outbound)
  fromEmail: string;
  subject: string;
  date: string; // ISO
  outbound: boolean;
}

const KIND_BY_EXT: Record<string, AttachmentKind> = {
  pdf: "pdf",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image", heic: "image",
  doc: "doc", docx: "doc", rtf: "doc", txt: "doc", pages: "doc", md: "doc",
  xls: "sheet", xlsx: "sheet", csv: "sheet", numbers: "sheet",
  ppt: "slide", pptx: "slide", key: "slide",
  fig: "design", sketch: "design", xd: "design", psd: "design", ai: "design",
  zip: "archive", rar: "archive", gz: "archive", tar: "archive", "7z": "archive",
  ics: "calendar",
  js: "code", ts: "code", tsx: "code", json: "code", py: "code", go: "code", rs: "code", sh: "code",
};

const ICON: Record<AttachmentKind, string> = {
  pdf: "📕",
  image: "🖼",
  doc: "📄",
  sheet: "📊",
  slide: "📽",
  design: "🎨",
  archive: "🗜",
  code: "💻",
  calendar: "📅",
  other: "📎",
};

export function extOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function attachmentKind(filename: string): AttachmentKind {
  return KIND_BY_EXT[extOf(filename)] ?? "other";
}

export function attachmentIcon(kind: AttachmentKind): string {
  return ICON[kind];
}

// Flatten every attachment across the mailbox, newest first. Trashed mail is
// excluded unless explicitly requested.
export function collectAttachments(
  emails: Email[],
  opts: { includeTrashed?: boolean } = {}
): AttachmentRef[] {
  const out: AttachmentRef[] = [];
  for (const e of emails) {
    if (e.trashed && !opts.includeTrashed) continue;
    for (const filename of e.attachments) {
      out.push({
        filename,
        ext: extOf(filename),
        kind: attachmentKind(filename),
        messageId: e.id,
        threadId: e.threadId,
        from: e.outbound ? "You" : e.from.name,
        fromEmail: e.from.email,
        subject: e.subject,
        date: e.date,
        outbound: !!e.outbound,
      });
    }
  }
  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Filter the list by free text, or a `kind:`/`type:` operator (e.g. "kind:pdf").
export function filterAttachments(list: AttachmentRef[], query: string): AttachmentRef[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const op = q.match(/^(?:kind|type):(\w+)/);
  if (op) {
    const k = op[1];
    return list.filter((a) => a.kind === k || a.ext === k);
  }
  return list.filter((a) =>
    [a.filename, a.from, a.fromEmail, a.subject, a.kind, a.ext].join(" ").toLowerCase().includes(q)
  );
}

export interface AttachmentStat {
  kind: AttachmentKind;
  count: number;
}

// Count attachments by kind, most common first — drives the filter chips.
export function attachmentBreakdown(list: AttachmentRef[]): AttachmentStat[] {
  const m = new Map<AttachmentKind, number>();
  for (const a of list) m.set(a.kind, (m.get(a.kind) ?? 0) + 1);
  return [...m.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}
