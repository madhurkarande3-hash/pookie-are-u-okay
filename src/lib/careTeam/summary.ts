import { buildDailyDoses, countDoses } from "@/lib/domain/medication";
import type { Appointment, Checkin, DoseLog, ElderProfile, HelpRequest, Medication } from "@/lib/types";

/** One row on the care-team dashboard, built only from what that patient allowed this person to see. */
export interface PatientSummary {
  elderId: string;
  name: string;
  /** Null = no permission to see medicines. */
  doses: { taken: number; missed: number; unconfirmed: number; later: number } | null;
  openHelp: number;
  lastCheckin: Pick<Checkin, "dateKey" | "mood" | "assistance"> | null;
  nextVisit: Pick<Appointment, "doctor" | "date" | "time"> | null;
  /** Sorts patients who may need attention first. Never a clinical score. */
  attention: number;
  sharingPaused: boolean;
}

export interface PatientData {
  elderId: string;
  elder: ElderProfile | null;
  medications: Medication[] | null;
  doseLogs: DoseLog[] | null;
  help: HelpRequest[] | null;
  checkins: Checkin[] | null;
  appointments: Appointment[] | null;
}

export function summarisePatient(d: PatientData, todayKey: string, now: Date): PatientSummary {
  const doses = d.medications && d.doseLogs ? countDoses(buildDailyDoses(d.medications, d.doseLogs, todayKey, todayKey, now)) : null;
  const openHelp = d.help?.filter((h) => h.status === "open").length ?? 0;
  const last = d.checkins?.[0];
  const next = d.appointments?.find((a) => a.date >= todayKey && (a.status ?? "scheduled") === "scheduled") ?? null;
  const attention = openHelp * 100 + (doses ? doses.missed * 10 + doses.unconfirmed : 0) + (last && last.assistance === "lot" ? 20 : 0);
  return {
    elderId: d.elderId,
    name: d.elder?.preferredName ?? "—",
    doses: doses ? { taken: doses.taken, missed: doses.missed, unconfirmed: doses.unconfirmed, later: doses.upcoming + doses.due } : null,
    openHelp,
    lastCheckin: last ? { dateKey: last.dateKey, mood: last.mood, assistance: last.assistance } : null,
    nextVisit: next ? { doctor: next.doctor, date: next.date, time: next.time } : null,
    attention,
    sharingPaused: d.elder === null,
  };
}

export const byAttention = (a: PatientSummary, b: PatientSummary): number => b.attention - a.attention || a.name.localeCompare(b.name);
