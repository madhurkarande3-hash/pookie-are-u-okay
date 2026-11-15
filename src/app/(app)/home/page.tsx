"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DoseBadge } from "@/components/DoseStatus";
import { HelpRequestCard } from "@/components/HelpRequest";
import { OrientationCard } from "@/components/OrientationCard";
import { PookieAvatar } from "@/components/PookieAvatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card, Section } from "@/components/ui/Card";
import { EmptyState, ErrorNote, Loading, Notice, StatusBadge } from "@/components/ui/Feedback";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useAsyncData, useNow } from "@/hooks/useAsyncData";
import { formatDate, formatTime, toDateKey } from "@/lib/domain/dates";
import { buildDailyDoses } from "@/lib/domain/medication";
import { appliesOn, scheduleLabel, slotState, type SlotState } from "@/lib/domain/schedule";
import type { MessageKey } from "@/lib/i18n";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";
import { en } from "@/lib/i18n/en";
import { hi } from "@/lib/i18n/hi";

const LABEL_DICTS = [en, hi] as const;

const TILES: readonly { href: string; icon: IconName; label: MessageKey }[] = [
  { href: "/companion", icon: "chat", label: "home.tile.talk" },
  { href: "/medications", icon: "pill", label: "home.tile.medicines" },
  { href: "/checkin", icon: "heart", label: "home.tile.checkin" },
  { href: "/appointments", icon: "calendar", label: "home.tile.appointments" },
  { href: "/lifebook", icon: "book", label: "home.tile.lifebook" },
  { href: "/circle", icon: "users", label: "home.tile.circle" },
];

const SLOT_VIEW: Record<SlotState, { tone: "ok" | "warn" | "neutral"; icon: IconName; label: MessageKey }> = {
  completed: { tone: "ok", icon: "check", label: "slot.completed" },
  open: { tone: "warn", icon: "bell", label: "slot.open" },
  upcoming: { tone: "neutral", icon: "clock", label: "slot.upcoming" },
  noResponse: { tone: "neutral", icon: "question", label: "slot.noResponse" },
};

function greetingKey(hour: number): MessageKey {
  if (hour < 12) return "home.morning";
  return hour < 17 ? "home.afternoon" : "home.evening";
}

