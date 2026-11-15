"use client";

import { useState } from "react";
import { usePrefs } from "@/state/PrefsProvider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { TextField } from "./ui/Field";

interface Health {
  order: string[];
  primary: string | null;
  fallback: string | null;
  providers: {
    id: string;
    model: string;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastErrorCategory: string | null;
  }[];
  voice: { geminiLive: boolean; cloudTts: boolean; browserFallback: boolean };
}

/** Admin-only AI health. The token stays in memory; the server never returns keys. */
export function AiDiagnostics() {
  const { t } = usePrefs();
  const [token, setToken] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [tests, setTests] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  const load = async () => {
    setError(null);
    const r = await fetch("/api/ai/health", { headers }).catch(() => null);
    if (!r || r.status === 404) return setError(t("diag.off"));
    if (!r.ok) return setError(t("diag.denied"));
    setHealth((await r.json()) as Health);
  };
  const test = async (provider: string) => {
    setTests((s) => ({ ...s, [provider]: "…" }));
    const r = await fetch("/api/ai/health", {
      method: "POST",
      headers,
      body: JSON.stringify({ provider }),
    }).catch(() => null);
    const d = (r?.ok ? await r.json() : { ok: false, category: "network" }) as {
      ok: boolean;
      ms?: number;
      category?: string;
    };
    setTests((s) => ({
      ...s,
      [provider]: d.ok
        ? t("diag.ok", { ms: d.ms ?? 0 })
        : t("diag.failed", { category: d.category ?? "?" }),
    }));
    void load();
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-xl font-extrabold">{t("diag.title")}</h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <TextField
          label={t("diag.token")}
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          {t("diag.check")}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="font-bold">
          {error}
        </p>
      ) : null}
      {health ? (
        <div className="space-y-2">
          <p>
            {t("diag.order", {
              order: health.order.join(" → ") || t("admin.none"),
            })}
          </p>
          <ul className="space-y-2">
            {health.providers.map((p) => (
              <li key={p.id} className="rounded-2xl border-2 border-line p-3">
                <p className="font-extrabold">
                  {p.id}{" "}
                  <span className="font-normal text-ink-soft">({p.model})</span>
                </p>
                <p className="text-sm">
                  {t("diag.last", {
                    ok: p.lastSuccessAt ?? "—",
                    err: p.lastErrorCategory
                      ? `${p.lastErrorCategory} @ ${p.lastErrorAt}`
                      : "—",
                  })}
                </p>
                <Button variant="quiet" onClick={() => void test(p.id)}>
                  {t("diag.test")}
                </Button>
                {tests[p.id] ? (
                  <span role="status" className="ms-2 font-bold">
                    {tests[p.id]}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-sm">
            {t("diag.voice", { live: health.voice.geminiLive ? "✓" : "✗" })}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
