"use client";

import { useEffect } from "react";
import type { Repository } from "@/lib/data/repository";
import { minutesOf } from "@/lib/domain/dates";
import { appliesOn } from "@/lib/domain/schedule";
import { appendReminderLog } from "@/lib/reminderLog";
import { defaultNotifyPrefs, localParts, reminderDecision, type NotifyPrefs, type ReminderKind } from "@shared/notifyPrefs";

const FIRED_KEY = "pookie.reminders.fired";

export interface ReminderText {
  medicine: (name: string) => string;
  checkin: (label: string) => string;
  appointment: (doctor: string) => string;
}

/**
 * While the app is open, shows a system notification when a medicine, an
 * accepted check-in or an appointment becomes due — in the elder's own
 * timezone, never during their quiet hours, and only for the kinds they
 * switched on. Runs only with the elder's consent and the browser's
 * notification permission. (Reminders while the app is closed are sent by
 * the server; see functions/src/reminders.ts.)
 */
export function useReminders(enabled: boolean, repo: Repository, elderId: string, text: ReminderText): void {
  useEffect(() => {
    if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return undefined;
    let cancelled = false;
    let due: { id: string; kind: ReminderKind; minutes: number; body: string }[] = [];
    let prefs: NotifyPrefs = defaultNotifyPrefs(Intl.DateTimeFormat().resolvedOptions().timeZone);

    const load = async () => {
      try {
        const [medications, schedules, appointments, saved] = await Promise.all([
          repo.listMedications(elderId),
          repo.listSchedules(elderId),
          repo.listAppointments(elderId),
          repo.getNotifyPrefs(elderId).catch(() => null),
        ]);
        if (cancelled) return;
        if (saved) prefs = saved;
        const today = localParts(new Date(), prefs.timezone).dateKey;
        due = [
          ...medications.filter((m) => m.active).flatMap((m) => m.times.map((time) => ({ id: `med:${m.id}:${time}`, kind: "medicine" as const, minutes: minutesOf(time), body: text.medicine(m.name) }))),
          ...schedules.filter((s) => s.status === "accepted" && appliesOn(s, today)).map((s) => ({ id: `slot:${s.id}`, kind: "checkin" as const, minutes: minutesOf(s.time), body: text.checkin(s.label) })),
          ...appointments.filter((a) => a.remind && a.date === today && (a.status ?? "scheduled") === "scheduled").map((a) => ({ id: `appt:${a.id}`, kind: "appointment" as const, minutes: Math.max(0, minutesOf(a.time) - 60), body: text.appointment(a.doctor) })),
        ];
      } catch {
        due = [];
      }
    };

    const tick = () => {
      const { dateKey: today, minutes: now } = localParts(new Date(), prefs.timezone);
      let fired: Record<string, string> = {};
      try {
        fired = JSON.parse(window.sessionStorage.getItem(FIRED_KEY) ?? "{}") as Record<string, string>;
      } catch {
        fired = {};
      }
      for (const item of due) {
        if (fired[item.id] !== today && reminderDecision(prefs, item.kind, item.minutes, now) === "send") {
          fired[item.id] = today;
          new Notification("Pookie", { body: item.body, tag: item.id });
          const hhmm = `${String(Math.floor(item.minutes / 60)).padStart(2, "0")}:${String(item.minutes % 60).padStart(2, "0")}`;
          appendReminderLog({ id: `${item.id}:${today}`, kind: item.kind, dateKey: today, time: hhmm, text: item.body, shownAt: new Date().toISOString() });
        }
      }
      window.sessionStorage.setItem(FIRED_KEY, JSON.stringify(fired));
    };

    void load().then(tick);
    const timer = window.setInterval(tick, 60_000);
    const reloadTimer = window.setInterval(() => void load(), 15 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(reloadTimer);
    };
    // `text` changes identity with language; reminders only need the latest on reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, repo, elderId]);
}
