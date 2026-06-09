import { describe, it, expect } from "vitest";
import {
  SIGNATURE_DELIMITER,
  signatureBlock,
  newComposeBody,
  quotedComposeBody,
  swapSignature,
} from "./signature";

describe("signatureBlock", () => {
  it("wraps a signature with the RFC 3676 delimiter line", () => {
    expect(signatureBlock("Best,\nFederico")).toBe(`${SIGNATURE_DELIMITER}\nBest,\nFederico`);
  });

  it("treats empty / whitespace / nullish as no signature", () => {
    expect(signatureBlock("")).toBe("");
    expect(signatureBlock("   \n  ")).toBe("");
    expect(signatureBlock(undefined)).toBe("");
    expect(signatureBlock(null)).toBe("");
  });

  it("trims outer whitespace but preserves internal newlines", () => {
    expect(signatureBlock("  Cheers,\nFede  ")).toBe(`${SIGNATURE_DELIMITER}\nCheers,\nFede`);
  });
});

describe("newComposeBody", () => {
  it("gives caret space then the signature", () => {
    expect(newComposeBody("Best,\nFederico")).toBe(`\n\n${SIGNATURE_DELIMITER}\nBest,\nFederico`);
  });

  it("is empty when there is no signature (plain compose)", () => {
    expect(newComposeBody("")).toBe("");
    expect(newComposeBody(undefined)).toBe("");
  });
});

describe("quotedComposeBody", () => {
  const quote = "On Jan 1, Dana wrote:\n> hello";

  it("places the signature above the quoted text", () => {
    expect(quotedComposeBody(quote, "Best,\nFederico")).toBe(
      `\n\n${SIGNATURE_DELIMITER}\nBest,\nFederico\n\n${quote}`
    );
  });

  it("falls back to just the quote when there is no signature", () => {
    expect(quotedComposeBody(quote, "")).toBe(`\n\n${quote}`);
  });
});

describe("swapSignature", () => {
  it("swaps the signature block in a new compose body", () => {
    const body = newComposeBody("Best,\nW");
    expect(swapSignature(body, "Best,\nW", "— P")).toBe(newComposeBody("— P"));
  });

  it("swaps the reply signature while leaving the quoted thread intact", () => {
    const quote = "On Jan 1, Dana wrote:\n> hello";
    const body = quotedComposeBody(quote, "Best,\nW");
    expect(swapSignature(body, "Best,\nW", "Cheers,\nP")).toBe(quotedComposeBody(quote, "Cheers,\nP"));
  });

  it("targets the last block so a sign-off, not an earlier match, is replaced", () => {
    // The user typed the old signature text in the body *and* it's the real sig.
    const body = `Best,\nW in the body\n\n${SIGNATURE_DELIMITER}\nBest,\nW`;
    const out = swapSignature(body, "Best,\nW", "X");
    expect(out).toBe(`Best,\nW in the body\n\n${SIGNATURE_DELIMITER}\nX`);
  });

  it("returns the body unchanged when nothing should move", () => {
    const body = quotedComposeBody("q", "Best,\nW");
    // identical signatures
    expect(swapSignature(body, "Best,\nW", "Best,\nW")).toBe(body);
    // empty old signature: nothing locatable to anchor on
    expect(swapSignature(body, "", "New")).toBe(body);
    // old block no longer present (the user rewrote their sign-off)
    expect(swapSignature("hand written, no sig", "Best,\nW", "New")).toBe("hand written, no sig");
  });
});
