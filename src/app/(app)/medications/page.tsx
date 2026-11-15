"use client";

import { useState, type FormEvent } from "react";
import { DoseBadge } from "@/components/DoseStatus";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Section } from "@/components/ui/Card";
import { Checkbox, ChoiceGroup } from "@/components/ui/Choice";
import { EmptyState, ErrorNote, Loading, Notice, describeError } from "@/components/ui/Feedback";
import { TextArea, TextField } from "@/components/ui/Field";
import { useAsyncData, useNow } from "@/hooks/useAsyncData";
import { usePolicy } from "@/hooks/usePolicy";
import { addDays, formatDate, formatTime, newId, toDateKey } from "@/lib/domain/dates";
import { buildDailyDoses, makeDoseLog, type Dose } from "@/lib/domain/medication";
import type { DoseLogStatus, MedFrequency, Medication } from "@/lib/types";
import type { Translate } from "@/lib/i18n";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

function blankMedication(): Medication {
  const now = new Date();
  return { id: newId(), name: "", dose: "", times: ["08:00"], notes: "", active: true, createdAt: now.toISOString(), frequency: { kind: "daily" }, startDate: toDateKey(now), endDate: null };
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

function weekdayName(day: number, locale: string, style: "long" | "short" = "short"): string {
  // 2026-06-07 is a Sunday; adding `day` gives that weekday.
  return new Date(2026, 5, 7 + day).toLocaleDateString(locale, { weekday: style });
}

function describeFrequency(m: Medication, t: Translate, locale: string): string {
  const f = m.frequency ?? { kind: "daily" };
  const how =
    f.kind === "daily"
      ? t("med.freq.daily")
      : f.kind === "weekdays"
        ? f.days.map((d) => weekdayName(d, locale)).join(", ")
        : t("med.freq.everyN", { n: f.everyDays });
  const until = m.endDate ? ` · ${t("med.until", { date: formatDate(m.endDate, locale) })}` : "";
  return how + until;
}

function MedicationForm({ initial, onDone, onCancel }: { initial: Medication; onDone: () => void; onCancel: () => void }) {
  const { t, locale } = usePrefs();
  const { repo, elderId } = useReadySession();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const setTime = (index: number, value: string) => setDraft((m) => ({ ...m, times: m.times.map((x, i) => (i === index ? value : x)) }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await repo.saveMedication(elderId, draft);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label={t("med.name")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} required />
        <TextField label={t("med.dose")} hint={t("med.doseHint")} value={draft.dose} onChange={(e) => setDraft({ ...draft, dose: e.target.value })} maxLength={120} />
        <fieldset className="space-y-2">
          <legend className="font-bold">{t("med.times")}</legend>
          {draft.times.map((time, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="w-40">
                <TextField label={t("med.timeN", { n: index + 1 })} type="time" value={time} onChange={(e) => setTime(index, e.target.value)} required />
              </div>
              {draft.times.length > 1 ? (
                <Button variant="quiet" icon="trash" onClick={() => setDraft({ ...draft, times: draft.times.filter((_, i) => i !== index) })}>
                  {t("med.removeTime")}
                </Button>
              ) : null}
            </div>
          ))}
          {draft.times.length < 8 ? (
            <Button variant="secondary" icon="plus" onClick={() => setDraft({ ...draft, times: [...draft.times, "20:00"] })}>
              {t("med.addTime")}
            </Button>
          ) : null}
        </fieldset>
        <ChoiceGroup<MedFrequency["kind"]>
          legend={t("med.freq.label")}
          columns="grid-cols-1 sm:grid-cols-3"
          value={draft.frequency?.kind ?? "daily"}
          onChange={(kind) =>
            setDraft({
              ...draft,
              frequency: kind === "daily" ? { kind } : kind === "weekdays" ? { kind, days: [1, 3, 5] } : { kind, everyDays: 2 },
            })
          }
          options={[
            { value: "daily", label: t("med.freq.daily") },
            { value: "weekdays", label: t("med.freq.weekdays") },
            { value: "interval", label: t("med.freq.interval") },
          ]}
        />
        {draft.frequency?.kind === "weekdays" ? (
          <fieldset className="space-y-2">
            <legend className="font-bold">{t("med.freq.whichDays")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WEEKDAYS.map((day) => {
                const days = draft.frequency?.kind === "weekdays" ? draft.frequency.days : [];
                return (
                  <Checkbox
                    key={day}
                    label={weekdayName(day, locale, "long")}
                    checked={days.includes(day)}
                    onChange={(on) => setDraft({ ...draft, frequency: { kind: "weekdays", days: on ? [...days, day] : days.filter((d) => d !== day) } })}
                  />
                );
              })}
            </div>
          </fieldset>
        ) : null}
        {draft.frequency?.kind === "interval" ? (
          <div className="w-48">
            <TextField
              label={t("med.freq.everyLabel")}
              type="number"
              min={2}
              max={60}
              value={draft.frequency.everyDays}
              onChange={(e) => setDraft({ ...draft, frequency: { kind: "interval", everyDays: Number(e.target.value) } })}
            />
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t("med.startDate")} type="date" value={draft.startDate ?? ""} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
          <TextField label={t("med.endDate")} hint={t("med.endDateHint")} type="date" value={draft.endDate ?? ""} min={draft.startDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value || null })} />
        </div>
        <TextArea label={t("med.notes")} hint={t("med.notesHint")} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} maxLength={1000} />
        <Checkbox label={t("med.active")} checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} />
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

function DoseRow({ dose, canConfirm, onConfirm, onUndo }: { dose: Dose; canConfirm: boolean; onConfirm: (status: DoseLogStatus) => Promise<void>; onUndo: () => Promise<void> }) {
  const { t, locale } = usePrefs();
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };
  const tooEarly = dose.state === "upcoming";

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xl font-extrabold">{dose.medication.name}</p>
          <p className="text-ink-soft">
            {formatTime(dose.time, locale)}
            {dose.medication.dose ? ` · ${dose.medication.dose}` : ""}
          </p>
        </div>
        <DoseBadge state={dose.state} />
      </div>
      {dose.state === "unconfirmed" ? <p className="text-sm text-ink-soft">{t("dose.unconfirmedHelp")}</p> : null}
      {canConfirm ? (
        dose.log ? (
          <Button variant="quiet" busy={busy} onClick={() => run(onUndo)}>
            {t("dose.undo")}
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button icon="check" busy={busy} disabled={tooEarly} onClick={() => run(() => onConfirm("taken"))}>
              {t("dose.confirmTaken")}
            </Button>
            <Button variant="secondary" icon="cross" busy={busy} disabled={tooEarly} onClick={() => run(() => onConfirm("missed"))}>
              {t("dose.confirmMissed")}
            </Button>
            {tooEarly ? <p className="w-full text-sm text-ink-soft">{t("dose.tooEarly")}</p> : null}
          </div>
        )
      ) : null}
    </Card>
  );
}

