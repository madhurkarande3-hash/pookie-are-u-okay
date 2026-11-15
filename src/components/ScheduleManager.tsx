"use client";

import { useState, type FormEvent } from "react";
import type { CareSchedule, ScheduleStatus } from "@/lib/types";
import { formatTime, toDateKey } from "@/lib/domain/dates";
import {
  decideSchedule,
  isExpired,
  proposeSchedule,
  scheduleLabel,
  type ScheduleDecision,
} from "@/lib/domain/schedule";
import type { MessageKey } from "@/lib/i18n";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePolicy } from "@/hooks/usePolicy";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import {
  EmptyState,
  ErrorNote,
  Loading,
  StatusBadge,
  describeError,
} from "./ui/Feedback";
import { TextField } from "./ui/Field";
import type { IconName } from "./ui/Icon";
import { en } from "@/lib/i18n/en";
import { hi } from "@/lib/i18n/hi";

const LABEL_DICTS = [en, hi] as const;

const STATUS_VIEW: Record<
  ScheduleStatus,
  {
    tone: "ok" | "warn" | "neutral" | "danger";
    icon: IconName;
    label: MessageKey;
  }
> = {
  proposed: { tone: "warn", icon: "question", label: "sched.status.proposed" },
  accepted: { tone: "ok", icon: "check", label: "sched.status.accepted" },
  declined: { tone: "danger", icon: "cross", label: "sched.status.declined" },
  paused: { tone: "neutral", icon: "pause", label: "sched.status.paused" },
};

function ScheduleRow({
  schedule,
  canDecide,
  onChanged,
}: {
  schedule: CareSchedule;
  canDecide: boolean;
  onChanged: () => void;
}) {
  const { t, locale } = usePrefs();
  const { repo, elderId, actor } = useReadySession();
  const [time, setTime] = useState(schedule.time);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const view = STATUS_VIEW[schedule.status];
  const byElder = schedule.proposedBy.role === "elder";

  const decide = async (decision: ScheduleDecision) => {
    setBusy(true);
    setError(null);
    try {
      await repo.saveSchedule(
        elderId,
        decideSchedule(actor, schedule, decision, new Date()),
      );
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await repo.deleteSchedule(elderId, schedule.id);
      onChanged();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-extrabold">
            {scheduleLabel(schedule.label, t, LABEL_DICTS)} ·{" "}
            {formatTime(schedule.time, locale)}
            {schedule.onDate ? ` · ${t("sched.todayOnly")}` : ""}
          </p>
          <p className="text-sm text-ink-soft">
            {byElder
              ? t("sched.byYou")
              : t("sched.proposedBy", {
                  name: schedule.proposedBy.name,
                  role: t(`role.${schedule.proposedBy.role}`),
                })}
            {schedule.originalTime
              ? ` · ${t("sched.changedFrom", { time: formatTime(schedule.originalTime, locale) })}`
              : ""}
          </p>
        </div>
        <StatusBadge tone={view.tone} icon={view.icon}>
          {t(view.label)}
        </StatusBadge>
      </div>

      {canDecide && schedule.status === "proposed" ? (
        <div className="space-y-3 rounded-2xl border border-line p-3">
          <p className="font-bold">{t("sched.decidePrompt")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              icon="check"
              busy={busy}
              onClick={() => decide({ type: "accept" })}
            >
              {t("sched.accept")}
            </Button>
            <Button
              variant="danger"
              icon="cross"
              busy={busy}
              onClick={() => decide({ type: "decline" })}
            >
              {t("sched.decline")}
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <TextField
                label={t("sched.differentTime")}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              icon="clock"
              busy={busy}
              disabled={time === schedule.time}
              onClick={() => decide({ type: "modify", time })}
            >
              {t("sched.acceptAt")}
            </Button>
          </div>
        </div>
      ) : null}

      {canDecide && schedule.status !== "proposed" ? (
        <div className="flex flex-wrap gap-2">
          {schedule.status === "accepted" ? (
            <Button
              variant="secondary"
              icon="pause"
              busy={busy}
              onClick={() => decide({ type: "pause" })}
            >
              {t("sched.pause")}
            </Button>
          ) : null}
          {schedule.status === "paused" || schedule.status === "declined" ? (
            <Button
              variant="secondary"
              icon="play"
              busy={busy}
              onClick={() => decide({ type: "resume" })}
            >
              {t("sched.turnOn")}
            </Button>
          ) : null}
          <Button variant="danger" icon="trash" busy={busy} onClick={remove}>
            {t("common.delete")}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="font-bold text-danger">
          {describeError(error, t)}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Daily check-in times. The elder adds and decides; Care Circle members with
 * permission can only propose, and see the outcome.
 */
export function ScheduleManager() {
  const { t } = usePrefs();
  const { repo, elderId, actor } = useReadySession();
  const allowed = usePolicy();
  const schedules = useAsyncData(
    () => repo.listSchedules(elderId),
    [repo, elderId],
  );
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const canDecide = allowed("schedules:decide");
  const canAdd = canDecide || allowed("schedules:propose");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await repo.saveSchedule(
        elderId,
        proposeSchedule(actor, label, time, new Date()),
      );
      setLabel("");
      schedules.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const today = toDateKey(new Date());
  const visible = schedules.data?.filter((s) => !isExpired(s, today));

  return (
    <div className="space-y-4">
      {schedules.loading ? <Loading /> : null}
      {schedules.error ? (
        <ErrorNote error={schedules.error} onRetry={schedules.reload} />
      ) : null}
      {visible && visible.length === 0 ? (
        <EmptyState
          icon="clock"
          title={t("sched.emptyTitle")}
          body={t("sched.emptyBody")}
        />
      ) : null}
      {visible && visible.length > 0 ? (
        <ul className="space-y-3">
          {visible.map((s) => (
            <ScheduleRow
              key={`${s.id}:${s.status}:${s.time}`}
              schedule={s}
              canDecide={canDecide}
              onChanged={schedules.reload}
            />
          ))}
        </ul>
      ) : null}
      {canAdd ? (
        <Card>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <h3 className="text-lg font-extrabold">
              {canDecide ? t("sched.addTitle") : t("sched.proposeTitle")}
            </h3>
            <TextField
              label={t("sched.label")}
              hint={t("sched.labelHint")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              required
            />
            <div className="w-40">
              <TextField
                label={t("sched.time")}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p role="alert" className="font-bold text-danger">
                {describeError(error, t)}
              </p>
            ) : null}
            <Button type="submit" icon="plus" busy={busy}>
              {canDecide ? t("sched.add") : t("sched.propose")}
            </Button>
            {canDecide ? null : (
              <p className="text-sm text-ink-soft">{t("sched.proposeNote")}</p>
            )}
          </form>
        </Card>
      ) : null}
    </div>
  );
}
