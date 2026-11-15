"use client";

import { useEffect, useRef, useState } from "react";
import type { Medication } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";
import { Button } from "./ui/Button";
import { describeError } from "./ui/Feedback";
import { VoiceInput } from "./VoiceInput";

/** Plays the family member's recorded reminder for this medicine. */
export function PlayVoiceNote({
  medication,
  autoPlay = false,
}: {
  medication: Medication;
  autoPlay?: boolean;
}) {
  const { t } = usePrefs();
  const { repo } = useReadySession();
  const audio = useRef<HTMLAudioElement | null>(null);
  const note = medication.voiceNote;
  const play = async () => {
    if (!note) return;
    const url = await repo.lifebookMediaUrl(note.media);
    audio.current?.pause();
    audio.current = new Audio(url);
    await audio.current.play().catch(() => undefined);
  };
  useEffect(() => {
    if (autoPlay) void play();
    return () => audio.current?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play once when the dose becomes due
  }, [autoPlay, note?.media.path, note?.media.dataUrl]);
  if (!note) return null;
  return (
    <Button variant="secondary" icon="play" onClick={() => void play()}>
      {t("medVoice.play", { name: note.byName })}
    </Button>
  );
}

/** A family member (or the elder) records "time for your tablet" in a familiar voice. */
export function RecordVoiceNote({
  medication,
  onSaved,
}: {
  medication: Medication;
  onSaved: () => void;
}) {
  const { t } = usePrefs();
  const { repo, elderId, actor } = useReadySession();
  const [open, setOpen] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async (remove: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const voiceNote =
        remove || !blob
          ? null
          : {
              media: await repo.saveLifebookMedia(
                elderId,
                `med-${medication.id}`,
                blob,
                "audio",
              ),
              byName: actor.name,
            };
      await repo.saveMedication(elderId, { ...medication, voiceNote });
      setOpen(false);
      setBlob(null);
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <Button variant="quiet" icon="mic" onClick={() => setOpen(true)}>
        {medication.voiceNote ? t("medVoice.change") : t("medVoice.add")}
      </Button>
    );
  return (
    <div className="space-y-2 rounded-2xl border-2 border-line p-3">
      <p className="text-sm text-ink-soft">{t("medVoice.hint")}</p>
      <VoiceInput onRecorded={setBlob} />
      <div className="flex flex-wrap gap-2">
        <Button busy={busy} disabled={!blob} onClick={() => void save(false)}>
          {t("common.save")}
        </Button>
        {medication.voiceNote ? (
          <Button variant="danger" busy={busy} onClick={() => void save(true)}>
            {t("medVoice.remove")}
          </Button>
        ) : null}
        <Button variant="quiet" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="font-bold text-danger">
          {describeError(error, t)}
        </p>
      ) : null}
    </div>
  );
}
