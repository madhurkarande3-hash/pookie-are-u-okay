"use client";

import type { ReactNode } from "react";
import { usePrefs } from "@/state/PrefsProvider";
import { PermissionError, ValidationError } from "@/lib/types";
import type { MessageKey, Translate } from "@/lib/i18n";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

export function Loading({ label }: { label?: string }) {
  const { t } = usePrefs();
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-10 text-ink-soft">
      <span className="h-6 w-6 animate-spin rounded-full border-4 border-accent border-t-primary-strong" aria-hidden="true" />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}

const VALIDATION_KEYS: Record<string, MessageKey> = {
  required: "error.required",
  tooLong: "error.tooLong",
  badTime: "error.badTime",
  badDate: "error.badDate",
  badEmail: "error.badEmail",
  tooMany: "error.tooMany",
  badNumber: "error.badNumber",
  endBeforeStart: "error.endBeforeStart",
  badPhone: "error.badPhone",
  badMedia: "error.badMedia",
  mediaTooBig: "error.mediaTooBig",
};

/** Turns any thrown error into a sentence the user can act on. */
export function describeError(error: unknown, t: Translate): string {
  if (error instanceof ValidationError) return t(VALIDATION_KEYS[error.message] ?? "error.generic");
  if (error instanceof PermissionError) return t("error.permission");
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code.includes("permission-denied")) return t("error.permission");
  if (code.includes("unavailable") || code.includes("network")) return t("error.offline");
  return t("error.generic");
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = usePrefs();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-danger bg-surface p-4 text-danger">
      <Icon name="info" />
      <p className="flex-1 font-bold">{describeError(error, t)}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-line bg-surface/60 px-5 py-8 text-center">
      <Icon name={icon} className="h-10 w-10 text-primary-strong" />
      <p className="text-lg font-extrabold">{title}</p>
      {body ? <p className="max-w-prose text-ink-soft">{body}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

type Tone = "ok" | "warn" | "danger" | "neutral";
const TONES: Record<Tone, string> = {
  ok: "border-ok text-ok",
  warn: "border-warn text-warn",
  danger: "border-danger text-danger",
  neutral: "border-ink-soft text-ink-soft",
};

/** Status is always icon + word; colour is only reinforcement. */
export function StatusBadge({ tone, icon, children }: { tone: Tone; icon: IconName; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill border-2 bg-surface px-3 py-1 text-sm font-extrabold ${TONES[tone]}`}>
      <Icon name={icon} className="h-4 w-4" />
      {children}
    </span>
  );
}

export function Notice({ icon = "info", children, tone = "neutral" }: { icon?: IconName; children: ReactNode; tone?: "neutral" | "warn" }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${tone === "warn" ? "border-warn bg-surface text-ink" : "border-line bg-accent/25 text-ink"}`}>
      <Icon name={icon} className={`mt-0.5 h-6 w-6 ${tone === "warn" ? "text-warn" : "text-primary-strong"}`} />
      <div className="flex-1 space-y-1">{children}</div>
    </div>
  );
}
