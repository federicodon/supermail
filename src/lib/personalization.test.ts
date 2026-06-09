import { describe, it, expect } from "vitest";
import {
  DEFAULT_PERSONALIZATION,
  resolvePersonalization,
  greeting,
  signatureLines,
  composeBody,
  updatePersonalization,
  removeFact,
  describeVoice,
} from "./personalization";

describe("greeting + signature", () => {
  it("renders each greeting style", () => {
    expect(greeting({ ...DEFAULT_PERSONALIZATION, greetingStyle: "neutral" }, "Dana")).toBe("Hi Dana,");
    expect(greeting({ ...DEFAULT_PERSONALIZATION, greetingStyle: "casual" }, "Dana")).toBe("Hey Dana,");
    expect(greeting({ ...DEFAULT_PERSONALIZATION, greetingStyle: "formal" }, "Dana")).toBe("Dear Dana,");
    expect(greeting({ ...DEFAULT_PERSONALIZATION, greetingStyle: "none" }, "Dana")).toBe("");
    expect(greeting(DEFAULT_PERSONALIZATION, "")).toBe("Hi there,");
  });

  it("signatureLines uses sign-off + name", () => {
    expect(signatureLines(DEFAULT_PERSONALIZATION)).toEqual(["Best,", "Federico"]);
    expect(signatureLines({ ...DEFAULT_PERSONALIZATION, signOff: "Cheers,", name: "Fede" })).toEqual([
      "Cheers,",
      "Fede",
    ]);
  });

  it("composeBody assembles greeting + paragraphs + sign-off, skipping empty greeting", () => {
    const body = composeBody(DEFAULT_PERSONALIZATION, "Dana", ["First line.", "Second line."]);
    expect(body).toContain("Hi Dana,");
    expect(body).toContain("First line.");
    expect(body).toContain("Second line.");
    expect(body.trim().endsWith("Federico")).toBe(true);

    const noGreet = composeBody({ ...DEFAULT_PERSONALIZATION, greetingStyle: "none" }, "Dana", ["Body."]);
    expect(noGreet.startsWith("Body.")).toBe(true);
  });
});

describe("resolvePersonalization", () => {
  it("fills defaults and tolerates partial / bad input", () => {
    expect(resolvePersonalization()).toEqual(DEFAULT_PERSONALIZATION);
    expect(resolvePersonalization({ name: "Fede" }).name).toBe("Fede");
    // bad facts shape falls back to default empty array
    expect(resolvePersonalization({ facts: undefined }).facts).toEqual([]);
  });
});

describe("updatePersonalization (natural-language feedback)", () => {
  it("learns a casual greeting preference", () => {
    const { profile, changes } = updatePersonalization(
      DEFAULT_PERSONALIZATION,
      "I prefer casual greetings like Hey instead of Dear"
    );
    expect(profile.greetingStyle).toBe("casual");
    expect(changes.some((c) => c.field === "greeting")).toBe(true);
  });

  it("learns formal and none greeting styles", () => {
    expect(
      updatePersonalization(DEFAULT_PERSONALIZATION, "Please use formal greetings (Dear)").profile
        .greetingStyle
    ).toBe("formal");
    expect(
      updatePersonalization(DEFAULT_PERSONALIZATION, "No greeting, just get to the point").profile
        .greetingStyle
    ).toBe("none");
  });

  it("captures a custom sign-off", () => {
    const { profile } = updatePersonalization(DEFAULT_PERSONALIZATION, "Sign off with Cheers");
    expect(profile.signOff).toBe("Cheers,");
  });

  it("adjusts verbosity and tone", () => {
    expect(updatePersonalization(DEFAULT_PERSONALIZATION, "I like shorter emails").profile.verbosity).toBe(
      "brief"
    );
    expect(
      updatePersonalization(DEFAULT_PERSONALIZATION, "Make my emails more detailed").profile.verbosity
    ).toBe("detailed");
    expect(updatePersonalization(DEFAULT_PERSONALIZATION, "Be more formal").profile.tone).toBe("formal");
    expect(updatePersonalization(DEFAULT_PERSONALIZATION, "keep it casual and friendly").profile.tone).toBe(
      "casual"
    );
  });

  it("learns the user's name", () => {
    expect(updatePersonalization(DEFAULT_PERSONALIZATION, "Sign as Fede").profile.name).toBe("Fede");
    expect(updatePersonalization(DEFAULT_PERSONALIZATION, "My name is Federica").profile.name).toBe(
      "Federica"
    );
  });

  it("stores personal facts", () => {
    const a = updatePersonalization(DEFAULT_PERSONALIZATION, "My title is now VP of Engineering");
    expect(a.profile.facts.some((x) => /VP of Engineering/i.test(x))).toBe(true);

    const b = updatePersonalization(DEFAULT_PERSONALIZATION, "Remember that I'm based in Lisbon");
    expect(b.profile.facts.some((x) => /Lisbon/i.test(x))).toBe(true);
  });

  it("never silently drops unmatched feedback (keeps it as a fact)", () => {
    const { profile, changes } = updatePersonalization(
      DEFAULT_PERSONALIZATION,
      "I always loop in my assistant Jordan on scheduling"
    );
    expect(changes.length).toBeGreaterThan(0);
    expect(profile.facts.length).toBe(1);
  });

  it("removeFact + describeVoice", () => {
    const withFact = { ...DEFAULT_PERSONALIZATION, facts: ["Title: VP"] };
    expect(removeFact(withFact, "Title: VP").facts).toEqual([]);
    expect(describeVoice(DEFAULT_PERSONALIZATION)).toContain("Hi");
  });
});
