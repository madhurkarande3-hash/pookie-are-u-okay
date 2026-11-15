"use client";

import { useMemo } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { EmptyState, ErrorNote, Loading, Notice, StatusBadge } from "@/components/ui/Feedback";
import type { IconName } from "@/components/ui/Icon";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDate, formatTime } from "@/lib/domain/dates";
import { mergeReminderHistory, readReminderLog, type ReminderRecord } from "@/lib/reminderLog";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

const KIND_ICON: Record<ReminderRecord["kind"], IconName> = { medicine: "pill", checkin: "heart", appointment: "calendar", circle: "users" };

/**
 * Reminder history: what Pookie reminded the elder about, newest first.
 * Shows reminders this device displayed and, with Pookie's server, the ones
 * the server sent. It never says a medicine was taken: that is on the
 * Medicines screen, answered by the elder.
 */
export default function RemindersPage() {
  const { t, locale } = usePrefs();
  const { repo, elderId, actor } = useReadySession();
  const isElder = actor.role === "elder";
  const data = useAsyncData(async () => {
    if (!isElder) return null;
    const [server, medications, appointments, schedules] = await Promise.all([
      repo.listReminderHistory(elderId).catch(() => [] as ReminderRecord[]),
      repo.listMedications(elderId).catch(() => []),
      repo.listAppointments(elderId).catch(() => []),
      repo.listSchedules(elderId).catch(() => []),
    ]);
    const names = new Map<string, string>([
      ...medications.map((m) => [m.id, t("reminders.text.medicine", { name: m.name })] as const),
      ...appointments.map((a) => [a.id, t("reminders.text.appointment", { doctor: a.doctor })] as const),
      ...schedules.map((s) => [s.id, t("reminders.text.checkin", { label: s.label })] as const),
    ]);
    return mergeReminderHistory(readReminderLog(), server).map((r) => ({ ...r, text: r.text ?? (r.refId ? names.get(r.refId) : undefined) }));
  }, [repo, elderId, isElder]);

  const byDay = useMemo(() => {
    const groups = new Map<string, ReminderRecord[]>();
    for (const r of data.data ?? []) groups.set(r.dateKey, [...(groups.get(r.dateKey) ?? []), r]);
    return [...groups.entries()];
  }, [data.data]);

  if (!isElder) return <EmptyState icon="shield" title={t("error.noAccessTitle")} body={t("reminders.elderOnly")} />;

  return (
    <>
      <PageHeader title={t("reminders.title")} subtitle={t("reminders.subtitle")} />
      {repo.mode === "demo" ? <Notice>{t("reminders.deviceOnly")}</Notice> : null}
      {data.loading && !data.data ? <Loading /> : null}
      {data.error ? <ErrorNote error={data.error} onRetry={data.reload} /> : null}
      {data.data && data.data.length === 0 ? (
        <EmptyState
          icon="bell"
          title={t("reminders.emptyTitle")}
          body={t("reminders.emptyBody")}
          action={
            <ButtonLink href="/settings" variant="secondary" icon="settings">
              {t("reminders.openSettings")}
            </ButtonLink>
          }
        />
      ) : null}
      {byDay.map(([day, items]) => (
        <section key={day} aria-labelledby={`rem-${day}`} className="space-y-3">
          <h2 id={`rem-${day}`} className="text-xl font-extrabold">
            {formatDate(day, locale)}
          </h2>
          <ul className="space-y-3">
            {items.map((r) => (
              <Card as="li" key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-extrabold">{r.text ?? t(`notify.kind.${r.kind}`)}</p>
                  <p className="text-ink-soft">
                    {r.time ? formatTime(r.time, locale) : ""} · {t(`notify.kind.${r.kind}`)}
                  </p>
                </div>
                <StatusBadge tone={r.status === "failed" ? "warn" : r.source === "device" || r.status === "done" ? "ok" : "neutral"} icon={KIND_ICON[r.kind]}>
                  {r.source === "device" ? t("reminders.shownHere") : t(`reminders.status.${r.status === "done" || r.status === "failed" || r.status === "retry" ? r.status : "scheduled"}`)}
                </StatusBadge>
              </Card>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
