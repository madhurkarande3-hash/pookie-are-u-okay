"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/Choice";
import { describeError } from "@/components/ui/Feedback";
import { TextField } from "@/components/ui/Field";
import { LIMITS, cleanText } from "@/lib/domain/validation";
import { LANGUAGE_NAMES } from "@/lib/i18n";
import type { ElderProfile } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession, useSession } from "@/state/SessionProvider";

export default function ProfileSetupPage() {
  const { t, prefs, setPrefs } = usePrefs();
  const { elder, elderId } = useReadySession();
  const { saveElder } = useSession();
  const router = useRouter();
  const [fullName, setFullName] = useState(elder?.fullName ?? "");
  const [preferredName, setPreferredName] = useState(elder?.preferredName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const profile: ElderProfile = {
        id: elderId,
        fullName: cleanText("fullName", fullName, LIMITS.name, true),
        preferredName: cleanText("preferredName", preferredName || fullName, LIMITS.name, true),
        pookie: prefs.pookie,
        companion: prefs.companion,
        language: prefs.language,
        // Everything is off until the consent step; nothing is assumed.
        consent: elder?.consent ?? { aiPersonalization: false, saveSummaries: false, reminders: false, sharingPaused: false, updatedAt: now },
        onboarded: elder?.onboarded ?? false,
        createdAt: elder?.createdAt ?? now,
      };
      await saveElder(profile);
      router.push("/onboarding/circle");
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />
      <Card>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <TextField label={t("profile.fullName")} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={80} required />
          <TextField label={t("profile.preferredName")} hint={t("profile.preferredHint")} value={preferredName} onChange={(e) => setPreferredName(e.target.value)} autoComplete="nickname" maxLength={80} />
          <ChoiceGroup
            legend={t("profile.language")}
            columns="grid-cols-2"
            value={prefs.language}
            onChange={(language) => setPrefs({ language })}
            options={[
              { value: "en", label: LANGUAGE_NAMES.en },
              { value: "hi", label: LANGUAGE_NAMES.hi },
            ]}
          />
          {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
          <Button type="submit" size="lg" icon="arrow" busy={busy}>
            {t("common.next")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
