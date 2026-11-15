"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DoseBadge } from "@/components/DoseStatus";
import { HelpRequestsPanel } from "@/components/HelpRequest";
import { ScheduleManager } from "@/components/ScheduleManager";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, PageHeader, Section } from "@/components/ui/Card";
import { EmptyState, ErrorNote, Loading, Notice } from "@/components/ui/Feedback";
import { useAsyncData, useNow } from "@/hooks/useAsyncData";
import { usePolicy } from "@/hooks/usePolicy";
import { describeCheckin } from "@/lib/domain/checkinText";
import { formatDate, formatTime, toDateKey } from "@/lib/domain/dates";
import { buildDailyDoses, countDoses } from "@/lib/domain/medication";
import { PERMISSION_KEYS } from "@/lib/domain/permissions";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

function MedicationsPanel() {
  const { t, locale } = usePrefs();
  const { repo, elderId } = useReadySession();
  const now = useNow();
  const today = toDateKey(now);
  const data = useAsyncData(async () => {
    const [medications, logs] = await Promise.all([repo.listMedications(elderId), repo.listDoseLogs(elderId, today)]);
    return { medications, logs };
  }, [repo, elderId, today]);

  if (data.loading && !data.data) return <Loading />;
  if (data.error) return <ErrorNote error={data.error} onRetry={data.reload} />;
  const doses = data.data ? buildDailyDoses(data.data.medications, data.data.logs, today, today, now) : [];
  if (doses.length === 0) return <EmptyState icon="pill" title={t("family.noMeds")} />;
  const counts = countDoses(doses);

  return (
    <div className="space-y-3">
      <p className="font-bold">{t("family.medSummary", { taken: counts.taken, missed: counts.missed, unconfirmed: counts.unconfirmed, later: counts.upcoming + counts.due })}</p>
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
      {counts.unconfirmed > 0 ? (
        <Notice>
          <p>{t("family.unconfirmedNote")}</p>
        </Notice>
      ) : null}
    </div>
  );
}

function AppointmentsPanel() {
  const { t, locale } = usePrefs();
  const { repo, elderId } = useReadySession();
  const today = toDateKey(new Date());
  const list = useAsyncData(() => repo.listAppointments(elderId), [repo, elderId]);
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorNote error={list.error} onRetry={list.reload} />;
  const upcoming = list.data?.filter((a) => a.date >= today && (a.status ?? "scheduled") === "scheduled") ?? [];
  if (upcoming.length === 0) return <EmptyState icon="calendar" title={t("appt.emptyTitle")} />;
  return (
    <ul className="space-y-2">
      {upcoming.map((a) => (
        <Card as="li" key={a.id} className="!p-4">
          <p className="font-extrabold">{a.doctor}</p>
          <p className="text-ink-soft">
            {formatDate(a.date, locale)} · {formatTime(a.time, locale)}
            {a.location ? ` · ${a.location}` : ""}
          </p>
        </Card>
      ))}
    </ul>
  );
}

function CheckinsPanel() {
  const { t, locale } = usePrefs();
  const { repo, elderId } = useReadySession();
  const list = useAsyncData(() => repo.listCheckins(elderId, 7), [repo, elderId]);
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorNote error={list.error} onRetry={list.reload} />;
  if (!list.data || list.data.length === 0) return <EmptyState icon="heart" title={t("family.noShared")} body={t("family.noSharedBody")} />;
  return (
    <ul className="space-y-2">
      {list.data.map((c) => (
        <Card as="li" key={c.id} className="space-y-1 !p-4">
          <p className="font-extrabold">{formatDate(c.dateKey, locale)}</p>
          <p>{describeCheckin(c, t)}</p>
          {c.note ? <p className="text-ink-soft">{c.note}</p> : null}
        </Card>
      ))}
    </ul>
  );
}

function SummariesPanel() {
  const { t, locale } = usePrefs();
  const { repo, elderId } = useReadySession();
  const list = useAsyncData(() => repo.listSummaries(elderId, 7), [repo, elderId]);
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorNote error={list.error} onRetry={list.reload} />;
  if (!list.data || list.data.length === 0) return <EmptyState icon="chat" title={t("family.noShared")} body={t("family.noSharedBody")} />;
  return (
    <ul className="space-y-2">
      {list.data.map((s) => (
        <Card as="li" key={s.id} className="space-y-1 !p-4">
          <p className="font-extrabold">{formatDate(s.dateKey, locale)}</p>
          <p>
            {t("talk.feelingQ")} {t(`talk.feeling.${s.feeling}`)}
          </p>
          {s.note ? <p className="text-ink-soft">{s.note}</p> : null}
        </Card>
      ))}
    </ul>
  );
}

