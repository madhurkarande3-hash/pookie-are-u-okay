import type { Appointment, CareSchedule, ElderProfile, LifebookEntry } from "@/lib/types";
import type { Translate } from "@/lib/i18n";
import { formatTime } from "./dates";
import { appliesOn } from "./schedule";

/**
 * "Where am I? What's happening?" — the same calm answer every time, built
 * only from the profile, the clock and today's confirmed plans. Never a guess.
 */
export function orientationLines(input: {
  elder: Pick<ElderProfile, "preferredName" | "homeLabel"> | null;
  now: Date;
  todayKey: string;
  appointments: readonly Appointment[];
  schedules: readonly CareSchedule[];
  people: readonly LifebookEntry[];
  t: Translate;
  locale: string;
}): string[] {
  const { t, now, locale } = input;
  const lines: string[] = [];
  if (input.elder?.preferredName) lines.push(t("where.name", { name: input.elder.preferredName }));
  lines.push(input.elder?.homeLabel ? t("where.home", { place: input.elder.homeLabel }) : t("where.safe"));
  lines.push(t("where.today", { date: now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }), time: now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) }));
  const visit = input.appointments.find((a) => a.date === input.todayKey && (a.status ?? "scheduled") === "scheduled");
  if (visit) lines.push(t("where.visit", { doctor: visit.doctor, time: formatTime(visit.time, locale) }));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next = input.schedules
    .filter((s) => s.status === "accepted" && appliesOn(s, input.todayKey))
    .map((s) => ({ s, m: Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)) }))
    .filter((x) => x.m >= nowMin)
    .sort((a, b) => a.m - b.m)[0];
  if (next) lines.push(t("where.next", { label: next.s.label, time: formatTime(next.s.time, locale) }));
  const family = input.people.filter((p) => p.confirmed && p.relationship).slice(0, 2);
  if (family.length) lines.push(t("where.family", { names: family.map((p) => `${p.title} (${p.relationship})`).join(", ") }));
  lines.push(t("where.reassure"));
  return lines;
}
