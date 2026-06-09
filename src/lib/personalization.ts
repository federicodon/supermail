// AI personalization — "SuperMail learns your voice".
//
// Mirrors Superhuman's personalization (and the live `update_personalization`
// tool): a small profile describing how the user likes their mail written —
// greeting style, sign-off, tone, length, and a list of personal facts the
// assistant should know. The profile is fed into every AI text generator
// (write-with-AI, replies, follow-ups) so drafts come out in the user's voice.
//
// `updatePersonalization` accepts natural-language feedback exactly like the
// live tool ("I prefer casual greetings like Hey", "My title is now VP of
// Engineering", "I like shorter emails") and returns the updated profile plus a
// human-readable list of what changed. It is fully deterministic and offline —
// no provider key required — so it is unit-testable and free.

export type GreetingStyle = "casual" | "neutral" | "formal" | "none";
export type Tone = "casual" | "neutral" | "formal";
export type Verbosity = "brief" | "balanced" | "detailed";

export interface Personalization {
  name: string; // how the user signs ("Federico", "Fede")
  greetingStyle: GreetingStyle;
  signOff: string; // "Best,", "Cheers,", "Thanks,"
  tone: Tone;
  verbosity: Verbosity;
  facts: string[]; // personal facts: title, company, location, prefs…
}

export const DEFAULT_PERSONALIZATION: Personalization = {
  name: "Federico",
  greetingStyle: "neutral",
  signOff: "Best,",
  tone: "neutral",
  verbosity: "balanced",
  facts: [],
};

// Merge a persisted (possibly partial / stale) profile onto the defaults so new
// fields always have a value.
export function resolvePersonalization(p?: Partial<Personalization> | null): Personalization {
  return {
    ...DEFAULT_PERSONALIZATION,
    ...(p ?? {}),
    facts: Array.isArray(p?.facts) ? p!.facts! : DEFAULT_PERSONALIZATION.facts,
  };
}

// ---- Applying the profile to generated text -------------------------------

export function greeting(p: Personalization, firstName: string): string {
  const who = (firstName || "there").trim();
  switch (p.greetingStyle) {
    case "none":
      return "";
    case "formal":
      return `Dear ${who},`;
    case "casual":
      return `Hey ${who},`;
    case "neutral":
    default:
      return `Hi ${who},`;
  }
}

export function signatureLines(p: Personalization): string[] {
  const signOff = p.signOff.trim() || "Best,";
  return [signOff, p.name.trim() || "Federico"];
}

// Assemble a full message body in the user's voice from greeting + paragraphs +
// sign-off, skipping the greeting when the style is "none".
export function composeBody(p: Personalization, firstName: string, paragraphs: string[]): string {
  const lines: string[] = [];
  const g = greeting(p, firstName);
  if (g) lines.push(g, "");
  paragraphs.filter(Boolean).forEach((para, i, arr) => {
    lines.push(para);
    if (i < arr.length - 1) lines.push("");
  });
  lines.push("", ...signatureLines(p));
  return lines.join("\n");
}

// ---- Natural-language feedback parser (update_personalization) -------------