function NoticesPanel() {
  const { t, locale } = usePrefs();
  const { repo, actor } = useReadySession();
  const list = useAsyncData(() => repo.listNotices(actor.uid), [repo, actor.uid]);
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorNote error={list.error} onRetry={list.reload} />;
  const unread = list.data?.filter((n) => !n.read) ?? [];
  if (unread.length === 0) return <p className="text-ink-soft">{t("family.noNotices")}</p>;
  return (
    <ul className="space-y-2" aria-live="polite">
      {unread.map((n) => (
        <Card as="li" key={n.id} className="flex flex-wrap items-center justify-between gap-3 !p-4">
          <p className="font-bold">{t(n.kind === "summary" ? "family.noticeSummary" : n.kind === "help" ? "family.noticeHelp" : "family.noticeCheckin", { name: n.elderName, date: formatDate(n.dateKey, locale) })}</p>
          <Button
            variant="secondary"
            icon="check"
            onClick={() => {
              void repo.markNoticeRead(actor.uid, n.id).then(list.reload, list.reload);
            }}
          >
            {t("family.noticeSeen")}
          </Button>
        </Card>
      ))}
    </ul>
  );
}

/** What a family member or caregiver sees — strictly what the elder has granted. */
export default function FamilyDashboardPage() {
  const { t } = usePrefs();
  const { actor, elder } = useReadySession();
  const allowed = usePolicy();
  const router = useRouter();

  useEffect(() => {
    if (actor.role === "elder") router.replace("/circle");
  }, [actor.role, router]);
  if (actor.role === "elder") return <Loading />;

  const name = elder?.preferredName ?? "";
  const granted = PERMISSION_KEYS.filter((key) => actor.permissions?.[key]);
  const canManage = allowed("medications:write");

  return (
    <>
      <PageHeader title={t("family.title", { name })} subtitle={t("family.subtitle", { role: t(`role.${actor.role}`) })} />

      {elder?.phone ? (
        <Card className="space-y-3">
          <p className="text-lg font-extrabold">{t("family.contact", { name })}</p>
          <p className="text-2xl font-extrabold tracking-wide">{elder.phone}</p>
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${elder.phone.replace(/[^0-9+]/g, "")}`} className="inline-flex min-h-tap items-center gap-2 rounded-pill bg-primary-strong px-5 font-extrabold text-white">
              {t("family.call")}
            </a>
            <a href={`sms:${elder.phone.replace(/[^0-9+]/g, "")}`} className="inline-flex min-h-tap items-center gap-2 rounded-pill border-2 border-primary-strong px-5 font-extrabold text-primary-strong">
              {t("family.message")}
            </a>
          </div>
        </Card>
      ) : null}

      <Notice icon="shield">
        <p className="font-bold">{t("family.accessTitle", { name })}</p>
        {granted.length > 0 ? (
          <ul className="list-disc pl-5">
            {granted.map((key) => (
              <li key={key}>{t(`perm.${key}`)}</li>
            ))}
          </ul>
        ) : (
          <p>{t("family.accessNone")}</p>
        )}
      </Notice>

      {allowed("help:read") ? (
        <Section title={t("family.help")} id="fam-help">
          <HelpRequestsPanel />
        </Section>
      ) : null}

      {allowed("checkins:readShared") || allowed("summaries:readShared") || allowed("help:read") ? (
        <Section title={t("family.notices")} id="fam-notices">
          <NoticesPanel />
        </Section>
      ) : null}

      {allowed("medications:read") ? (
        <Section title={t("family.medsToday")} id="fam-meds" action={canManage ? <ButtonLink href="/medications" variant="secondary" icon="edit">{t("family.manage")}</ButtonLink> : null}>
          <MedicationsPanel />
        </Section>
      ) : null}

      {allowed("appointments:read") ? (
        <Section title={t("appt.upcoming")} id="fam-appt" action={allowed("appointments:write") ? <ButtonLink href="/appointments" variant="secondary" icon="edit">{t("family.manage")}</ButtonLink> : null}>
          <AppointmentsPanel />
        </Section>
      ) : null}

      {allowed("checkins:readShared") ? (
        <Section title={t("family.sharedCheckins")} id="fam-checkins">
          <CheckinsPanel />
        </Section>
      ) : null}

      {allowed("summaries:readShared") ? (
        <Section title={t("family.sharedSummaries")} id="fam-summaries">
          <SummariesPanel />
        </Section>
      ) : null}

      <Section title={t("family.schedule")} id="fam-schedule">
        <p className="text-ink-soft">{t("family.scheduleBody", { name })}</p>
        <ScheduleManager />
      </Section>

      {allowed("lifebook:contribute") || allowed("lifebook:read") ? (
        <Section title={t("nav.lifebook")} id="fam-lifebook">
          <Card className="space-y-3">
            <p>{t("family.lifebookBody", { name })}</p>
            <ButtonLink href="/lifebook" icon="book">
              {t("family.openLifebook")}
            </ButtonLink>
          </Card>
        </Section>
      ) : null}
    </>
  );
}
