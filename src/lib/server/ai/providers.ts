/**
 * Text AI providers behind one small interface. Pure: env and fetch are
 * passed in, so tests run with mocks and nothing here reaches a browser
 * bundle (only server routes import it). Model names always come from
 * configuration — no hard-coded model that may disappear.
 */
import type { ChatTurn } from "@shared/companionContext";

export type ProviderId =
  "adaption" | "gemini" | "openai" | "groq" | "openrouter";
export const ALL_PROVIDERS: readonly ProviderId[] = [
  "adaption",
  "gemini",
  "openai",
  "groq",
  "openrouter",
];

export type ErrorCategory =
  | "auth"
  | "rate_limit"
  | "timeout"
  | "server"
  | "bad_request"
  | "network"
  | "empty"
  | "not_configured";

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderId,
    readonly category: ErrorCategory,
  ) {
    super(`${provider}:${category}`);
  }
  get retryable(): boolean {
    return (
      this.category === "rate_limit" ||
      this.category === "server" ||
      this.category === "timeout" ||
      this.category === "network"
    );
  }
}

export interface GenerateInput {
  turns: readonly ChatTurn[];
  systemInstruction: string;
  maxOutputTokens: number;
  temperature: number;
}

export interface AIProvider {
  id: ProviderId;
  model: string;
  generate(input: GenerateInput, signal: AbortSignal): Promise<string>;
}

export type Env = Record<string, string | undefined>;
export type Fetch = typeof fetch;

const statusCategory = (status: number): ErrorCategory =>
  status === 401 || status === 403
    ? "auth"
    : status === 429
      ? "rate_limit"
      : status >= 500
        ? "server"
        : "bad_request";

