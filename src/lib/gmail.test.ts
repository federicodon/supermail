import { describe, it, expect } from "vitest";
import type { Draft } from "../types";
import {
  base64Url,
  base64UrlBytes,
  decodeBase64Url,
  generateCodeVerifier,
  pkceChallenge,
  createPkceSession,
  buildAuthUrl,
  buildTokenAuthUrl,
  verifyState,
  isTokenExpired,
  exchangeCodeForTokens,
  refreshAccessToken,
  getProfileRequest,
  listLabelsRequest,
  listMessagesRequest,
  getMessageRequest,
  modifyMessageRequest,
  archiveRequest,
  markReadRequest,
  trashRequest,
  buildRawMessage,
  sendMessageRequest,
  createDraftRequest,
  gmailLabelMaps,
  normalizeMessage,
  normalizeMessageWithLabels,
  parseAddressList,
  type GmailConfig,
  type GmailMessage,
} from "./gmail";

const CFG: GmailConfig = {
  clientId: "client-123.apps.googleusercontent.com",
  clientSecret: "",
  redirectUri: "http://localhost:5273/oauth2/callback",
  scopes: ["https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.send"],
  enabled: true,
  oauthFlow: "token",
};

describe("base64url", () => {
  it("encodes/decodes round-trip and is URL-safe", () => {
    const s = "Hello, wörld! <a@b.com> ?&=";
    const enc = base64Url(s);
    expect(enc).not.toMatch(/[+/=]/);
    expect(decodeBase64Url(enc)).toBe(s);
  });

  it("matches a known vector for bytes", () => {
    // bytes for "foobar" -> base64 "Zm9vYmFy"
    expect(base64UrlBytes(new TextEncoder().encode("foobar"))).toBe("Zm9vYmFy");
  });
});

describe("PKCE", () => {
  it("verifier uses only unreserved chars and a valid length", () => {
    const v = generateCodeVerifier(64);
    expect(v.length).toBe(64);
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("clamps verifier length to 43..128", () => {
    expect(generateCodeVerifier(10).length).toBe(43);
    expect(generateCodeVerifier(999).length).toBe(128);
  });

  it("derives the RFC 7636 S256 challenge", async () => {
    // RFC 7636 Appendix B test vector.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await pkceChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("builds a session with distinct state/nonce", async () => {
    const s = await createPkceSession();
    expect(s.verifier.length).toBeGreaterThanOrEqual(43);
    expect(s.challenge.length).toBeGreaterThan(0);
    expect(s.state).not.toBe(s.nonce);
  });
});

describe("auth url + state", () => {
  it("includes PKCE challenge + method + state", () => {
    const url = new URL(buildAuthUrl(CFG, "state-xyz", { challenge: "CH", nonce: "N" }));
    expect(url.searchParams.get("code_challenge")).toBe("CH");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("state-xyz");
    expect(url.searchParams.get("nonce")).toBe("N");
    expect(url.searchParams.get("scope")).toContain("gmail.modify");
  });

  it("omits PKCE params when not supplied", () => {
    const url = new URL(buildAuthUrl(CFG, "s"));
    expect(url.searchParams.get("code_challenge")).toBeNull();
  });

  it("builds a browser token flow URL without PKCE or client secret", () => {
    const url = new URL(buildTokenAuthUrl({ ...CFG, targetEmail: "me@example.com" }, "state-xyz"));
    expect(url.searchParams.get("response_type")).toBe("token");
    expect(url.searchParams.get("state")).toBe("state-xyz");
    expect(url.searchParams.get("login_hint")).toBe("me@example.com");
    expect(url.searchParams.get("code_challenge")).toBeNull();
    expect(url.searchParams.get("client_secret")).toBeNull();
  });

  it("verifyState rejects mismatches and empties", () => {
    expect(verifyState("abc", "abc")).toBe(true);
    expect(verifyState("abc", "xyz")).toBe(false);
    expect(verifyState("", "")).toBe(false);
    expect(verifyState("abc", null)).toBe(false);
  });
});

describe("token expiry", () => {
  it("treats tokens within skew as expired", () => {
    const now = 1_000_000;
    expect(isTokenExpired({ accessToken: "a", expiresAt: now + 30_000 }, now)).toBe(true);
    expect(isTokenExpired({ accessToken: "a", expiresAt: now + 120_000 }, now)).toBe(false);
  });
});

describe("token endpoint errors", () => {
  it("surfaces Google's token exchange error body", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: "invalid_client", error_description: "Unauthorized" }), {
        status: 400,
      });

    await expect(
      exchangeCodeForTokens(CFG, "code", "verifier", Date.now(), fetchImpl as typeof fetch)
    ).rejects.toThrow("invalid_client: Unauthorized");
  });

  it("surfaces Google's token refresh error body", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: "invalid_grant", error_description: "Bad Request" }), {
        status: 400,
      });

    await expect(
      refreshAccessToken(CFG, "refresh", Date.now(), fetchImpl as typeof fetch)
    ).rejects.toThrow("invalid_grant: Bad Request");
  });
});