export default function HomePage() {
  const { t, locale, prefs } = usePrefs();
  const { repo, elderId, elder, actor } = useReadySession();
  const router = useRouter();
  const now = useNow();
  const today = toDateKey(now);

  useEffect(() => {
    if (actor.role !== "elder") router.replace("/family");
  }, [actor.role, router]);

  const data = useAsyncData(async () => {
    const [medications, logs, schedules, checkins, summaries, appointments, lifebook, circle] = await Promise.all([
      repo.listMedications(elderId),
      repo.listDoseLogs(elderId, today),
      repo.listSchedules(elderId),
      repo.listCheckins(elderId, 10),
      repo.listSummaries(elderId, 10),
      repo.listAppointments(elderId),
      repo.listLifebook(elderId),
      repo.listCircle(elderId),
    ]);
    return { medications, logs, schedules, checkins, summaries, appointments, lifebook, circle };
  }, [repo, elderId, today]);

  if (actor.role !== "elder") return <Loading />;

  const d = data.data;
  const doses = d ? buildDailyDoses(d.medications, d.logs, today, today, now) : [];
  const nextDose = doses.find((dose) => dose.state === "due" || dose.state === "unconfirmed") ?? doses.find((dose) => dose.state === "upcoming");
  const slots = d ? d.schedules.filter((s) => s.status === "accepted" && appliesOn(s, today)).map((s) => ({ schedule: s, state: slotState(s, today, d.checkins, d.summaries, now) })) : [];
  const proposals = d ? d.schedules.filter((s) => s.status === "proposed").length : 0;
  const pendingMemories = d ? d.lifebook.filter((e) => !e.confirmed).length : 0;
  const nextAppointment = d?.appointments.find((a) => a.date >= today && (a.status ?? "scheduled") === "scheduled");

  return (
    <>
      <header className="flex items-center gap-4">
        <PookieAvatar companion={prefs.companion} size={96} animate />
        <div>
          <h1 className="text-3xl font-extrabold leading-tight">{t(greetingKey(now.getHours()), { name: elder?.preferredName ?? "" })}</h1>
          <p className="text-ink-soft">
            <time dateTime={now.toISOString()}>{formatTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, locale)}</time>
          </p>
        </div>
      </header>

      {data.loading && !d ? <Loading /> : null}
      {data.error ? <ErrorNote error={data.error} onRetry={data.reload} /> : null}

      {proposals > 0 ? (
        <Notice icon="question" tone="warn">
          <p className="font-bold">{t("home.proposals", { count: proposals })}</p>
          <Link href="/circle" className="font-bold text-primary-strong underline underline-offset-4">
            {t("home.reviewProposals")}
          </Link>
        </Notice>
      ) : null}
      {pendingMemories > 0 ? (
        <Notice icon="book">
          <p className="font-bold">{t("home.pendingMemories", { count: pendingMemories })}</p>
          <Link href="/lifebook" className="font-bold text-primary-strong underline underline-offset-4">
            {t("home.reviewMemories")}
          </Link>
        </Notice>
      ) : null}

      {d ? <OrientationCard now={now} entries={d.lifebook} /> : null}

      {d ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Section title={t("home.checkins")} id="home-checkins">
            {slots.length === 0 ? (
              <EmptyState icon="clock" title={t("home.noSchedule")} action={<ButtonLink href="/circle" variant="secondary">{t("home.setSchedule")}</ButtonLink>} />
            ) : (
              <ul className="space-y-3">
                {slots.map(({ schedule, state }) => {
                  const view = SLOT_VIEW[state];
                  return (
                    <Card as="li" key={schedule.id} className={`space-y-3 ${state === "open" ? "border-2 border-primary-strong" : ""}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-lg font-extrabold">
                          {scheduleLabel(schedule.label, t, LABEL_DICTS)} · {formatTime(schedule.time, locale)}
                        </p>
                        <StatusBadge tone={view.tone} icon={view.icon}>
                          {t(view.label)}
                        </StatusBadge>
                      </div>
                      {state === "open" || state === "noResponse" ? (
                        <div className="flex flex-wrap gap-2">
                          <ButtonLink href={`/companion?slot=${schedule.id}`} icon="chat">
                            {t("home.talkNow")}
                          </ButtonLink>
                          <ButtonLink href={`/checkin?slot=${schedule.id}`} variant="secondary" icon="heart">
                            {t("home.quickCheckin")}
                          </ButtonLink>
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title={t("home.medicines")} id="home-meds" action={<Link href="/medications" className="font-bold text-primary-strong underline underline-offset-4">{t("home.openMedicines")}</Link>}>
            {doses.length === 0 ? (
              <EmptyState icon="pill" title={t("med.emptyTitle")} action={<ButtonLink href="/medications" variant="secondary" icon="plus">{t("med.add")}</ButtonLink>} />
            ) : (
              <Card className="space-y-2">
                {nextDose ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-lg font-extrabold">
                      {nextDose.medication.name} · {formatTime(nextDose.time, locale)}
                    </p>
                    <DoseBadge state={nextDose.state} />
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-lg font-extrabold">
                    <Icon name="check" className="h-6 w-6 text-ok" />
                    {t("home.allDosesAnswered")}
                  </p>
                )}
                <p className="text-ink-soft">{t("home.doseCount", { done: doses.filter((x) => x.log).length, total: doses.length })}</p>
              </Card>
            )}
          </Section>

          {nextAppointment ? (
            <Section title={t("home.nextAppointment")} id="home-appt">
              <Card>
                <p className="text-lg font-extrabold">{nextAppointment.doctor}</p>
                <p className="text-ink-soft">
                  {formatDate(nextAppointment.date, locale)} · {formatTime(nextAppointment.time, locale)}
                </p>
              </Card>
            </Section>
          ) : null}

          <Section title={t("home.circle")} id="home-circle" action={<Link href="/circle" className="font-bold text-primary-strong underline underline-offset-4">{t("home.openCircle")}</Link>}>
            <Card className="space-y-2">
              {d.circle.filter((m) => m.status === "active").length === 0 ? (
                <p className="text-ink-soft">{t("home.circleEmpty")}</p>
              ) : (
                <p className="text-lg font-bold">
                  {d.circle
                    .filter((m) => m.status === "active")
                    .map((m) => m.name)
                    .join(", ")}
                </p>
              )}
              {d.circle.some((m) => m.status === "invited") ? <p className="text-ink-soft">{t("home.circleInvited", { count: d.circle.filter((m) => m.status === "invited").length })}</p> : null}
              {elder?.consent.sharingPaused ? (
                <StatusBadge tone="warn" icon="pause">
                  {t("home.sharingPaused")}
                </StatusBadge>
              ) : null}
            </Card>
          </Section>

          <Section title={t("home.help")} id="home-help">
            <HelpRequestCard />
          </Section>
        </div>
      ) : null}

      <nav aria-label={t("home.shortcuts")}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TILES.map((tile) => (
            <li key={tile.href}>
              <Link href={tile.href} className="flex min-h-[6.5rem] flex-col items-center justify-center gap-2 rounded-card border border-line bg-surface p-4 text-center font-extrabold shadow-card hover:border-primary-strong">
                <Icon name={tile.icon} className="h-9 w-9 text-primary-strong" />
                <span>{t(tile.label)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
