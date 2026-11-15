"use client";

import { useState } from "react";
import type { DecisionMode, Guardian } from "@/lib/types";
import { type DecisionChoice } from "@/lib/domain/decision";

export { decisionReady, type DecisionChoice } from "@/lib/domain/decision";
import { usePrefs } from "@/state/PrefsProvider";
import { Checkbox, ChoiceGroup } from "./ui/Choice";
import { TextField } from "./ui/Field";

/**
 * Who makes privacy choices. Supported decision-making keeps the elder in
 * charge with a named helper; guardian mode is for a lawful guardian only
 * and needs their attestation. Either way the elder's own wishes come first.
 */
export function DecisionSupport({
  value,
  onChange,
}: {
  value: DecisionChoice;
  onChange: (next: DecisionChoice) => void;
}) {
  const { t } = usePrefs();
  const [g, setG] = useState<Guardian>(
    value.guardian ?? {
      name: "",
      relationship: "",
      attested: false,
      recordedAt: new Date().toISOString(),
    },
  );
  const update = (patch: Partial<Guardian>, mode = value.mode) => {
    const next = { ...g, ...patch, recordedAt: new Date().toISOString() };
    setG(next);
    onChange({ mode, guardian: mode === "self" ? null : next });
  };
  return (
    <div className="space-y-3">
      <ChoiceGroup
        legend={t("decide.legend")}
        value={value.mode}
        onChange={(mode) => update({}, mode as DecisionMode)}
        options={(["self", "supported", "guardian"] as const).map((m) => ({
          value: m,
          label: t(`decide.${m}`),
        }))}
      />
      <p className="text-ink-soft">{t(`decide.${value.mode}Help`)}</p>
      {value.mode !== "self" ? (
        <div className="space-y-3">
          <TextField
            label={
              value.mode === "guardian"
                ? t("decide.guardianName")
                : t("decide.supporterName")
            }
            value={g.name}
            onChange={(e) => update({ name: e.target.value })}
            maxLength={80}
          />
          <TextField
            label={t("decide.relationship")}
            value={g.relationship}
            onChange={(e) => update({ relationship: e.target.value })}
            maxLength={80}
          />
          {value.mode === "guardian" ? (
            <Checkbox
              checked={g.attested}
              onChange={(attested) => update({ attested })}
              label={t("decide.attest")}
            />
          ) : null}
          <p className="text-sm text-ink-soft">{t("decide.wishes")}</p>
        </div>
      ) : null}
    </div>
  );
}
