import type { ReminderKind } from "@shared/notifyPrefs";

/**
 * Reminder history.
 *
 * Two sources feed the "Reminder history" screen:
 * - reminders this device showed while Pookie was open (kept here, in this
 *   browser only, newest first, capped), and
 * - reminders Pookie's server planned and sent (`elders/{id}/notifications`),
 *   which only exist when the app runs with its server.
 */

export interface ReminderRecord {
  /** Deterministic id, e.g. "med:m1:08:00:2026-11-15". */
  id: string;
  kind: ReminderKind;
  /** The day it was due, YYYY-MM-DD, in the elder's timezone. */
  dateKey: string;
  /** When it was due, HH:MM. */
  time: string;
  /** What the reminder said, when known. Server records carry a refId instead. */
  text?: string;
  refId?: string;
  /** "device" = shown by this browser; "server" = planned by Pookie's server. */
  source: "device" | "server";
  /** For server records: scheduled, retry, done or failed. */
  status?: string;
  /** When it was shown or delivered (ISO). */
  shownAt?: string;
}

export const REMINDER_LOG_KEY = "pookie.reminders.history";
export const REMINDER_LOG_MAX = 100;

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStore(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is ReminderRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.kind === "string" && typeof r.dateKey === "string" && typeof r.time === "string";
}

export function readReminderLog(store: KeyValueStore | null = browserStore()): ReminderRecord[] {
  if (!store) return [];
  try {
    const parsed: unknown = JSON.parse(store.getItem(REMINDER_LOG_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

/** Adds one shown reminder (newest first). The same id on the same day is kept once. */
export function appendReminderLog(record: Omit<ReminderRecord, "source">, store: KeyValueStore | null = browserStore()): void {
  if (!store) return;
  const existing = readReminderLog(store).filter((r) => r.id !== record.id);
  const next = [{ ...record, source: "device" as const }, ...existing].slice(0, REMINDER_LOG_MAX);
  try {
    store.setItem(REMINDER_LOG_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: history is a convenience, the reminder itself was already shown.
  }
}

/** Newest first: by day, then by time, device and server records together, one per id. */
export function mergeReminderHistory(...lists: ReminderRecord[][]): ReminderRecord[] {
  const byId = new Map<string, ReminderRecord>();
  for (const list of lists) for (const r of list) if (!byId.has(r.id) || r.source === "server") byId.set(r.id, { ...byId.get(r.id), ...r });
  return [...byId.values()].sort((a, b) => (a.dateKey === b.dateKey ? b.time.localeCompare(a.time) : b.dateKey.localeCompare(a.dateKey)));
}
