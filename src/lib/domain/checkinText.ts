import type { MessageKey, Translate } from "@/lib/i18n";
import type { Checkin } from "@/lib/types";

/** One-line, plain-language description of a check-in (no scores, no interpretation). */
export function describeCheckin(c: Checkin, t: Translate): string {
  return [
    `${t("checkin.mood")}: ${t(`checkin.mood.${c.mood}` as MessageKey)}`,
    `${t("checkin.sleep")}: ${t(`checkin.sleep.${c.sleep}` as MessageKey)}`,
    `${t("checkin.energy")}: ${t(`checkin.energy.${c.energy}` as MessageKey)}`,
    `${t("checkin.assistance")}: ${t(`checkin.assist.${c.assistance}`)}`,
  ].join(" · ");
}
