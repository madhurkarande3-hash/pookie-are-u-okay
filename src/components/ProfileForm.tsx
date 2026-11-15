"use client";

import { useState, type FormEvent } from "react";
import { LIMITS, cleanPhone, cleanText } from "@/lib/domain/validation";
import type { ElderProfile } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useSession } from "@/state/SessionProvider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { describeError } from "./ui/Feedback";
import { TextField } from "./ui/Field";

/** Lets the elder change their name and what Pookie calls them, at any time. */
export function ProfileForm({ elder }: { elder: ElderProfile }) {
  const { t } = usePrefs();
  const { saveElder } = useSession();
  const [fullName, setFullName] = useState(elder.fullName);
  const [preferredName, setPreferredName] = useState(elder.preferredName);
  const [phone, setPhone] = useState(elder.phone ?? "");
  const [homeLabel, setHomeLabel] = useState(elder.homeLabel ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const name = cleanText("fullName", fullName, LIMITS.name, true);
      await saveElder({
        ...elder,
        fullName: name,
        preferredName: cleanText(
          "preferredName",
          preferredName || name,
          LIMITS.name,
          true,
        ),
        phone: cleanPhone(phone),
        homeLabel: cleanText("homeLabel", homeLabel, 120),
      });
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <TextField
          label={t("profile.fullName")}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={LIMITS.name}
          autoComplete="name"
          required
        />
        <TextField
          label={t("profile.preferredName")}
          hint={t("profile.preferredHint")}
          value={preferredName}
          onChange={(e) => setPreferredName(e.target.value)}
          maxLength={LIMITS.name}
        />
        <TextField
          label={t("profile.phone")}
          hint={t("profile.phoneHint")}
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={20}
          autoComplete="tel"
        />
        <TextField
          label={t("profile.home")}
          hint={t("profile.homeHint")}
          value={homeLabel}
          onChange={(e) => setHomeLabel(e.target.value)}
          maxLength={120}
        />
        {error ? (
          <p role="alert" className="font-bold text-danger">
            {describeError(error, t)}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="font-bold text-ok">
            {t("settings.profileSaved")}
          </p>
        ) : null}
        <Button type="submit" busy={busy} icon="check">
          {t("common.save")}
        </Button>
      </form>
    </Card>
  );
}
