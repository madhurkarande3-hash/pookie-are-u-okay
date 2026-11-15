"use client";

import { useState } from "react";
import { CircleManager } from "@/components/CircleManager";
import { ScheduleManager } from "@/components/ScheduleManager";
import { Card, PageHeader, Section } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Choice";
import { EmptyState, describeError } from "@/components/ui/Feedback";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession, useSession } from "@/state/SessionProvider";

export default function CareCirclePage() {
  const { t } = usePrefs();
  const { actor, elder } = useReadySession();
  const { saveElder } = useSession();
  const [error, setError] = useState<unknown>(null);

  if (actor.role !== "elder" || !elder) return <EmptyState icon="shield" title={t("error.noAccessTitle")} body={t("error.noAccessBody")} />;

  const setPaused = async (sharingPaused: boolean) => {
    setError(null);
    try {
      await saveElder({ ...elder, consent: { ...elder.consent, sharingPaused, updatedAt: new Date().toISOString() } });
    } catch (e) {
      setError(e);
    }
  };

  return (
    <>
      <PageHeader title={t("circle.title")} subtitle={t("circle.subtitle")} />
      <Card>
        <Toggle label={t("circle.pauseAll")} description={t("circle.pauseAllDesc")} checked={elder.consent.sharingPaused} onChange={(v) => void setPaused(v)} />
        {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
      </Card>
      <Section title={t("circle.members")} id="circle-members">
        <CircleManager />
      </Section>
      <Section title={t("sched.title")} id="circle-schedule">
        <p className="text-ink-soft">{t("sched.subtitle")}</p>
        <ScheduleManager />
      </Section>
    </>
  );
}
