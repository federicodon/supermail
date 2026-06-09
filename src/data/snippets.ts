import type { Snippet } from "../types";

// Default snippets showcase the variable engine (see lib/snippets.ts):
// {{first_name}} / {{my_name}} fill from the message context, {{cursor}} marks
// where the caret lands after expansion. Edit them in Settings → Snippets.
export const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: "s1",
    name: "Intro",
    shortcut: ";intro",
    body: "Hi {{first_name}},\n\nGreat to connect. {{cursor}}\n\nBest,\n{{my_name}}",
  },
  {
    id: "s2",
    name: "Follow up",
    shortcut: ";fu",
    body: "Hi {{first_name}},\n\nFloating this back to the top of your inbox — any thoughts on the below?\n\nThanks,\n{{my_name}}",
  },
  {
    id: "s3",
    name: "Schedule call",
    shortcut: ";call",
    body: "Hi {{first_name}},\n\nWould any of these work for a 30-min call?\n\n- Tue 10:00\n- Wed 14:00\n- Thu 11:00\n\nHappy to send an invite.\n\n{{my_name}}",
  },
  {
    id: "s4",
    name: "Thanks + close",
    shortcut: ";ty",
    body: "Thanks so much, {{first_name}} — really appreciate it. I'll take it from here and follow up if anything comes up.\n\n{{my_name}}",
  },
  {
    id: "s5",
    name: "Availability ask",
    shortcut: ";avail",
    body: "Hi {{first_name}},\n\nWhat does your week of {{date}} look like? {{cursor}}\n\nThanks,\n{{my_name}}",
  },
];
