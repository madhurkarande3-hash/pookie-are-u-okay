"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Section } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import { EmptyState, ErrorNote, Loading, StatusBadge, describeError } from "@/components/ui/Feedback";
import { TextArea, TextField } from "@/components/ui/Field";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePolicy } from "@/hooks/usePolicy";
import { formatDate, formatTime, newId, toDateKey } from "@/lib/domain/dates";
import { appointmentToIcs, icsFileName } from "@/lib/domain/ics";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

function blankAppointment(): Appointment {
  return { id: newId(), doctor: "", date: toDateKey(new Date()), time: "10:00", location: "", notes: "", prep: "", remind: true, status: "scheduled", shareWithCircle: true, createdAt: new Date().toISOString() };
}

function AppointmentForm({ initial, onDone, onCancel }: { initial: Appointment; onDone: () => void; onCancel: () => void }) {
  const { t } = usePrefs();
  const { repo, elderId } = useReadySession();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await repo.saveAppointment(elderId, draft);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label={t("appt.doctor")} value={draft.doctor} onChange={(e) => setDraft({ ...draft, doctor: e.target.value })} maxLength={80} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("appt.date")} type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
          <TextField label={t("appt.time")} type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} required />
        </div>
        <TextField label={t("appt.location")} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} maxLength={120} />
        <TextArea label={t("appt.prep")} hint={t("appt.prepHint")} value={draft.prep ?? ""} onChange={(e) => setDraft({ ...draft, prep: e.target.value })} maxLength={1000} />
        <TextArea label={t("appt.notes")} hint={t("appt.notesHint")} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} maxLength={1000} />
        <Checkbox label={t("appt.remind")} checked={draft.remind} onChange={(remind) => setDraft({ ...draft, remind })} />
        <Checkbox label={t("appt.share")} checked={draft.shareWithCircle !== false} onChange={(shareWithCircle) => setDraft({ ...draft, shareWithCircle })}>
          <span className="text-sm text-ink-soft">{t("appt.shareHint")}</span>
        </Checkbox>
        {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" icon="check" busy={busy}>
            {t("common.save")}
          </Button>
          <Button variant="quiet" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function AppointmentsPage() {
  const { t, locale } = usePrefs();
  const { repo, elderId } = useReadySession();
  const allowed = usePolicy();
  const canRead = allowed("appointments:read");
  const canWrite = allowed("appointments:write");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const today = toDateKey(new Date());
  const list = useAsyncData(() => (canRead ? repo.listAppointments(elderId) : Promise.resolve([])), [repo, elderId, canRead]);

  if (!canRead) return <EmptyState icon="shield" title={t("error.noAccessTitle")} body={t("error.noAccessBody")} />;

  const isOpen = (a: Appointment) => (a.status ?? "scheduled") === "scheduled" && a.date >= today;
  const upcoming = list.data?.filter(isOpen) ?? [];
  const history = list.data?.filter((a) => !isOpen(a)).reverse() ?? [];
  const act = async (work: () => Promise<void>) => {
    setActionError(null);
    try {
      await work();
      list.reload();
    } catch (e) {
      setActionError(e);
    }
  };
  const addToCalendar = (a: Appointment) => {
    const ics = appointmentToIcs(a, { title: t("appt.calendarTitle", { doctor: a.doctor }), prepLabel: t("appt.prep"), alarm: t("appt.calendarAlarm") });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = icsFileName(a);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const remove = (id: string) => act(() => repo.deleteAppointment(elderId, id));
  const setStatus = (a: Appointment, status: AppointmentStatus) => act(() => repo.saveAppointment(elderId, { ...a, status }));
  const STATUS_VIEW = {
    scheduled: { tone: "neutral", icon: "clock", label: t("appt.status.scheduled") },
    completed: { tone: "ok", icon: "check", label: t("appt.status.completed") },
    cancelled: { tone: "warn", icon: "cross", label: t("appt.status.cancelled") },
  } as const;

  const renderItem = (a: Appointment) => (
    <Card as="li" key={a.id} className="space-y-2">
      <p className="text-xl font-extrabold">{a.doctor}</p>
      <p className="font-bold">
        {formatDate(a.date, locale)} · {formatTime(a.time, locale)}
      </p>
      {a.location ? <p className="text-ink-soft">{a.location}</p> : null}
      {a.status && a.status !== "scheduled" ? (
        <StatusBadge tone={STATUS_VIEW[a.status].tone} icon={STATUS_VIEW[a.status].icon}>
          {STATUS_VIEW[a.status].label}
        </StatusBadge>
      ) : null}
      {a.prep ? (
        <p>
          <span className="font-bold">{t("appt.prep")}: </span>
          {a.prep}
        </p>
      ) : null}
      {a.notes ? <p>{a.notes}</p> : null}
      <p className="text-sm text-ink-soft">
        {a.remind ? t("appt.remindOn") : t("appt.remindOff")} · {a.shareWithCircle === false ? t("appt.private") : t("appt.shared")}
      </p>
      {isOpen(a) ? (
        <Button variant="secondary" icon="calendar" onClick={() => addToCalendar(a)}>
          {t("appt.addToCalendar")}
        </Button>
      ) : null}
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          {(a.status ?? "scheduled") === "scheduled" ? (
            <>
              <Button variant="secondary" icon="check" onClick={() => void setStatus(a, "completed")}>
                {t("appt.markDone")}
              </Button>
              <Button variant="secondary" icon="cross" onClick={() => void setStatus(a, "cancelled")}>
                {t("appt.markCancelled")}
              </Button>
            </>
          ) : (
            <Button variant="secondary" icon="clock" onClick={() => void setStatus(a, "scheduled")}>
              {t("appt.markScheduled")}
            </Button>
          )}
          <Button variant="secondary" icon="edit" onClick={() => setEditing(a)}>
            {t("common.edit")}
          </Button>
          <Button variant="danger" icon="trash" onClick={() => void remove(a.id)}>
            {t("common.delete")}
          </Button>
        </div>
      ) : null}
    </Card>
  );

  return (
    <>
      <PageHeader title={t("appt.title")} subtitle={t("appt.subtitle")} />
      {canWrite && !editing ? (
        <Button icon="plus" size="lg" onClick={() => setEditing(blankAppointment())}>
          {t("appt.add")}
        </Button>
      ) : null}
      {editing ? (
        <AppointmentForm
          key={editing.id}
          initial={editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.error ? <ErrorNote error={list.error} onRetry={list.reload} /> : null}
      {actionError ? <ErrorNote error={actionError} /> : null}
      {list.data ? (
        <>
          <Section title={t("appt.upcoming")} id="appt-upcoming">
            {upcoming.length === 0 ? <EmptyState icon="calendar" title={t("appt.emptyTitle")} body={t("appt.emptyBody")} /> : <ul className="space-y-3">{upcoming.map(renderItem)}</ul>}
          </Section>
          {history.length > 0 ? (
            <Section title={t("appt.history")} id="appt-history">
              <ul className="space-y-3">{history.map(renderItem)}</ul>
            </Section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
