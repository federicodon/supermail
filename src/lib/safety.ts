// HARD SAFETY BOUNDARY — email sending is permanently disabled.
//
// SuperMail is allowed to read, list, search, label, archive and CREATE drafts
// against a Gmail account, but it must NEVER send mail. The Gmail send endpoints
// (`users.messages.send`, `users.drafts.send`, and any `sendAs` send alias) are
// blocked here at a single chokepoint so no code path — present or future — can
// reach them. Generated draft content is always left for a human to review and
// send manually from Gmail.
//
// This module is intentionally tiny, dependency-free, and unit-tested
// (`safety.test.ts`) so the guarantee is provable, not just documented.

// Gmail REST methods we refuse to ever call.
export const BLOCKED_SEND_ENDPOINTS = [
  "users.messages.send",
  "users.drafts.send",
] as const;

export class SendBlockedError extends Error {
  constructor(detail = "") {
    super(
      "SuperMail safety: email sending is permanently disabled" +
        (detail ? ` (${detail})` : "") +
        ". Create a draft and send it manually from Gmail."
    );
    this.name = "SendBlockedError";
  }
}

// Does a URL / path target a Gmail send endpoint?
//  - .../messages/send                      (users.messages.send)
//  - .../drafts/send  or  .../drafts/{id}/send  (users.drafts.send)
//  - .../settings/sendAs/{addr}  used with a send action
export function isSendUrl(url: string): boolean {
  return (
    /\/messages\/send\b/.test(url) ||
    /\/drafts\/send\b/.test(url) ||
    /\/drafts\/[^/]+\/send\b/.test(url)
  );
}

// Throw if a request URL would send mail. Called before every network request
// the Gmail provider makes, so the guarantee holds even if a builder is added.
export function assertNotSend(url: string): void {
  if (isSendUrl(url)) throw new SendBlockedError(url);
}

// We never even request OAuth scopes that grant send-only access. `gmail.modify`
// (needed for archive/label/draft) is kept; `gmail.send` is stripped so a
// least-privilege token is requested where the provider allows it.
export function stripSendScopes(scopes: string[]): string[] {
  return scopes.filter((s) => !/\bgmail\.send\b/.test(s));
}
