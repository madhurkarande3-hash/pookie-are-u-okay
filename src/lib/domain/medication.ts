import type { DoseLog, DoseLogStatus, Medication } from "@/lib/types";
import { isMedicationScheduledOn } from "@shared/reminderPlan";
import { minutesNow, minutesOf } from "./dates";

/**
 * Display state of one scheduled dose.
 * - taken / missed: the elder said so. Nothing else can set these.
 * - unconfirmed: the time has passed and nobody has said anything. This is
 *   NOT "missed" — the elder may simply not have opened the app.
 * - due / upcoming: it is not late yet.
 */
export type DoseState = "upcoming" | "due" | "taken" | "missed" | "unconfirmed";

export interface Dose {
  id: string;
  medication: Medication;
  time: string;
  state: DoseState;
  log: DoseLog | null;
}

export const DOSE_GRACE_MINUTES = 60;

export function doseLogId(dateKey: string, medicationId: string, time: string): string {
  return `${dateKey}_${medicationId}_${time.replace(":", "")}`;
}

export function resolveDoseState(
  time: string,
  log: DoseLog | null,
  isToday: boolean,
  now: Date,
  graceMinutes = DOSE_GRACE_MINUTES,
): DoseState {
  if (log) return log.status;
  if (!isToday) return "unconfirmed";
  const elapsed = minutesNow(now) - minutesOf(time);
  if (elapsed < 0) return "upcoming";
  return elapsed < graceMinutes ? "due" : "unconfirmed";
}

/** Whether this medicine is scheduled on `dateKey`. Same rule the server reminder sweep uses. */
export function isScheduledOn(medication: Pick<Medication, "active" | "frequency" | "startDate" | "endDate" | "createdAt">, dateKey: string): boolean {
  return isMedicationScheduledOn(medication, dateKey);
}

/** All doses for one day, in time order. `dateKey` in the past is fully elapsed. */
export function buildDailyDoses(
  medications: readonly Medication[],
  logs: readonly DoseLog[],
  dateKey: string,
  todayKey: string,
  now: Date,
): Dose[] {
  const byId = new Map(logs.filter((l) => l.dateKey === dateKey).map((l) => [l.id, l]));
  const doses: Dose[] = [];
  for (const medication of medications) {
    if (!isScheduledOn(medication, dateKey)) continue;
    for (const time of medication.times) {
      const id = doseLogId(dateKey, medication.id, time);
      const log = byId.get(id) ?? null;
      doses.push({ id, medication, time, log, state: resolveDoseState(time, log, dateKey === todayKey, now) });
    }
  }
  return doses.sort((a, b) => minutesOf(a.time) - minutesOf(b.time) || a.medication.name.localeCompare(b.medication.name));
}

export function makeDoseLog(dose: Pick<Dose, "id" | "medication" | "time">, dateKey: string, status: DoseLogStatus, now: Date): DoseLog {
  return {
    id: dose.id,
    medicationId: dose.medication.id,
    dateKey,
    time: dose.time,
    status,
    confirmedAt: now.toISOString(),
  };
}

export type DoseCounts = Record<DoseState, number>;

export function countDoses(doses: readonly Dose[]): DoseCounts {
  const counts: DoseCounts = { upcoming: 0, due: 0, taken: 0, missed: 0, unconfirmed: 0 };
  for (const d of doses) counts[d.state] += 1;
  return counts;
}
