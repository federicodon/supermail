import { describe, it, expect, vi } from "vitest";
import { email } from "./testEmail";
import { MockProvider, GmailProvider, MemoryTokenStore, createProvider } from "./provider";
import type { Draft } from "../types";
import { base64Url } from "./gmail";

const seed = [
  email({ id: "a", read: false, starred: false, labels: ["INBOX"] }),
  email({ id: "b", read: true, subject: "Budget review" }),
];
const draft: Draft = { id: "d", to: "x@y.com", subject: "Hi", body: "Body" };

describe("MockProvider parity surface", () => {
  it("lists, filters by query, and gets by id", async () => {
    const p = new MockProvider(seed);
    expect((await p.list()).length).toBe(2);
    expect((await p.list({ q: "budget" })).map((e) => e.id)).toEqual(["b"]);
    expect((await p.get("a"))?.id).toBe("a");
    expect(await p.get("nope")).toBeNull();
  });

  it("archive / setRead / setStar / modifyLabels mutate the store", async () => {
    const p = new MockProvider(seed);
    await p.archive("a");
    await p.setRead("a", true);
    await p.setStar("a", true);
    await p.modifyLabels("a", ["Clients"], ["INBOX"]);
    const a = await p.get("a");
    expect(a?.archived).toBe(true);
    expect(a?.read).toBe(true);
    expect(a?.starred).toBe(true);
    expect(a?.labels).toContain("Clients");
    expect(a?.labels).not.toContain("INBOX");
  });

  it("send is a LOCAL simulation that records an outbound message", async () => {
    const p = new MockProvider(seed);
    const res = await p.send(draft);
    expect(res.id).toMatch(/^sent-/);
    const all = await p.list();
    const sent = all.find((e) => e.id === res.id)!;
    expect(sent.outbound).toBe(true);
    expect(sent.archived).toBe(true); // not in inbox
  });

  it("createDraft returns a draft id without sending", async () => {
    const p = new MockProvider(seed);
    const res = await p.createDraft(draft);
    expect(res.id).toMatch(/^draft-/);
  });

  it("does not mutate the seed array passed in", async () => {
    const local = [email({ id: "z", archived: false })];
    const p = new MockProvider(local);
    await p.archive("z");
    expect(local[0].archived).toBe(false);
  });
});

describe("createProvider factory", () => {
  it("defaults to mock when Gmail is not fully configured", () => {
    const p = createProvider({
      gmail: { clientId: "", clientSecret: "", redirectUri: "", scopes: [], enabled: false, oauthFlow: "token" },
      seed,
    });
    expect(p.mode).toBe("mock");
  });

  it("uses Gmail only when enabled + clientId + tokens present", () => {
    const tokens = new MemoryTokenStore({ accessToken: "t", expiresAt: Date.now() + 3_600_000 });
    const p = createProvider({
      gmail: { clientId: "id", clientSecret: "", redirectUri: "", scopes: [], enabled: true, oauthFlow: "token" },
      seed,
      tokens,
    });
    expect(p.mode).toBe("gmail");
  });
});

describe("GmailProvider request execution", () => {
  const cfg = { clientId: "id", clientSecret: "", redirectUri: "http://cb", scopes: [], enabled: true, oauthFlow: "token" as const };
  const jsonResponse = (body: unknown) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
  const gmailMessage = (id: string, labelIds: string[]) => ({
    id,
    threadId: `t-${id}`,
    labelIds,
    snippet: `snippet ${id}`,
    internalDate: String(new Date("2026-06-06T09:00:00.000Z").getTime()),
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "Dana <dana@acme.io>" },
        { name: "To", value: "me@example.com" },
        { name: "Subject", value: `Subject ${id}` },
      ],
      body: { data: base64Url(`Body ${id}`) },
    },
  });

  it("archive issues a modify POST removing INBOX", async () => {
    const fetchSpy = vi.fn(async (..._a: unknown[]) => ({ ok: true, status: 200, text: async () => "{}" }));
    const tokens = new MemoryTokenStore({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 });
    const p = new GmailProvider(cfg, tokens, "me", fetchSpy as unknown as typeof fetch);
    await p.archive("m1");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/messages/m1/modify");
    expect(JSON.parse(String(init.body)).removeLabelIds).toContain("INBOX");
  });

  it("refreshes an expired token before a request", async () => {
    const fetchSpy = vi.fn(async (url: unknown): Promise<unknown> => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { ok: true, status: 200, text: async () => "{}", json: async () => ({ access_token: "new", expires_in: 3600 }) };
      }
      return { ok: true, status: 200, text: async () => "{}" };
    });
    const onSet = vi.fn();
    const tokens = new MemoryTokenStore(
      { accessToken: "old", refreshToken: "r", expiresAt: Date.now() - 1000 },
      onSet
    );
    const p = new GmailProvider(cfg, tokens, "me", fetchSpy as unknown as typeof fetch);
    await p.setRead("m1", true);
    expect(tokens.get()?.accessToken).toBe("new");
    expect(onSet).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "new" }));
  });

  it("paginates Gmail message ids and normalizes labels through the label map", async () => {
    const fetchSpy = vi.fn(async (url: unknown): Promise<unknown> => {
      const u = String(url);
      if (u.includes("/messages?") && u.includes("pageToken=PAGE2")) {
        return jsonResponse({ messages: [{ id: "m2" }] });
      }
      if (u.includes("/messages?")) {
        return jsonResponse({ messages: [{ id: "m1" }], nextPageToken: "PAGE2" });
      }
      if (u.includes("/labels")) {
        return jsonResponse({ labels: [{ id: "Label_1", name: "Clients/Acme", type: "user" }] });
      }
      if (u.includes("/messages/m1?")) return jsonResponse(gmailMessage("m1", ["INBOX", "Label_1"]));
      if (u.includes("/messages/m2?")) return jsonResponse(gmailMessage("m2", ["INBOX"]));
      throw new Error(`unexpected URL ${u}`);
    });
    const tokens = new MemoryTokenStore({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 });
    const p = new GmailProvider(cfg, tokens, "me@example.com", fetchSpy as unknown as typeof fetch);

    const messages = await p.list({ q: "in:anywhere", maxResults: 2 });

    expect(messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(messages[0].labels).toContain("Clients/Acme");
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("pageToken=PAGE2"))).toBe(true);
  });

  it("resolves user label names to Gmail label ids before modifying a message", async () => {
    const fetchSpy = vi.fn(async (url: unknown, _init?: RequestInit): Promise<unknown> => {
      if (String(url).includes("/labels")) {
        return jsonResponse({
          labels: [
            { id: "Label_1", name: "Clients", type: "user" },
            { id: "INBOX", name: "Inbox", type: "system" },
          ],
        });
      }
      return jsonResponse({});
    });
    const tokens = new MemoryTokenStore({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 });
    const p = new GmailProvider(cfg, tokens, "me", fetchSpy as unknown as typeof fetch);

    await p.modifyLabels("m1", ["Clients"], ["Inbox"]);

    const modifyCall = fetchSpy.mock.calls.find(([url]) => String(url).includes("/messages/m1/modify"));
    expect(modifyCall).toBeTruthy();
    const init = modifyCall?.[1] as RequestInit | undefined;
    expect(init).toBeTruthy();
    expect(JSON.parse(String(init!.body))).toEqual({
      addLabelIds: ["Label_1"],
      removeLabelIds: ["INBOX"],
    });
  });
});
