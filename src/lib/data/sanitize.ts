import type { Appointment, CareSchedule, CareSummary, Checkin, HelpRequest, LifebookEntry, Medication } from "@/lib/types";
import { ValidationError } from "@/lib/types";
import { LIMITS, assertDate, assertTime, cleanText, cleanTimes } from "@/lib/domain/validation";
import type { InviteInput } from "./repository";
import { cleanEmail } from "@/lib/domain/validation";
import { toDateKey } from "@/lib/domain/dates";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates and normalises every record before it is written, in both repositories. */

function cleanFrequency(f: Medication["frequency"]): NonNullable<Medication["frequency"]> {
  if (!f || f.kind === "daily") return { kind: "daily" };
  if (f.kind === "weekdays") {
    const days = [...new Set(f.days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
    if (days.length === 0) throw new ValidationError("frequency", "required");
    return { kind: "weekdays", days };
  }
  if (!Number.isInteger(f.everyDays) || f.everyDays < 2 || f.everyDays > 60) throw new ValidationError("frequency", "badNumber");
  return { kind: "interval", everyDays: f.everyDays };
}

export function sanitizeMedication(m: Medication): Medication {
  const startDate = m.startDate ? assertDate("startDate", m.startDate) : DATE_KEY_RE.test(m.createdAt.slice(0, 10)) ? m.createdAt.slice(0, 10) : toDateKey(new Date());
  const endDate = m.endDate ? assertDate("endDate", m.endDate) : null;
  if (endDate && endDate < startDate) throw new ValidationError("endDate", "endBeforeStart");
  return {
    ...m,
    frequency: cleanFrequency(m.frequency),
    startDate,
    endDate,
    name: cleanText("name", m.name, LIMITS.name, true),
    dose: cleanText("dose", m.dose, LIMITS.short),
    notes: cleanText("notes", m.notes, LIMITS.note),
    times: cleanTimes("times", m.times),
  };
}

export function sanitizeAppointment(a: Appointment): Appointment {
  return {
    ...a,
    doctor: cleanText("doctor", a.doctor, LIMITS.name, true),
    date: assertDate("date", a.date),
    time: assertTime("time", a.time),
    location: cleanText("location", a.location, LIMITS.short),
    notes: cleanText("notes", a.notes, LIMITS.note),
    prep: cleanText("prep", a.prep ?? "", LIMITS.note),
    status: a.status === "completed" || a.status === "cancelled" ? a.status : "scheduled",
    shareWithCircle: a.shareWithCircle !== false,
  };
}

const inScale = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 5;

export function sanitizeCheckin(c: Checkin): Checkin {
  if (!inScale(c.mood)) throw new ValidationError("mood", "required");
  if (!inScale(c.sleep)) throw new ValidationError("sleep", "required");
  if (!inScale(c.energy)) throw new ValidationError("energy", "required");
  return { ...c, dateKey: assertDate("dateKey", c.dateKey), note: cleanText("note", c.note, LIMITS.note) };
}

const MEDIA_TYPES = /^(image\/(jpeg|png|webp)|audio\/(webm|ogg|mp4|mpeg|wav)(;.*)?)$/;

export function sanitizeLifebookEntry(e: LifebookEntry): LifebookEntry {
  const media = e.media ?? null;
  if (media && (!MEDIA_TYPES.test(media.contentType) || (media.kind !== "photo" && media.kind !== "audio"))) throw new ValidationError("media", "badMedia");
  // Photos and voice memories may have a short caption only; other memories need words.
  const detailRequired = !(media && (e.category === "photos" || e.category === "voice"));
  return {
    ...e,
    title: cleanText("title", e.title, LIMITS.short, true),
    detail: cleanText("detail", e.detail, LIMITS.detail, detailRequired),
    when: cleanText("when", e.when ?? "", 60),
    relationship: cleanText("relationship", e.relationship ?? "", 60),
    people: [...new Set(e.people ?? [])].slice(0, 20),
    media,
    shareWithCircle: e.shareWithCircle !== false,
    history: (e.history ?? []).slice(0, 10),
  };
}

export function sanitizeSchedule(s: CareSchedule): CareSchedule {
  return { ...s, label: cleanText("label", s.label, LIMITS.name, true), time: assertTime("time", s.time), onDate: s.onDate ? assertDate("onDate", s.onDate) : null };
}

export function sanitizeSummary(s: CareSummary): CareSummary {
  return { ...s, dateKey: assertDate("dateKey", s.dateKey), note: cleanText("note", s.note, LIMITS.note) };
}

export function sanitizeInvite(i: InviteInput): InviteInput {
  return { ...i, name: cleanText("name", i.name, LIMITS.name, true), email: cleanEmail("email", i.email) };
}

export function sanitizeHelpRequest(r: HelpRequest): HelpRequest {
  return { ...r, message: cleanText("message", r.message, 500), status: r.status === "acknowledged" || r.status === "resolved" ? r.status : "open" };
}
