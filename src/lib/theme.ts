// Themes & appearance (Superhuman is known for its themes).
//
// Each theme is a complete set of the CSS custom properties the app paints from
// (`--bg`, `--panel`, …). The registry is the single source of truth for both
// the visual swatch picker (it reads the colors to draw previews) and the live
// application (the app writes these vars straight onto the document root), so a
// theme can never look different in the picker than in the app. An optional
// accent override recolors the primary actions without forking a whole theme.

export type ThemeGroup = "dark" | "light";

// The nine variables every theme must define (mirrors styles.css :root).
export const THEME_VARS = [
  "--bg",
  "--panel",
  "--panel-2",
  "--line",
  "--text",
  "--muted",
  "--accent",
  "--accent-2",
  "--unread",
] as const;

export type ThemeVarName = (typeof THEME_VARS)[number];
export type ThemeVars = Record<ThemeVarName, string>;

export interface Theme {
  id: string;
  name: string;
  group: ThemeGroup;
  vars: ThemeVars;
}

export const THEMES: Theme[] = [
  {
    id: "superhuman",
    name: "Superhuman",
    group: "light",
    vars: {
      "--bg": "#ffffff", "--panel": "#f7f7fa", "--panel-2": "#f3f3f6", "--line": "#ececf0",
      "--text": "#1a1a23", "--muted": "#71717a", "--accent": "#5a52e0", "--accent-2": "#0ea5a3",
      "--unread": "#0d0d14",
    },
  },
  {
    id: "superhuman-dark",
    name: "Superhuman Dark",
    group: "dark",
    vars: {
      "--bg": "#1b1b20", "--panel": "#26262c", "--panel-2": "#2e2e35", "--line": "#3a3a42",
      "--text": "#e6e6ea", "--muted": "#9a9aa6", "--accent": "#6d5efc", "--accent-2": "#2dd4bf",
      "--unread": "#ffffff",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    group: "dark",
    vars: {
      "--bg": "#0f1115", "--panel": "#161922", "--panel-2": "#1d212c", "--line": "#272c38",
      "--text": "#e6e9ef", "--muted": "#8b93a7", "--accent": "#7c5cff", "--accent-2": "#00d4a0",
      "--unread": "#ffffff",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    group: "dark",
    vars: {
      "--bg": "#1a1c1e", "--panel": "#212427", "--panel-2": "#2a2e33", "--line": "#363b42",
      "--text": "#e8eaed", "--muted": "#9aa0a6", "--accent": "#8ab4f8", "--accent-2": "#34d399",
      "--unread": "#ffffff",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    group: "dark",
    vars: {
      "--bg": "#0b1622", "--panel": "#11202f", "--panel-2": "#17293b", "--line": "#21384d",
      "--text": "#e3edf5", "--muted": "#8aa0b4", "--accent": "#38bdf8", "--accent-2": "#2dd4bf",
      "--unread": "#ffffff",
    },
  },
  {
    id: "forest",
    name: "Forest",
    group: "dark",
    vars: {
      "--bg": "#0e1613", "--panel": "#14201b", "--panel-2": "#1b2b24", "--line": "#284034",
      "--text": "#e4efe8", "--muted": "#8fab9c", "--accent": "#4ade80", "--accent-2": "#f59e0b",
      "--unread": "#ffffff",
    },
  },
  {
    id: "plum",
    name: "Plum",
    group: "dark",
    vars: {
      "--bg": "#14101a", "--panel": "#1d1726", "--panel-2": "#271e33", "--line": "#392c49",
      "--text": "#ece6f5", "--muted": "#a596b8", "--accent": "#c084fc", "--accent-2": "#f472b6",
      "--unread": "#ffffff",
    },
  },
  {
    id: "daylight",
    name: "Daylight",
    group: "light",
    vars: {
      "--bg": "#f5f7fa", "--panel": "#ffffff", "--panel-2": "#eef1f6", "--line": "#d9dee6",
      "--text": "#1a2030", "--muted": "#5b6472", "--accent": "#6b4eff", "--accent-2": "#0a9e7a",
      "--unread": "#0b1020",
    },
  },
  {
    id: "paper",
    name: "Paper",
    group: "light",
    vars: {
      "--bg": "#faf7f2", "--panel": "#ffffff", "--panel-2": "#f1ece3", "--line": "#e2dacb",
      "--text": "#2a2620", "--muted": "#6b6456", "--accent": "#b45309", "--accent-2": "#0a9e7a",
      "--unread": "#1a1a1a",
    },
  },
  {
    id: "arctic",
    name: "Arctic",
    group: "light",
    vars: {
      "--bg": "#f0f4f8", "--panel": "#ffffff", "--panel-2": "#e6edf4", "--line": "#d2dce6",
      "--text": "#14202e", "--muted": "#54657a", "--accent": "#2563eb", "--accent-2": "#0891b2",
      "--unread": "#0b1020",
    },
  },
];

export const DEFAULT_THEME_ID = "superhuman";

// Optional accent overrides — recolor the primary actions independent of theme.
// "" means "use the theme's own accent".
export interface AccentOption {
  id: string;
  name: string;
  value: string; // "" = theme default
}

export const ACCENTS: AccentOption[] = [
  { id: "", name: "Theme default", value: "" },
  { id: "violet", name: "Violet", value: "#7c5cff" },
  { id: "blue", name: "Blue", value: "#2563eb" },
  { id: "teal", name: "Teal", value: "#14b8a6" },
  { id: "green", name: "Green", value: "#22c55e" },
  { id: "amber", name: "Amber", value: "#f59e0b" },
  { id: "rose", name: "Rose", value: "#f43f5e" },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

// Resolve an accent override token (an ACCENTS id or a raw hex) to a hex value,
// or "" when it means "theme default".
export function resolveAccent(accent: string | undefined): string {
  if (!accent) return "";
  const opt = ACCENTS.find((a) => a.id === accent);
  if (opt) return opt.value;
  return /^#[0-9a-fA-F]{3,8}$/.test(accent) ? accent : "";
}

// The CSS variables to apply for a theme id + optional accent override.
export function themeVars(themeId: string, accent?: string): ThemeVars {
  const base = { ...getTheme(themeId).vars };
  const a = resolveAccent(accent);
  if (a) base["--accent"] = a;
  return base;
}

// Cycle to the next theme id (wraps). Drives the "cycle theme" command.
export function nextTheme(id: string): string {
  const i = THEMES.findIndex((t) => t.id === id);
  return THEMES[(i + 1) % THEMES.length].id;
}

export function themesByGroup(): Record<ThemeGroup, Theme[]> {
  return {
    dark: THEMES.filter((t) => t.group === "dark"),
    light: THEMES.filter((t) => t.group === "light"),
  };
}
