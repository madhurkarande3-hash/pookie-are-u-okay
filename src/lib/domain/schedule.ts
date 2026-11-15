import type { Actor, CareSchedule, Checkin, CareSummary, ScheduleStatus } from "@/lib/types";
import { PermissionError } from "@/lib/types";
import { minutesNow, minutesOf, newId } from "./dates";

/** A family member or caregiver proposes; only the elder's decision activates it. */
export function proposeSchedule(actor: Actor, label: string, time: string, now: Date): CareSchedule {
  const isElder = actor.role === "elder";
  return {
    id: newId(),
    label,
    time,
    status: isElder ? "accepted" : "proposed",
    proposedBy: { uid: actor.uid, name: actor.name, role: actor.role },
    originalTime: null,
    createdAt: now.toISOString(),
    decidedAt: isElder ? now.toISOString() : null,
  };
}

export type ScheduleDecision =
  | { type: "accept" }
  | { type: "modify"; time: string }
  | { type: "decline" }
  | { type: "pause" }
  | { type: "resume" };

const NEXT_STATUS: Record<ScheduleDecision["type"], ScheduleStatus> = {
  accept: "accepted",
  modify: "accepted",
  decline: "declined",
  pause: "paused",
  resume: "accepted",
};

export function decideSchedule(actor: Actor, schedule: CareSchedule, decision: ScheduleDecision, now: Date): CareSchedule {
  if (actor.role !== "elder") throw new PermissionError("schedules:decide");
  const modified = decision.type === "modify" && decision.time !== schedule.time;
  return {
    ...schedule,
    status: NEXT_STATUS[decision.type],
    time: decision.type === "modify" ? decision.time : schedule.time,
    originalTime: modified ? schedule.time : schedule.originalTime,
    decidedAt: now.toISOString(),
  };
}

/**
 * State of today's slot for an accepted schedule.
 * "noResponse" means only that: no check-in was recorded. It is never a
 * missed medication and never an emergency signal.
 */
export type SlotState = "upcoming" | "open" | "completed" | "noResponse";
export const SLOT_OPEN_MINUTES = 120;

export function slotState(
  schedule: CareSchedule,
  todayKey: string,
  checkins: readonly Pick<Checkin, "dateKey" | "scheduleId">[],
  summaries: readonly Pick<CareSummary, "dateKey" | "scheduleId">[],
  now: Date,
): SlotState {
  const done = [...checkins, ...summaries].some((r) => r.dateKey === todayKey && r.scheduleId === schedule.id);
  if (done) return "completed";
  const elapsed = minutesNow(now) - minutesOf(schedule.time);
  if (elapsed < 0) return "upcoming";
  return elapsed < SLOT_OPEN_MINUTES ? "open" : "noResponse";
}

export const DEFAULT_SCHEDULE: readonly { labelKey: "sched.morning" | "sched.afternoon" | "sched.evening"; time: string }[] = [
  { labelKey: "sched.morning", time: "09:00" },
  { labelKey: "sched.afternoon", time: "14:00" },
  { labelKey: "sched.evening", time: "20:00" },
];

/**
 * Default check-in names are stored as plain text in whichever language was
 * active when they were created. Show them in the current language instead;
 * names someone typed themselves are shown exactly as written.
 */
export function scheduleLabel(label: string, t: (key: (typeof DEFAULT_SCHEDULE)[number]["labelKey"]) => string, defaults: readonly Record<string, string>[]): string {
  const trimmed = label.trim();
  for (const { labelKey } of DEFAULT_SCHEDULE) {
    if (defaults.some((dict) => dict[labelKey] === trimmed)) return t(labelKey);
  }
  return label;
}

/** Whether a schedule has a slot on `dateKey`: daily ones always, one-off follow-ups only on their day. */
export function appliesOn(schedule: Pick<CareSchedule, "onDate">, dateKey: string): boolean {
  return !schedule.onDate || schedule.onDate === dateKey;
}

/** One-off follow-up check-ins whose day has passed are hidden from lists. */
export function isExpired(schedule: Pick<CareSchedule, "onDate">, todayKey: string): boolean {
  return Boolean(schedule.onDate && schedule.onDate < todayKey);
}

/**
 * A gentle follow-up check-in later today, set by the elder after a check-in
 * where they felt low or needed help. Accepted straight away (it is their own
 * choice) and only for today; it is a reminder, never an alert to anyone.
 */
export function followUpSchedule(actor: Actor, label: string, time: string, todayKey: string, now: Date): CareSchedule {
  if (actor.role !== "elder") throw new PermissionError("schedules:followUp");
  return { ...proposeSchedule(actor, label, time, now), onDate: todayKey };
}
