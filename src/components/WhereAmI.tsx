"use client";

import { useState } from "react";
import { useAsyncData, useNow } from "@/hooks/useAsyncData";
import { useSpeech } from "@/lib/ai/useSpeech";
import { toDateKey } from "@/lib/domain/dates";
import { orientationLines } from "@/lib/domain/orientation";
import { PERSONA_GENDER } from "@shared/persona";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

/** One big button that always gives the same calm answer: who you are, where, what day, what's next. Read aloud too. */
export function WhereAmI({ large = false }: { large?: boolean }) {
  const { t, locale, prefs } = usePrefs();
  const { repo, elderId, elder } = useReadySession();
  const now = useNow();
  const speech = useSpeech(locale, PERSONA_GENDER[prefs.companion]);
  const [open, setOpen] = useState(false);
  const data = useAsyncData(async () => {
    const [appointments, schedules, lifebook] = await Promise.all([
      repo.listAppointments(elderId),
      repo.listSchedules(elderId),
      repo.listLifebook(elderId),
    ]);
    return {
      appointments,
      schedules,
      people: lifebook.filter((e) => e.category === "people"),
    };
  }, [repo, elderId]);
  const lines = data.data
    ? orientationLines({
        elder,
        now,
        todayKey: toDateKey(now),
        ...data.data,
        t,
        locale,
      })
    : [];

  return (
    <div className="space-y-3">
      <Button
        size="lg"
        variant={large ? "primary" : "secondary"}
        icon="question"
        className={large ? "w-full !min-h-[5rem] text-2xl" : ""}
        onClick={() => {
          setOpen(true);
          if (lines.length && prefs.voiceOutput) speech.speak(lines.join(" "));
        }}
      >
        {t("where.button")}
      </Button>
      {open && lines.length ? (
        <Card className="space-y-2 text-xl" aria-live="polite">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <Button
            variant="quiet"
            onClick={() => {
              speech.stopSpeaking();
              setOpen(false);
            }}
          >
            {t("where.close")}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
