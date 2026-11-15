"use client";

import type { DoseState } from "@/lib/domain/medication";
import type { MessageKey } from "@/lib/i18n";
import { usePrefs } from "@/state/PrefsProvider";
import { StatusBadge } from "./ui/Feedback";
import type { IconName } from "./ui/Icon";

export const DOSE_VIEW: Record<DoseState, { tone: "ok" | "warn" | "danger" | "neutral"; icon: IconName; label: MessageKey }> = {
  taken: { tone: "ok", icon: "check", label: "dose.taken" },
  missed: { tone: "danger", icon: "cross", label: "dose.missed" },
  unconfirmed: { tone: "warn", icon: "question", label: "dose.unconfirmed" },
  due: { tone: "warn", icon: "bell", label: "dose.due" },
  upcoming: { tone: "neutral", icon: "clock", label: "dose.upcoming" },
};

export function DoseBadge({ state }: { state: DoseState }) {
  const { t } = usePrefs();
  const view = DOSE_VIEW[state];
  return (
    <StatusBadge tone={view.tone} icon={view.icon}>
      {t(view.label)}
    </StatusBadge>
  );
}