describe("REST request builders", () => {
  const T = "ACCESS";
  it("lists with query + labels", () => {
    const r = listMessagesRequest(T, { q: "in:inbox is:unread", labelIds: ["INBOX"], maxResults: 25 });
    expect(r.method).toBe("GET");
    expect(r.url).toContain("q=in%3Ainbox+is%3Aunread");
    expect(r.url).toContain("labelIds=INBOX");
    expect(r.url).toContain("maxResults=25");
    expect(r.headers.Authorization).toBe("Bearer ACCESS");
  });

  it("gets the authorized Gmail profile", () => {
    const r = getProfileRequest(T);
    expect(r.method).toBe("GET");
    expect(r.url).toContain("/profile");
    expect(r.headers.Authorization).toBe("Bearer ACCESS");
  });

  it("lists Gmail labels", () => {
    const r = listLabelsRequest(T);
    expect(r.method).toBe("GET");
    expect(r.url).toContain("/labels");
    expect(r.headers.Authorization).toBe("Bearer ACCESS");
  });

  it("gets a message", () => {
    expect(getMessageRequest(T, "m1").url).toContain("/messages/m1?format=full");
  });

  it("archive removes INBOX", () => {
    const r = archiveRequest(T, "m1");
    expect(JSON.parse(r.body!)).toEqual({ addLabelIds: [], removeLabelIds: ["INBOX"] });
  });

  it("mark read toggles UNREAD correctly", () => {
    expect(JSON.parse(markReadRequest(T, "m1", true).body!).removeLabelIds).toContain("UNREAD");
    expect(JSON.parse(markReadRequest(T, "m1", false).body!).addLabelIds).toContain("UNREAD");
  });

  it("modify carries add/remove", () => {
    const r = modifyMessageRequest(T, "m1", ["Clients"], ["INBOX"]);
    expect(JSON.parse(r.body!)).toEqual({ addLabelIds: ["Clients"], removeLabelIds: ["INBOX"] });
    expect(r.headers["Content-Type"]).toBe("application/json");
  });

  it("trash posts to the trash endpoint", () => {
    expect(trashRequest(T, "m1").url).toContain("/messages/m1/trash");
  });
});

describe("RFC822 build + send/draft", () => {
  const draft: Draft = {
    id: "d1",
    to: "dana@acme.io",
    cc: "team@x.com",
    subject: "Hi",
    body: "Line one\nLine two",
    inReplyTo: "<orig@mail>",
  };

  it("encodes headers + body as decodable base64url", () => {
    const raw = buildRawMessage(draft);
    const decoded = decodeBase64Url(raw);
    expect(decoded).toContain("To: dana@acme.io");
    expect(decoded).toContain("Cc: team@x.com");
    expect(decoded).toContain("Subject: Hi");
    expect(decoded).toContain("In-Reply-To: <orig@mail>");
    expect(decoded).toContain("Line one");
  });

  it("send is permanently blocked (never builds a request)", () => {
    // SAFETY: users.messages.send must be impossible to call.
    expect(() => sendMessageRequest("T", draft, "thread-9")).toThrow(/disabled/i);
  });

  it("createDraft nests the message", () => {
    const r = createDraftRequest("T", draft);
    expect(JSON.parse(r.body!).message.raw).toBeTruthy();
    expect(r.url).toContain("/drafts");
  });
});

