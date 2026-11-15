"use client";

import { useAsyncData, useNow } from "@/hooks/useAsyncData";
import { usePolicy } from "@/hooks/usePolicy";
import { summarisePatient } from "@/lib/careTeam/summary";
import { formatDate, formatTime, toDateKey } from "@/lib/domain/dates";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";
import { Card } from "./ui/Card";

/** "Today with {name}": one calm summary built only from what this member may see. */
export function FamilyDigest() {
  const { t, locale } = usePrefs();
  const { repo, elderId, elder } = useReadySession();
  const allowed = usePolicy();
  const now = useNow();
  const today = toDateKey(now);
  const meds = allowed("medications:read");
  const checks = allowed("checkins:read");
  const visits = allowed("appointments:read");
  const help = allowed("help:read");
  const data = useAsyncData(async () => {
    const [medications, doseLogs, checkins, appointments, helpReqs] =
      await Promise.all([
        meds ? repo.listMedications(elderId) : null,
        meds ? repo.listDoseLogs(elderId, today) : null,
        checks ? repo.listCheckins(elderId, 1) : null,
        visits ? repo.listAppointments(elderId) : null,
        help ? repo.listHelpRequests(elderId, 10) : null,
      ]);
    return summarisePatient(
      {
        elderId,
        elder,
        medications,
        doseLogs,
        checkins,
        appointments,
        help: helpReqs,
      },
      today,
      now,
    );
  }, [repo, elderId, today, meds, checks, visits, help]);
  const s = data.data;
  if (!s || !elder) return null;
  const lines = [
    s.doses
      ? t("digest.doses", {
          taken: s.doses.taken,
          missed: s.doses.missed,
          unconfirmed: s.doses.unconfirmed,
          later: s.doses.later,
        })
      : null,
    s.lastCheckin
      ? t("digest.checkin", {
          date: formatDate(s.lastCheckin.dateKey, locale),
          mood: t(`checkin.mood.${s.lastCheckin.mood}`),
        })
      : checks
        ? t("digest.noCheckin")
        : null,
    s.nextVisit
      ? t("digest.visit", {
          doctor: s.nextVisit.doctor,
          date: formatDate(s.nextVisit.date, locale),
          time: formatTime(s.nextVisit.time, locale),
        })
      : null,
    help
      ? s.openHelp
        ? t("digest.help", { count: s.openHelp })
        : t("digest.noHelp")
      : null,
  ].filter((x): x is string => Boolean(x));
  return (
    <Card className="space-y-2" aria-labelledby="digest-title">
      <h2 id="digest-title" className="text-xl font-extrabold">
        {t("digest.title", { name: elder.preferredName })}
      </h2>
      {lines.length ? (
        <ul className="list-disc space-y-1 ps-6">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">{t("digest.nothing")}</p>
      )}
      <p className="text-sm text-ink-soft">{t("digest.note")}</p>
    </Card>
  );
}
