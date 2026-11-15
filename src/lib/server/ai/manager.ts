import {
  ProviderError,
  buildProviders,
  lifebookProviders,
  providerOrder,
  type AIProvider,
  type Env,
  type ErrorCategory,
  type Fetch,
  type GenerateInput,
  type ProviderId,
} from "./providers";

export interface ProviderHealth {
  id: ProviderId;
  model: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCategory: ErrorCategory | null;
}

export interface ManagerOptions {
  timeoutMs?: number;
  /** Extra attempts for a retryable error on the same provider. Bounded. */
  retries?: number;
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface Reply {
  text: string;
  provider: ProviderId;
  model: string;
  /** Providers tried before this one, with why they failed. */
  skipped: { provider: ProviderId; category: ErrorCategory }[];
}

export class NoProviderError extends Error {
  constructor(readonly skipped: Reply["skipped"]) {
    super("no-provider");
  }
}

/** Per-instance health (best effort; serverless instances don't share it). */
const health = new Map<ProviderId, ProviderHealth>();

/**
 * Tries providers in priority order with a timeout, bounded retries and
 * backoff. Errors are classified, never shown to users, and never contain keys.
 */
export class AIProviderManager {
  readonly order: ProviderId[];
  private readonly providers: Map<ProviderId, AIProvider>;
  private readonly lifebook: Set<ProviderId>;
  private readonly opts: Required<ManagerOptions>;

  constructor(env: Env, f: Fetch, opts: ManagerOptions = {}) {
    this.providers = buildProviders(env, f);
    this.order = providerOrder(env).filter((id) => this.providers.has(id));
    this.lifebook = lifebookProviders(env);
    this.opts = {
      timeoutMs: opts.timeoutMs ?? (Number(env.AI_TIMEOUT_MS) || 15_000),
      retries: Math.min(opts.retries ?? 1, 2),
      backoffMs: opts.backoffMs ?? 500,
      sleep: opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    };
  }

  get configured(): boolean {
    return this.order.length > 0;
  }

  /** `personal` carries LifeBook facts; `plain` only the safety rules, for providers without LifeBook permission. */
  async reply(
    input: Omit<GenerateInput, "systemInstruction"> & {
      personal: string;
      plain: string;
    },
    only?: ProviderId,
  ): Promise<Reply> {
    const skipped: Reply["skipped"] = [];
    const ids = only ? this.order.filter((id) => id === only) : this.order;
    for (const id of ids) {
      const provider = this.providers.get(id);
      if (!provider) continue;
      const systemInstruction = this.lifebook.has(id)
        ? input.personal
        : input.plain;
      for (let attempt = 0; ; attempt++) {
        try {
          const text = await provider.generate(
            { ...input, systemInstruction },
            AbortSignal.timeout(this.opts.timeoutMs),
          );
          record(provider, null);
          return { text, provider: id, model: provider.model, skipped };
        } catch (e) {
          const err =
            e instanceof ProviderError ? e : new ProviderError(id, "network");
          record(provider, err.category);
          if (err.retryable && attempt < this.opts.retries) {
            await this.opts.sleep(this.opts.backoffMs * 2 ** attempt);
            continue;
          }
          skipped.push({ provider: id, category: err.category });
          break;
        }
      }
    }
    throw new NoProviderError(skipped);
  }

  health(): ProviderHealth[] {
    return this.order.map(
      (id) =>
        health.get(id) ?? {
          id,
          model: this.providers.get(id)?.model ?? "",
          lastSuccessAt: null,
          lastErrorAt: null,
          lastErrorCategory: null,
        },
    );
  }
}

function record(p: AIProvider, category: ErrorCategory | null): void {
  const prev = health.get(p.id) ?? {
    id: p.id,
    model: p.model,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorCategory: null,
  };
  const now = new Date().toISOString();
  health.set(
    p.id,
    category
      ? {
          ...prev,
          model: p.model,
          lastErrorAt: now,
          lastErrorCategory: category,
        }
      : { ...prev, model: p.model, lastSuccessAt: now },
  );
}
