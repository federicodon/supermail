import { parseQuery, toGmailQuery } from "./search";

export interface GmailLiveSearch {
  q: string | null;
  localOnly: boolean;
}

function wantsExplicitMailScope(raw: string): boolean {
  const parsed = parseQuery(raw);
  return parsed.filters.some(
    (f) =>
      !f.negated &&
      f.field === "in" &&
      ["all", "anywhere", "spam", "trash"].includes(f.value.toLowerCase())
  );
}

export function buildGmailLiveSearch(raw: string, now: number): GmailLiveSearch {
  const trimmed = raw.trim();
  if (!trimmed) return { q: null, localOnly: true };
  const q = toGmailQuery(parseQuery(trimmed), now);
  if (!q) return { q: null, localOnly: true };
  const guard = wantsExplicitMailScope(trimmed) ? "" : "-in:spam -in:trash";
  return { q: [q, guard].filter(Boolean).join(" "), localOnly: false };
}