export default function MedicationsPage() {
  const { t, locale } = usePrefs();
  const { repo, elderId, elder } = useReadySession();
  const allowed = usePolicy();
  const now = useNow();
  const today = toDateKey(now);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const canRead = allowed("medications:read");
  const canWrite = allowed("medications:write");
  const canConfirm = allowed("doses:confirm");

  const data = useAsyncData(async () => {
    if (!canRead) return { medications: [], logs: [] };
    const [medications, logs] = await Promise.all([repo.listMedications(elderId), repo.listDoseLogs(elderId, today)]);
    return { medications, logs };
  }, [repo, elderId, today, canRead]);

  if (!canRead) return <EmptyState icon="shield" title={t("error.noAccessTitle")} body={t("error.noAccessBody")} />;

  const doses = data.data ? buildDailyDoses(data.data.medications, data.data.logs, today, today, now) : [];
  const act = async (work: () => Promise<void>) => {
    setActionError(null);
    try {
      await work();
      data.reload();
    } catch (e) {
      setActionError(e);
    }
  };

  return (
    <>
      <PageHeader title={t("med.title")} subtitle={canConfirm ? t("med.subtitle") : t("med.subtitleMember", { name: elder?.preferredName ?? "" })} />
      {data.loading && !data.data ? <Loading /> : null}
      {data.error ? <ErrorNote error={data.error} onRetry={data.reload} /> : null}
      {actionError ? <ErrorNote error={actionError} /> : null}

      {data.data ? (
        <>
          <Section title={t("med.today")} id="med-today">
            {doses.length === 0 ? (
              <EmptyState icon="pill" title={t("med.emptyTitle")} body={t("med.emptyBody")} />
            ) : (
              <ul className="space-y-3">
                {doses.map((dose) => (
                  <DoseRow
                    key={dose.id}
                    dose={dose}
                    canConfirm={canConfirm}
                    onConfirm={(status) => act(() => repo.saveDoseLog(elderId, makeDoseLog(dose, today, status, new Date())))}
                    onUndo={() => act(() => repo.deleteDoseLog(elderId, dose.id))}
                  />
                ))}
              </ul>
            )}
            <Notice>
              <p>{t("med.statusNote")}</p>
            </Notice>
          </Section>

          <Section
            title={t("med.list")}
            id="med-list"
            action={
              canWrite && !editing ? (
                <Button icon="plus" onClick={() => setEditing(blankMedication())}>
                  {t("med.add")}
                </Button>
              ) : null
            }
          >
            {editing ? (
              <MedicationForm
                key={editing.id}
                initial={editing}
                onCancel={() => setEditing(null)}
                onDone={() => {
                  setEditing(null);
                  data.reload();
                }}
              />
            ) : null}
            {data.data.medications.length > 0 ? (
              <ul className="space-y-3">
                {data.data.medications.map((m) => (
                  <Card as="li" key={m.id} className="space-y-2">
                    <p className="text-lg font-extrabold">
                      {m.name}
                      {m.active ? "" : ` (${t("med.paused")})`}
                    </p>
                    <p className="text-ink-soft">{[m.dose, m.times.map((time) => formatTime(time, locale)).join(", ")].filter(Boolean).join(" · ")}</p>
                    <p className="text-ink-soft">{describeFrequency(m, t, locale)}</p>
                    {m.notes ? <p>{m.notes}</p> : null}
                    {canWrite ? (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" icon="edit" onClick={() => setEditing(m)}>
                          {t("common.edit")}
                        </Button>
                        <Button variant="danger" icon="trash" onClick={() => act(() => repo.deleteMedication(elderId, m.id))}>
                          {t("common.delete")}
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section title={t("med.history")} id="med-history">
            <DoseHistory medications={data.data.medications} today={today} />
          </Section>
        </>
      ) : null}
    </>
  );
}

/** Any past day's doses: Taken and Missed as recorded, everything else Not confirmed. */
function DoseHistory({ medications, today }: { medications: Medication[]; today: string }) {
  const { t, locale } = usePrefs();
  const { repo, elderId } = useReadySession();
  const [day, setDay] = useState(addDays(today, -1));
  const logs = useAsyncData(() => repo.listDoseLogs(elderId, day), [repo, elderId, day]);
  const doses = logs.data ? buildDailyDoses(medications, logs.data, day, today, new Date()) : [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-56">
          <TextField label={t("med.historyDay")} type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </div>
        <Button variant="secondary" onClick={() => setDay(addDays(day, -1))}>
          {t("med.prevDay")}
        </Button>
        <Button variant="secondary" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}>
          {t("med.nextDay")}
        </Button>
      </div>
      {logs.loading && !logs.data ? <Loading /> : null}
      {logs.error ? <ErrorNote error={logs.error} onRetry={logs.reload} /> : null}
      {logs.data && doses.length === 0 ? <p className="text-ink-soft">{t("med.historyNone", { date: formatDate(day, locale) })}</p> : null}
      {doses.length > 0 ? (
        <ul className="space-y-2">
          {doses.map((dose) => (
            <Card as="li" key={dose.id} className="flex flex-wrap items-center justify-between gap-2 !p-4">
              <p className="font-extrabold">
                {dose.medication.name} · {formatTime(dose.time, locale)}
              </p>
              <DoseBadge state={dose.state} />
            </Card>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
