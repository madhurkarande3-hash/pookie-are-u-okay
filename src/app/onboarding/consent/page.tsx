"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConsentForm, type ConsentChoices } from "@/components/ConsentForm";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import { Notice, describeError } from "@/components/ui/Feedback";
import { formatTime } from "@/lib/domain/dates";
import { DEFAULT_SCHEDULE, proposeSchedule } from "@/lib/domain/schedule";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession, useSession } from "@/state/SessionProvider";

export default function ConsentPage() {
  const { t, locale } = usePrefs();
  const { elder, repo, elderId, actor } = useReadySession();
  const { saveElder } = useSession();
  const router = useRouter();
  const [choices, setChoices] = useState<ConsentChoices>({
    aiPersonalization: elder?.consent.aiPersonalization ?? false,
    saveSummaries: elder?.consent.saveSummaries ?? false,
    reminders: elder?.consent.reminders ?? false,
  });
  const [useSchedule, setUseSchedule] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const finish = async () => {
    if (!elder) return;
    setBusy(true);
    setError(null);
    try {
      const now = new Date();
      if (useSchedule) {
        const existing = await repo.listSchedules(elderId);
        if (existing.length === 0) {
          await Promise.all(DEFAULT_SCHEDULE.map((slot) => repo.saveSchedule(elderId, proposeSchedule(actor, t(slot.labelKey), slot.time, now))));
        }
      }
      await saveElder({ ...elder, onboarded: true, consent: { ...elder.consent, ...choices, updatedAt: now.toISOString() } });
      router.push("/home");
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("consent.title")} subtitle={t("consent.subtitle")} />
      <Card>
        <ConsentForm value={choices} onChange={(patch) => setChoices((c) => ({ ...c, ...patch }))} />
      </Card>
      <Card>
        <Checkbox label={t("consent.useSchedule")} checked={useSchedule} onChange={setUseSchedule}>
          {DEFAULT_SCHEDULE.map((slot) => `${t(slot.labelKey)} ${formatTime(slot.time, locale)}`).join(" · ")}
        </Checkbox>
      </Card>
      <Notice icon="shield">
        <p>{t("consent.changeLater")}</p>
        <Link href="/privacy" className="font-bold text-primary-strong underline underline-offset-4">
          {t("privacy.open")}
        </Link>
      </Notice>
      {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
      <Button size="lg" icon="check" busy={busy} onClick={() => void finish()}>
        {t("consent.finish")}
      </Button>
    </div>
  );
}
