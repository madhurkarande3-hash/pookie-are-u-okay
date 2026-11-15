"use client";

import { useEffect, useState } from "react";
import type { CompanionEntry } from "@shared/companionContext";
import type { LifebookEntry } from "@/lib/types";

let probe: Promise<boolean> | null = null;

/** Whether this deployment's own server has a Gemini key (/api/companion). False in the one-file build. */
export function serverAiAvailable(): Promise<boolean> {
  probe ??= fetch("/api/companion", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ available?: boolean }>) : { available: false }))
    .then((d) => d.available === true)
    .catch(() => false);
  return probe;
}

export function useServerAi(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    void serverAiAvailable().then(setAvailable);
  }, []);
  return available;
}

/** Only what the AI may use: confirmed, AI-allowed memories, without media data. */
export function entriesForAi(entries: readonly LifebookEntry[]): CompanionEntry[] {
  return entries
    .filter((e) => e.confirmed && e.aiAllowed)
    .map((e) => ({ id: e.id, category: e.category, title: e.title, detail: e.detail, relationship: e.relationship, when: e.when, people: e.people, confirmed: true, aiAllowed: true, source: { type: e.source.type, byName: e.source.byName } }));
}

export const deviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "Asia/Kolkata";
  }
};
