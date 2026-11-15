import { describe, expect, it, vi } from "vitest";
import { AIProviderManager, NoProviderError } from "@/lib/server/ai/manager";
import { buildProviders, providerOrder } from "@/lib/server/ai/providers";

const ALL = {
  ADAPTION_API_KEY: "ad-secret",
  ADAPTION_MODEL: "adaption-model",
  GEMINI_API_KEY: "gm-secret",
  OPENAI_API_KEY: "oa-secret",
  AI_MODEL_OPENAI: "openai-model",
  GROQ_API_KEY: "gq-secret",
  AI_MODEL_GROQ: "groq-model",
  OPENROUTER_API_KEY: "or-secret",
  AI_MODEL_OPENROUTER: "router-model",
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const okBody = (url: string): unknown =>
  url.includes("adaptionlabs") ? { output: [{ content: [{ type: "output_text", text: "hello from adaption" }] }] } : url.includes("generativelanguage") ? { candidates: [{ content: { parts: [{ text: "hello from gemini" }] } }] } : { choices: [{ message: { content: `hello from ${new URL(url).host}` } }] };

/** fail: host substring → status (or "timeout"/"network"). */
function mockFetch(fail: Record<string, number | "timeout" | "network">) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const rule = Object.entries(fail).find(([k]) => url.includes(k))?.[1];
    if (rule === "network") throw new TypeError("fetch failed");
    if (rule === "timeout") {
      const e = new Error("timed out");
      e.name = "TimeoutError";
      throw e;
    }
    if (typeof rule === "number") return json(rule, { error: { message: "secret detail" } });
    void init;
    return json(200, okBody(url));
  });
}
const input = { turns: [{ role: "user" as const, text: "hi" }], personal: "PERSONAL", plain: "PLAIN", temperature: 0.5, maxOutputTokens: 50 };
const fast = { sleep: async () => undefined, timeoutMs: 1000 };

describe("AI provider manager", () => {
  it("uses Adaption first by default (Responses API, bearer auth)", async () => {
    const f = mockFetch({});
    const r = await new AIProviderManager(ALL, f, fast).reply(input);
    expect(r.provider).toBe("adaption");
    expect(r.text).toBe("hello from adaption");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.prod.adaptionlabs.ai/api/v1/responses");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer ad-secret");
    expect(JSON.parse(String(init.body)).instructions).toBe("PERSONAL");
  });

  it("falls back Adaption → Gemini → OpenAI → Groq → OpenRouter", async () => {
    const r1 = await new AIProviderManager(ALL, mockFetch({ adaptionlabs: 500 }), fast).reply(input);
    expect(r1.provider).toBe("gemini");
    const r2 = await new AIProviderManager(ALL, mockFetch({ adaptionlabs: 401, generativelanguage: 429, "api.openai.com": "timeout" }), fast).reply(input);
    expect(r2.provider).toBe("groq");
    expect(r2.skipped.map((s) => s.category)).toEqual(["auth", "rate_limit", "timeout"]);
    const r3 = await new AIProviderManager(ALL, mockFetch({ adaptionlabs: 401, generativelanguage: 401, "api.openai.com": 401, groq: "network" }), fast).reply(input);
    expect(r3.provider).toBe("openrouter");
  });

  it("retries a retryable error a bounded number of times, never an auth error", async () => {
    const f = mockFetch({ adaptionlabs: 503, generativelanguage: 401, "api.openai.com": 401, groq: 401, openrouter: 401 });
    await expect(new AIProviderManager(ALL, f, fast).reply(input)).rejects.toBeInstanceOf(NoProviderError);
    const hits = (host: string) => f.mock.calls.filter(([u]) => String(u).includes(host)).length;
    expect(hits("adaptionlabs")).toBe(2);
    expect(hits("generativelanguage")).toBe(1);
  });

  it("reports all providers down without leaking keys or provider messages", async () => {
    const f = mockFetch({ adaptionlabs: 500, generativelanguage: 500, "api.openai.com": 500, groq: 500, openrouter: 500 });
    const err = await new AIProviderManager(ALL, f, fast).reply(input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NoProviderError);
    const text = JSON.stringify((err as NoProviderError).skipped) + String((err as Error).message);
    for (const secret of Object.values(ALL).filter((v) => v.includes("secret"))) expect(text).not.toContain(secret);
    expect(text).not.toContain("secret detail");
  });

  it("only sends LifeBook facts to allowed providers", async () => {
    const f = mockFetch({ adaptionlabs: 401, generativelanguage: 401 });
    await new AIProviderManager(ALL, f, fast).reply(input);
    const openai = f.mock.calls.find(([u]) => String(u).includes("openai"));
    expect(JSON.parse(String((openai?.[1] as RequestInit).body)).messages[0].content).toBe("PLAIN");
  });

  it("follows configured order and skips unconfigured providers", () => {
    expect(providerOrder({ AI_PRIMARY_PROVIDER: "groq", AI_FALLBACK_PROVIDERS: "gemini, bogus" })).toEqual(["groq", "gemini"]);
    expect(new AIProviderManager({ GEMINI_API_KEY: "k", AI_PROVIDER_ORDER: "openai,gemini" }, mockFetch({})).order).toEqual(["gemini"]);
    expect(new AIProviderManager({}, mockFetch({})).configured).toBe(false);
    // A key without a configured model is not used (no hard-coded models).
    expect([...buildProviders({ OPENAI_API_KEY: "k", ADAPTION_API_KEY: "k" }, mockFetch({})).keys()]).toEqual([]);
  });
});
