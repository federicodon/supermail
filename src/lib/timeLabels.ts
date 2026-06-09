// Smart, Superhuman-style timestamps for the conversation list.
//
// `new Date(x).toLocaleDateString()` constructs a fresh Intl.DateTimeFormat on
// every call — measurably slow when a list paints thousands of rows. This
// module keeps one cached formatter per shape and picks the most *useful*
// label for a mail client: the clock time for today's mail ("9:41 AM"),
// "Yesterday", a short month + day inside the current year ("Jun 5"), and
// month + day + year beyond that ("Jun 5, 2025").

export type TimeLabelKind = "time" | "yesterday" | "date" | "date-year";

// Which label shape a timestamp should use, relative to `now` (ms epoch).
// Calendar-day comparisons run in local time, matching what the user sees.
export function timeLabelKind(date: string | number | Date, now: number): TimeLabelKind {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "date-year";
  const ref = new Date(now);
  if (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  ) {
    return "time";
  }
  const yesterday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "yesterday";
  }
  return d.getFullYear() === ref.getFullYear() ? "date" : "date-year";
}

// Formatters are created once per module load (they are the expensive part).
// Lazy so a non-Intl test environment can still import the kind logic.
let fmtTime: Intl.DateTimeFormat | null = null;
let fmtDate: Intl.DateTimeFormat | null = null;
let fmtDateYear: Intl.DateTimeFormat | null = null;

export function smartTimeLabel(date: string | number | Date, now: number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  switch (timeLabelKind(d, now)) {
    case "time":
      fmtTime ??= new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
      return fmtTime.format(d);
    case "yesterday":
      return "Yesterday";
    case "date":
      fmtDate ??= new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
      return fmtDate.format(d);
    case "date-year":
      fmtDateYear ??= new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return fmtDateYear.format(d);
  }
}
