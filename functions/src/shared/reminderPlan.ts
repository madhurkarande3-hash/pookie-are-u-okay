/**
 * Which reminders are due for one elder right now. Pure: the scheduled Cloud
 * Function feeds it Firestore data, the tests feed it fixtures, and the web
 * app uses the same medicine-schedule rules.
 *
 * A reminder is only ever a nudge to the elder. Not answering one is never
 * recorded as a missed dose or treated as an emergency.
 */
import { localParts, reminderDecision, type NotifyPrefs, type ReminderKind } from "./notifyPrefs";

export type MedFrequencyLite = { kind: "daily" } | { kind: "weekdays"; days: number[] } | { kind: "interval"; everyDays: number };

export interface MedicationLite {
  id: string;
  name: string;
  times: string[];
  active: boolean;
  createdAt: string;
  frequency?: MedFrequencyLite;
  startDate?: string;
  endDate?: string | null;
}
export interface ScheduleLite {
  id: string;
  label: string;
  time: string;
  status: string;
  onDate?: string | null;
}
export interface AppointmentLite {
  id: string;
  doctor: string;
  date: string;
  time: string;
  remind: boolean;
  status?: string;
}

const utcOf = (dateKey: string): number => {
  const [y = 2000, m = 1, d = 1] = dateKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const daysBetweenKeys = (from: string, to: string): number => Math.round((utcOf(to) - utcOf(from)) / 86_400_000);
export const weekdayOfKey = (dateKey: string): number => new Date(utcOf(dateKey)).getUTCDay();
const minutesOf = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Whether a medicine is scheduled on `dateKey` (active, start/end dates, frequency). Shared with the web app. */
export function isMedicationScheduledOn(m: Pick<MedicationLite, "active" | "frequency" | "startDate" | "endDate" | "createdAt">, dateKey: string): boolean {
  if (!m.active) return false;
  const start = m.startDate ?? m.createdAt.slice(0, 10);
  if (start && dateKey < start) return false;
  if (m.endDate && dateKey > m.endDate) return false;
  const f = m.frequency ?? { kind: "daily" as const };
  switch (f.kind) {
    case "daily":
      return true;
    case "weekdays":
      return f.days.includes(weekdayOfKey(dateKey));
    case "interval":
      return start ? daysBetweenKeys(start, dateKey) % f.everyDays === 0 : true;
  }
}

export interface DueReminder {
  /** Stable per elder, day, item and time: creating it twice is impossible, so nothing is sent twice. */
  id: string;
  kind: ReminderKind;
  refId: string;
  dateKey: string;
  time: string;
  /** Medicine name, check-in label or doctor — never health details. */
  label: string;
}

export const APPOINTMENT_LEAD_MINUTES = 60;

export function planReminders(input: {
  now: Date;
  prefs: NotifyPrefs;
  remindersConsent: boolean;
  medications: readonly MedicationLite[];
  schedules: readonly ScheduleLite[];
  appointments: readonly AppointmentLite[];
}): DueReminder[] {
  if (!input.remindersConsent) return [];
  const { dateKey, minutes } = localParts(input.now, input.prefs.timezone);
  const candidates: (Omit<DueReminder, "id" | "dateKey"> & { dueMinutes: number })[] = [];

  for (const m of input.medications) {
    if (!isMedicationScheduledOn(m, dateKey)) continue;
    for (const time of m.times) candidates.push({ kind: "medicine", refId: m.id, time, label: m.name, dueMinutes: minutesOf(time) });
  }
  for (const s of input.schedules) {
    if (s.status !== "accepted" || (s.onDate && s.onDate !== dateKey)) continue;
    candidates.push({ kind: "checkin", refId: s.id, time: s.time, label: s.label, dueMinutes: minutesOf(s.time) });
  }
  for (const a of input.appointments) {
    if (!a.remind || a.date !== dateKey || (a.status ?? "scheduled") !== "scheduled") continue;
    candidates.push({ kind: "appointment", refId: a.id, time: a.time, label: a.doctor, dueMinutes: Math.max(0, minutesOf(a.time) - APPOINTMENT_LEAD_MINUTES) });
  }

  return candidates
    .filter((c) => reminderDecision(input.prefs, c.kind, c.dueMinutes, minutes) === "send")
    .map(({ dueMinutes: _due, ...c }) => ({ ...c, dateKey, id: `${dateKey}_${c.kind}_${c.refId}_${c.time.replace(":", "")}` }));
}

/** Push retry schedule: minutes to wait after each failed attempt. After the last, the reminder is marked failed. */
export const RETRY_BACKOFF_MINUTES = [5, 15, 45] as const;

export function nextAttempt(attempts: number, now: Date): Date | null {
  const wait = RETRY_BACKOFF_MINUTES.at(attempts - 1);
  return wait === undefined ? null : new Date(now.getTime() + wait * 60_000);
}