describe("normalizeMessage", () => {
  const msg: GmailMessage = {
    id: "m1",
    threadId: "t1",
    labelIds: ["INBOX", "UNREAD", "IMPORTANT", "STARRED"],
    snippet: "hello there",
    internalDate: String(new Date("2026-06-01T10:00:00Z").getTime()),
    payload: {
      mimeType: "multipart/alternative",
      headers: [
        { name: "From", value: "Dana Whitfield <dana@acme.io>" },
        { name: "To", value: "you@example.com" },
        { name: "Subject", value: "Roadmap" },
      ],
      parts: [{ mimeType: "text/plain", body: { data: base64Url("Full body text.") } }],
    },
  };

  it("maps headers, labels, read/star/important", () => {
    const e = normalizeMessage(msg, "you@example.com");
    expect(e.from).toEqual({ name: "Dana Whitfield", email: "dana@acme.io" });
    expect(e.subject).toBe("Roadmap");
    expect(e.body).toBe("Full body text.");
    expect(e.read).toBe(false); // UNREAD present
    expect(e.starred).toBe(true);
    expect(e.category).toBe("important");
    expect(e.archived).toBe(false); // INBOX present
  });

  it("treats missing INBOX as archived and missing UNREAD as read", () => {
    const e = normalizeMessage({ ...msg, labelIds: ["IMPORTANT"] }, "you@example.com");
    expect(e.archived).toBe(true);
    expect(e.read).toBe(true);
  });

  it("parses address lists with quoted commas", () => {
    expect(parseAddressList('"Dana, Ops" <dana@acme.io>, Sam <sam@acme.io>, solo@example.com')).toEqual([
      { name: "Dana, Ops", email: "dana@acme.io" },
      { name: "Sam", email: "sam@acme.io" },
      { name: "solo@example.com", email: "solo@example.com" },
    ]);
  });

  it("maps Gmail label ids to display names", () => {
    const { idToName, nameToId } = gmailLabelMaps([
      { id: "Label_7", name: "Clients/Acme", type: "user" },
      { id: "INBOX", name: "Inbox", type: "system" },
    ]);
    expect(nameToId.get("clients/acme")).toBe("Label_7");

    const e = normalizeMessageWithLabels(
      { ...msg, labelIds: ["INBOX", "Label_7"] },
      "you@example.com",
      idToName
    );
    expect(e.labels).toEqual(["Inbox", "Clients/Acme"]);
  });

  it("extracts cc, list-unsubscribe, one-click support, and attachment names", () => {
    const e = normalizeMessage({
      ...msg,
      labelIds: ["INBOX"],
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "From", value: "Dana Whitfield <dana@acme.io>" },
          { name: "To", value: '"You, Growth" <you@example.com>, ops@example.com' },
          { name: "Cc", value: "Team <team@acme.io>" },
          { name: "Subject", value: "Files" },
          { name: "List-Unsubscribe", value: "<https://example.com/unsub>, <mailto:u@example.com>" },
          { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
        ],
        parts: [
          { mimeType: "text/plain", body: { data: base64Url("Body") } },
          { mimeType: "application/pdf", filename: "deck.pdf", body: {} },
        ],
      },
    });
    expect(e.to).toEqual([
      { name: "You, Growth", email: "you@example.com" },
      { name: "ops@example.com", email: "ops@example.com" },
    ]);
    expect(e.cc).toEqual([{ name: "Team", email: "team@acme.io" }]);
    expect(e.listUnsubscribe).toContain("https://example.com/unsub");
    expect(e.listUnsubscribePost).toBe(true);
    expect(e.attachments).toEqual(["deck.pdf"]);
  });
});
