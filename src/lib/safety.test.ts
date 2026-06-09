import { describe, it, expect, vi } from "vitest";
import {
  assertNotSend,
  isSendUrl,
  SendBlockedError,
  stripSendScopes,
} from "./safety";
import { sendMessageRequest, createDraftRequest, GMAIL_ENDPOINTS } from "./gmail";
import { GmailProvider, MemoryTokenStore } from "./provider";
import type { Draft } from "../types";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const draft: Draft = { id: "d1", to: "a@b.com", subject: "Hi", body: "Body" };

describe("safety: send is permanently disabled", () => {
  it("flags every Gmail send endpoint shape", () => {
    expect(isSendUrl(`${API}/messages/send`)).toBe(true);
    expect(isSendUrl(`${API}/drafts/send`)).toBe(true);
    expect(isSendUrl(`${API}/drafts/r-123/send`)).toBe(true);
  });

  it("allows read/label/draft-create endpoints", () => {
    expect(isSendUrl(`${API}/messages?q=in:inbox`)).toBe(false);
    expect(isSendUrl(`${API}/messages/m1/modify`)).toBe(false);
    expect(isSendUrl(`${API}/drafts`)).toBe(false); // create draft is allowed
    expect(isSendUrl(`${API}/messages/m1`)).toBe(false);
  });

  it("assertNotSend throws SendBlockedError for send URLs", () => {
    expect(() => assertNotSend(`${API}/messages/send`)).toThrow(SendBlockedError);
    expect(() => assertNotSend(`${API}/drafts/x/send`)).toThrow(/disabled/i);
  });

  it("assertNotSend permits non-send URLs", () => {
    expect(() => assertNotSend(`${API}/drafts`)).not.toThrow();
    expect(() => assertNotSend(`${API}/messages/m1/modify`)).not.toThrow();
  });

  it("sendMessageRequest throws instead of building a request", () => {
    expect(() => sendMessageRequest("T", draft)).toThrow(SendBlockedError);
  });

  it("createDraftRequest stays allowed and targets /drafts (not /send)", () => {
    const r = createDraftRequest("T", draft);
    expect(r.url).toContain("/drafts");
    expect(isSendUrl(r.url)).toBe(false);
  });

  it("strips gmail.send from requested OAuth scopes", () => {
    const scopes = [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.send",
    ];
    const out = stripSendScopes(scopes);
    expect(out).toContain("https://www.googleapis.com/auth/gmail.modify");
    expect(out.some((s) => /gmail\.send/.test(s))).toBe(false);
  });

  it("GMAIL_ENDPOINTS marks send endpoints DISABLED", () => {
    expect(GMAIL_ENDPOINTS.send).toMatch(/DISABLED/);
    expect(GMAIL_ENDPOINTS.draftsSend).toMatch(/DISABLED/);
  });
});

describe("safety: GmailProvider can never send over the network", () => {
  const cfg = {
    clientId: "id",
    clientSecret: "",
    redirectUri: "http://localhost/cb",
    scopes: ["https://www.googleapis.com/auth/gmail.modify"],
    enabled: true,
    oauthFlow: "token" as const,
  };

  it("GmailProvider.send throws before touching fetch or tokens", async () => {
    const fetchSpy = vi.fn();
    const tokens = new MemoryTokenStore({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 });
    const provider = new GmailProvider(cfg, tokens, "me", fetchSpy as unknown as typeof fetch);
    await expect(provider.send(draft)).rejects.toBeInstanceOf(SendBlockedError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("createDraft IS allowed and issues exactly one non-send request", async () => {
    const fetchSpy = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "draft-1" }),
    }));
    const tokens = new MemoryTokenStore({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 });
    const provider = new GmailProvider(cfg, tokens, "me", fetchSpy as unknown as typeof fetch);
    const res = await provider.createDraft(draft);
    expect(res.id).toBe("draft-1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(isSendUrl(calledUrl)).toBe(false);
    expect(calledUrl).toContain("/drafts");
  });
});