async function postJson(
  id: ProviderId,
  f: Fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  let res: Response;
  try {
    res = await f(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    throw new ProviderError(
      id,
      signal.aborted ||
        (e instanceof Error &&
          (e.name === "AbortError" || e.name === "TimeoutError"))
        ? "timeout"
        : "network",
    );
  }
  if (!res.ok) throw new ProviderError(id, statusCategory(res.status));
  try {
    return await res.json();
  } catch {
    throw new ProviderError(id, "empty");
  }
}

const nonEmpty = (id: ProviderId, text: unknown): string => {
  if (typeof text !== "string" || !text.trim())
    throw new ProviderError(id, "empty");
  return text.trim();
};

/** OpenAI-compatible Chat Completions (OpenAI, Groq, OpenRouter). */
function chatCompletions(
  id: ProviderId,
  url: string,
  key: string,
  model: string,
  f: Fetch,
  extraHeaders: Record<string, string> = {},
): AIProvider {
  return {
    id,
    model,
    async generate(input, signal) {
      const data = (await postJson(
        id,
        f,
        url,
        { authorization: `Bearer ${key}`, ...extraHeaders },
        {
          model,
          temperature: input.temperature,
          max_tokens: input.maxOutputTokens,
          messages: [
            { role: "system", content: input.systemInstruction },
            ...input.turns.map((t) => ({
              role: t.role === "model" ? "assistant" : "user",
              content: t.text,
            })),
          ],
        },
        signal,
      )) as { choices?: { message?: { content?: unknown } }[] };
      return nonEmpty(id, data.choices?.[0]?.message?.content);
    },
  };
}

/** Adaption Labs: OpenAI-compatible Responses API. */
function adaption(env: Env, f: Fetch): AIProvider | null {
  const key = env.ADAPTION_API_KEY;
  const model = env.ADAPTION_MODEL;
  if (!key || !model) return null;
  const base = (
    env.ADAPTION_BASE_URL || "https://api.prod.adaptionlabs.ai/api/v1"
  ).replace(/\/+$/, "");
  return {
    id: "adaption",
    model,
    async generate(input, signal) {
      const data = (await postJson(
        "adaption",
        f,
        `${base}/responses`,
        { authorization: `Bearer ${key}` },
        {
          model,
          instructions: input.systemInstruction,
          temperature: input.temperature,
          max_output_tokens: input.maxOutputTokens,
          input: input.turns.map((t) => ({
            role: t.role === "model" ? "assistant" : "user",
            content: t.text,
          })),
        },
        signal,
      )) as {
        output_text?: unknown;
        output?: { content?: { type?: string; text?: unknown }[] }[];
      };
      if (typeof data.output_text === "string")
        return nonEmpty("adaption", data.output_text);
      const text = (data.output ?? [])
        .flatMap((o) => o.content ?? [])
        .filter((c) => typeof c.text === "string")
        .map((c) => c.text as string)
        .join("");
      return nonEmpty("adaption", text);
    },
  };
}

/** Gemini REST generateContent (key sent in a header, never in the URL). */
function gemini(env: Env, f: Fetch): AIProvider | null {
  const key = env.GEMINI_API_KEY;
  if (!key) return null;
  const model =
    env.AI_MODEL_GEMINI || env.GEMINI_MODEL || "gemini-flash-latest";
  return {
    id: "gemini",
    model,
    async generate(input, signal) {
      const data = (await postJson(
        "gemini",
        f,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { "x-goog-api-key": key },
        {
          systemInstruction: { parts: [{ text: input.systemInstruction }] },
          contents: input.turns.map((t) => ({
            role: t.role,
            parts: [{ text: t.text }],
          })),
          generationConfig: {
            temperature: input.temperature,
            maxOutputTokens: input.maxOutputTokens,
          },
        },
        signal,
      )) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
      return nonEmpty(
        "gemini",
        (data.candidates?.[0]?.content?.parts ?? [])
          .map((p) => (typeof p.text === "string" ? p.text : ""))
          .join(""),
      );
    },
  };
}

/** Builds every provider that has both a key and a model configured. */
export function buildProviders(
  env: Env,
  f: Fetch,
): Map<ProviderId, AIProvider> {
  const out = new Map<ProviderId, AIProvider>();
  const add = (p: AIProvider | null) => p && out.set(p.id, p);
  add(adaption(env, f));
  add(gemini(env, f));
  if (env.OPENAI_API_KEY && env.AI_MODEL_OPENAI)
    add(
      chatCompletions(
        "openai",
        "https://api.openai.com/v1/chat/completions",
        env.OPENAI_API_KEY,
        env.AI_MODEL_OPENAI,
        f,
      ),
    );
  if (env.GROQ_API_KEY && env.AI_MODEL_GROQ)
    add(
      chatCompletions(
        "groq",
        "https://api.groq.com/openai/v1/chat/completions",
        env.GROQ_API_KEY,
        env.AI_MODEL_GROQ,
        f,
      ),
    );
  if (env.OPENROUTER_API_KEY && env.AI_MODEL_OPENROUTER)
    add(
      chatCompletions(
        "openrouter",
        "https://openrouter.ai/api/v1/chat/completions",
        env.OPENROUTER_API_KEY,
        env.AI_MODEL_OPENROUTER,
        f,
        { "x-title": "Pookie" },
      ),
    );
  return out;
}

const asIds = (v: string | undefined): ProviderId[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderId =>
      (ALL_PROVIDERS as readonly string[]).includes(s),
    );

/** AI_PROVIDER_ORDER, or AI_PRIMARY_PROVIDER + AI_FALLBACK_PROVIDERS; default Adaption → Gemini → OpenAI → Groq → OpenRouter. */
export function providerOrder(env: Env): ProviderId[] {
  const explicit = asIds(env.AI_PROVIDER_ORDER);
  const pieced = [
    ...asIds(env.AI_PRIMARY_PROVIDER),
    ...asIds(env.AI_FALLBACK_PROVIDERS),
  ];
  const order = explicit.length
    ? explicit
    : pieced.length
      ? pieced
      : [...ALL_PROVIDERS];
  return [...new Set(order)];
}

/** Providers the elder's LifeBook facts may be sent to. Others get Pookie's safety rules only. Default: adaption, gemini. */
export function lifebookProviders(env: Env): Set<ProviderId> {
  const list =
    env.AI_LIFEBOOK_PROVIDERS === undefined
      ? ["adaption", "gemini"]
      : asIds(env.AI_LIFEBOOK_PROVIDERS);
  return new Set(list as ProviderId[]);
}
