// Email signatures for Compose.
//
// The signature is a plain block the user edits in Settings. There is no
// separate on/off toggle — an empty signature simply means "don't add one", so
// the presence of text is the switch. When a signature exists we prepend a
// couple of blank lines (caret space for the message) and the RFC 3676 "-- "
// delimiter line, which is the conventional, machine-recognizable marker that
// what follows is a signature.
//
// Pure and React-free so the assembly is unit tested directly. AI-written
// drafts already carry a voiced sign-off (see personalization.ts) and therefore
// bypass these helpers to avoid double-signing.

export const SIGNATURE_DELIMITER = "-- ";

// The signature rendered as a delimited block, or "" when there's nothing to
// add. Leading/trailing whitespace is trimmed but internal newlines (multi-line
// signatures) are preserved.
export function signatureBlock(signature: string | undefined | null): string {
  const s = (signature ?? "").trim();
  return s ? `${SIGNATURE_DELIMITER}\n${s}` : "";
}

// Body for a brand-new, empty compose: blank caret lines, then the signature.
// With no signature the body stays empty (unchanged from a plain compose).
export function newComposeBody(signature: string | undefined | null): string {
  const sig = signatureBlock(signature);
  return sig ? `\n\n${sig}` : "";
}

// Body for a reply/forward: caret space at the top, the signature, then the
// quoted / forwarded text below it (Superhuman-style: you write above your
// signature, the original thread sits beneath). `quoted` should not include its
// own leading blank lines — this adds the spacing.
export function quotedComposeBody(quoted: string, signature: string | undefined | null): string {
  const sig = signatureBlock(signature);
  return sig ? `\n\n${sig}\n\n${quoted}` : `\n\n${quoted}`;
}

// Swap one account's signature block for another's in an in-progress draft —
// used when the user changes the "From" account mid-compose so the sign-off
// follows the chosen identity (a body edited by hand otherwise keeps its text).
// Targets the *last* occurrence so a reply's signature (which sits above the
// quoted thread) is replaced rather than any coincidental earlier match, and the
// quoted text underneath is left untouched. Returns the body unchanged when the
// two signatures are identical, when the old one was empty (nothing locatable to
// anchor on), or when the old block is no longer present (the user rewrote it).
export function swapSignature(
  body: string,
  oldSig: string | undefined | null,
  newSig: string | undefined | null
): string {
  const oldBlock = signatureBlock(oldSig);
  const newBlock = signatureBlock(newSig);
  if (oldBlock === newBlock) return body;
  if (!oldBlock) return body;
  const idx = body.lastIndexOf(oldBlock);
  if (idx === -1) return body;
  return body.slice(0, idx) + newBlock + body.slice(idx + oldBlock.length);
}
