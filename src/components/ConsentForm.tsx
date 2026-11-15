"use client";

import type { Consent } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { Toggle } from "./ui/Choice";

export type ConsentChoices = Pick<Consent, "aiPersonalization" | "saveSummaries" | "reminders">;

/** Every permission is off until the elder turns it on, and can be turned off again at any time. */
export function ConsentForm({ value, onChange, disabled = false }: { value: ConsentChoices; onChange: (patch: Partial<ConsentChoices>) => void; disabled?: boolean }) {
  const { t } = usePrefs();
  return (
    <div className="divide-y divide-line">
      <Toggle label={t("consent.ai")} description={t("consent.aiDesc")} checked={value.aiPersonalization} onChange={(v) => onChange({ aiPersonalization: v })} disabled={disabled} />
      <Toggle label={t("consent.summaries")} description={t("consent.summariesDesc")} checked={value.saveSummaries} onChange={(v) => onChange({ saveSummaries: v })} disabled={disabled} />
      <Toggle label={t("consent.reminders")} description={t("consent.remindersDesc")} checked={value.reminders} onChange={(v) => onChange({ reminders: v })} disabled={disabled} />
    </div>
  );
}