export interface PersonalizationChange {
  field: string;
  to: string;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Apply natural-language feedback to a profile. Deterministic; returns the new
// profile and a list of the changes made (so the UI can confirm them).
export function updatePersonalization(
  p: Personalization,
  feedback: string
): { profile: Personalization; changes: PersonalizationChange[] } {
  const raw = feedback.trim();
  const f = raw.toLowerCase();
  const next: Personalization = { ...p, facts: [...p.facts] };
  const changes: PersonalizationChange[] = [];

  const setField = <K extends keyof Personalization>(
    field: K,
    value: Personalization[K],
    human: string,
    display: string
  ) => {
    if (String(next[field]) === String(value)) return;
    next[field] = value;
    changes.push({ field: human, to: display });
  };

  // --- Greeting style (must mention greeting / greet / a greeting word) ---
  if (/\b(no greeting|skip (the )?greeting|without a greeting|don'?t (use a )?greet)/.test(f)) {
    setField("greetingStyle", "none", "greeting", "no greeting");
  } else if (/greet/.test(f) || /\bgreetings? like\b/.test(f)) {
    // Casual signals win over a stray "Dear" (e.g. "casual greetings like Hey
    // instead of Dear").
    if (/\b(casual|informal|hey|hiya|yo)\b/.test(f))
      setField("greetingStyle", "casual", "greeting", "casual (Hey)");
    else if (/\b(formal|dear)\b/.test(f)) setField("greetingStyle", "formal", "greeting", "formal (Dear)");
    else if (/\bhi\b/.test(f)) setField("greetingStyle", "neutral", "greeting", "neutral (Hi)");
  }

  // --- Sign-off ("sign off with Cheers", "end with Thanks", "close with …") ---
  const signoff = f.match(
    /\b(?:sign off with|sign-off with|signoff with|sign off:?|end (?:my emails? )?with|close with)\s+["']?([a-z][a-z .!'-]{0,24})/
  );
  if (signoff) {
    let phrase = titleCase(signoff[1].trim().replace(/[.!]+$/, ""));
    if (!/[,!.]$/.test(phrase)) phrase += ",";
    setField("signOff", phrase, "sign-off", phrase);
  }

  // --- Tone (casual/formal without it being about the greeting) ---
  if (!/greet/.test(f)) {
    if (/\b(more|be|sound|keep it)\s+(casual|relaxed|friendly|informal)\b/.test(f) || /\bcasual tone\b/.test(f))
      setField("tone", "casual", "tone", "casual");
    else if (/\b(more|be|sound|keep it)\s+(formal|professional|polished)\b/.test(f) || /\bformal tone\b/.test(f))
      setField("tone", "formal", "tone", "formal");
  }

  // --- Verbosity ---
  if (/\b(short(er)?|brief(er)?|concise|terse|to the point|tl;?dr|less wordy)\b/.test(f))
    setField("verbosity", "brief", "length", "brief");
  else if (/\b(detailed|longer|more detail|thorough|elaborate|in-?depth)\b/.test(f))
    setField("verbosity", "detailed", "length", "detailed");

  // --- Name ("sign as Fede", "my name is Fede", "call me Fede") ---
  const name = f.match(/\b(?:sign as|signed as|sign me as|my name is|call me)\s+["']?([a-z][a-z .'-]{0,30})/);
  if (name) {
    const nm = titleCase(name[1].trim().replace(/[.,!]+$/, ""));
    setField("name", nm, "name", nm);
  }

  // --- Personal facts ---
  const factMatch = raw.match(
    /\b(?:my title is(?: now)?|i['’]?m (?:a|an|the)?|i am (?:a|an|the)?|i work (?:at|for)|i'?m based in|i live in|remember that|note that|fyi[,:]?)\s+(.+)$/i
  );
  if (factMatch) {
    const fact = normalizeFact(raw);
    if (fact && !next.facts.includes(fact)) {
      next.facts = [...next.facts, fact];
      changes.push({ field: "fact", to: fact });
    }
  }

  // Nothing structured matched — keep the feedback as a remembered fact so it is
  // never silently dropped (mirrors the live tool storing free-form preferences).
  if (!changes.length && raw.length > 3) {
    const fact = raw.replace(/\s+/g, " ");
    next.facts = [...next.facts, fact];
    changes.push({ field: "fact", to: fact });
  }

  return { profile: next, changes };
}

// Turn a first-person sentence into a stored fact, trimming the lead-in verb.
function normalizeFact(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  // Title fact: keep the noun phrase.
  const title = cleaned.match(/my title is(?: now)?\s+(.+)/i);
  if (title) return `Title: ${title[1].trim()}`;
  const worksAt = cleaned.match(/i work (?:at|for)\s+(.+)/i);
  if (worksAt) return `Works at ${worksAt[1].trim()}`;
  const based = cleaned.match(/i(?:'|’)?m? (?:based in|live in)\s+(.+)/i);
  if (based) return `Based in ${based[1].trim()}`;
  const remember = cleaned.match(/(?:remember that|note that|fyi[,:]?)\s+(.+)/i);
  if (remember) return remember[1].trim();
  return cleaned;
}

export function removeFact(p: Personalization, fact: string): Personalization {
  return { ...p, facts: p.facts.filter((x) => x !== fact) };
}

// A short, human description of the active voice (for Settings / palette).
export function describeVoice(p: Personalization): string {
  const g =
    p.greetingStyle === "none"
      ? "no greeting"
      : p.greetingStyle === "casual"
      ? "Hey …"
      : p.greetingStyle === "formal"
      ? "Dear …"
      : "Hi …";
  return `${g} · ${p.tone} tone · ${p.verbosity} · ${p.signOff} ${p.name}`;
}
