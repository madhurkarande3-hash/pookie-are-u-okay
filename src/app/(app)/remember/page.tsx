"use client";

import { useEffect, useMemo, useState } from "react";
import { MediaView } from "@/components/MediaView";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { EmptyState, Loading } from "@/components/ui/Feedback";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useSpeech } from "@/lib/ai/useSpeech";
import type { LifebookEntry } from "@/lib/types";
import { PERSONA_GENDER } from "@shared/persona";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

const KINDS = new Set(["photos", "voice", "favorites", "places", "stories", "milestones"]);

/**
 * Reminiscence: one approved memory at a time, read aloud with a gentle,
 * open invitation to talk. It tells, it never asks the elder to remember.
 */
export default function RememberPage() {
  const { t, locale, prefs } = usePrefs();
  const { repo, elderId } = useReadySession();
  const speech = useSpeech(locale, PERSONA_GENDER[prefs.companion]);
  const data = useAsyncData(() => repo.listLifebook(elderId), [repo, elderId]);
  const memories = useMemo(() => (data.data ?? []).filter((e) => e.confirmed && KINDS.has(e.category)), [data.data]);
  const [index, setIndex] = useState(0);
  const memory: LifebookEntry | undefined = memories.at(index % Math.max(memories.length, 1));

  const story = memory ? [t("remember.intro", { title: memory.title }), memory.detail, memory.when ? t("remember.when", { when: memory.when }) : "", t(`remember.invite.${memory.category === "voice" ? "voice" : "other"}`)].filter(Boolean).join(" ") : "";

  useEffect(() => {
    if (story && prefs.voiceOutput && memory?.category !== "voice") speech.speak(story);
    return () => speech.stopSpeaking();
    // Read each memory once when it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memory?.id]);

  if (data.loading && !data.data) return <Loading />;
  if (!memory) return <EmptyState icon="book" title={t("remember.emptyTitle")} body={t("remember.emptyBody")} action={<ButtonLink href="/lifebook">{t("nav.lifebook")}</ButtonLink>} />;

  return (
    <>
      <PageHeader title={t("remember.title")} subtitle={t("remember.subtitle")} />
      <Card className="space-y-4 text-center">
        {memory.media ? <MediaView media={memory.media} title={memory.title} /> : null}
        <h2 className="text-3xl font-extrabold">{memory.title}</h2>
        <p className="text-xl">{story}</p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <ButtonLink href="/companion" size="lg" icon="chat">
          {t("remember.talk")}
        </ButtonLink>
        <Button size="lg" variant="secondary" icon="play" onClick={() => speech.speak(story)}>
          {t("remember.again")}
        </Button>
        <Button size="lg" variant="secondary" icon="arrow" onClick={() => setIndex((i) => i + 1)}>
          {t("remember.next")}
        </Button>
      </div>
    </>
  );
}
