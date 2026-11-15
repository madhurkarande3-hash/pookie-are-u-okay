"use client";

import type { LifebookEntry } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
import { usePrefs } from "@/state/PrefsProvider";
import { MediaView } from "./MediaView";
import { Card } from "./ui/Card";

function partOfDay(hour: number): MessageKey {
  if (hour >= 5 && hour < 12) return "orient.morning";
  if (hour >= 12 && hour < 17) return "orient.afternoon";
  if (hour >= 17 && hour < 21) return "orient.evening";
  return "orient.night";
}

/** Same pick all day (photo) or all hour (routine), so the card is calm rather than shuffling. */
const pick = <T,>(items: readonly T[], seed: number): T | undefined => (items.length ? items.at(seed % items.length) : undefined);

/**
 * Gentle orientation: today's date and time of day in plain words, one usual
 * routine and one approved photo. It only shows; it never asks questions or tests memory.
 */
export function OrientationCard({ now, entries }: { now: Date; entries: readonly LifebookEntry[] }) {
  const { t, locale } = usePrefs();
  const approved = entries.filter((e) => e.confirmed);
  const routine = pick(approved.filter((e) => e.category === "everyday"), now.getHours());
  const dayNumber = Math.floor(now.getTime() / 86_400_000);
  const photo = pick(approved.filter((e) => e.category === "photos" && e.media?.kind === "photo"), dayNumber);
  return (
    <Card className="space-y-3">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">{t("orient.title")}</p>
      <p className="text-2xl font-extrabold">{now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      <p className="text-lg">{t(partOfDay(now.getHours()))}</p>
      {routine ? (
        <div>
          <p className="font-bold text-ink-soft">{t("orient.routine")}</p>
          <p className="text-lg">{routine.title}</p>
        </div>
      ) : null}
      {photo?.media ? (
        <div className="space-y-2">
          <p className="font-bold text-ink-soft">{t("orient.photo")}</p>
          <MediaView media={photo.media} title={photo.title} />
          <p>{photo.title}</p>
        </div>
      ) : null}
    </Card>
  );
}
