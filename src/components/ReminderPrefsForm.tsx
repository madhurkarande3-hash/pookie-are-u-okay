"use client";

import { useEffect, useState, type FormEvent } from "react";
import { REMINDER_KINDS, defaultNotifyPrefs, type NotifyPrefs } from "@shared/notifyPrefs";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Toggle } from "./ui/Choice";
import { ErrorNote, Loading, Notice, describeError } from "./ui/Feedback";
import { SelectField, TextField } from "./ui/Field";

export function detectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

function timezoneList(current: string): string[] {
  const all = (Intl as { supportedValuesOf?: (key: "timeZone") => string[] }).supportedValuesOf?.("timeZone") ?? [];
  return Array.from(new Set([current, "Asia/Kolkata", ...all])).sort();
}

/** Each person's own reminder settings: timezone, quiet hours, which reminders, which channels. */
export function ReminderPrefsForm() {
  const { t } = usePrefs();
  const { repo, actor } = useReadySession();
  const stored = useAsyncData(() => repo.getNotifyPrefs(actor.uid), [repo, actor.uid]);
  const [draft, setDraft] = useState<NotifyPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushState, setPushState] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (stored.data !== undefined && draft === null) setDraft(stored.data ?? defaultNotifyPrefs(detectedTimezone()));
  }, [stored.data, draft]);

  if (stored.error) return <ErrorNote error={stored.error} onRetry={stored.reload} />;
  if (!draft) return <Loading />;

  const update = (patch: Partial<NotifyPrefs>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let next = draft;
      setPushState(null);
      if (repo.mode === "firebase" && draft.channels.push) {
        const result = await (await import("@/lib/firebase/messaging")).enablePush(actor.uid);
        setPushState(result);
        // Push could not be turned on: keep it off rather than pretend it works.
        if (result !== "enabled") next = { ...draft, channels: { ...draft.channels, push: false } };
      }
      await repo.saveNotifyPrefs(actor.uid, { ...next, updatedAt: new Date().toISOString() });
      setDraft(next);
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={(e) => void submit(e)} className="space-y-5">
        <SelectField label={t("notify.timezone")} hint={t("notify.timezoneHint")} value={draft.timezone} onChange={(e) => update({ timezone: e.target.value })}>
          {timezoneList(draft.timezone).map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </SelectField>
        <fieldset className="space-y-2">
          <legend className="font-bold">{t("notify.quiet")}</legend>
          <p className="text-sm text-ink-soft">{t("notify.quietHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("notify.quietFrom")} type="time" value={draft.quietStart} onChange={(e) => update({ quietStart: e.target.value })} required />
            <TextField label={t("notify.quietTo")} type="time" value={draft.quietEnd} onChange={(e) => update({ quietEnd: e.target.value })} required />
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-bold">{t("notify.kinds")}</legend>
          {REMINDER_KINDS.map((kind) => (
            <Toggle key={kind} label={t(`notify.kind.${kind}`)} checked={draft.kinds[kind]} onChange={(on) => update({ kinds: { ...draft.kinds, [kind]: on } })} />
          ))}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-bold">{t("notify.channels")}</legend>
          <p className="text-sm text-ink-soft">{t("notify.inAppAlways")}</p>
          {repo.mode === "firebase" ? (
            <>
              <Toggle label={t("notify.push")} description={t("notify.pushDesc")} checked={draft.channels.push} onChange={(push) => update({ channels: { ...draft.channels, push } })} />
              <Toggle label={t("notify.email")} description={t("notify.emailDesc")} checked={draft.channels.email} onChange={(email) => update({ channels: { ...draft.channels, email } })} />
            </>
          ) : (
            <Notice>
              <p>{t("notify.channelsDemo")}</p>
            </Notice>
          )}
        </fieldset>
        {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
        {saved ? (
          <p role="status" className="font-bold text-ok">
            {t("notify.saved")}
          </p>
        ) : null}
        {pushState && pushState !== "enabled" ? (
          <p role="alert" className="font-bold text-warn">
            {t(`notify.pushState.${pushState as "unsupported" | "denied" | "not-configured"}`)}
          </p>
        ) : null}
        <Button type="submit" busy={busy} icon="check">
          {t("common.save")}
        </Button>
      </form>
    </Card>
  );
}
