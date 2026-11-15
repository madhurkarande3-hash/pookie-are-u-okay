"use client";

import { useEffect, useState } from "react";
import { useRecorder } from "@/lib/media";
import { usePrefs } from "@/state/PrefsProvider";
import { Button } from "./ui/Button";

/** Record a short voice clip; reports each new recording once. */
export function VoiceInput({
  onRecorded,
}: {
  onRecorded: (blob: Blob | null) => void;
}) {
  const { t } = usePrefs();
  const recorder = useRecorder();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!recorder.blob) return undefined;
    onRecorded(recorder.blob);
    const next = URL.createObjectURL(recorder.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report each new recording once
  }, [recorder.blob]);
  if (recorder.state === "unsupported")
    return <p className="text-ink-soft">{t("life.noRecorder")}</p>;
  return (
    <div className="space-y-2">
      {recorder.state === "recording" ? (
        <Button variant="danger" icon="stop" onClick={recorder.stop}>
          {t("life.stopRecording")}
        </Button>
      ) : (
        <Button
          variant="secondary"
          icon="mic"
          onClick={() => void recorder.start()}
        >
          {recorder.state === "done" ? t("life.recordAgain") : t("life.record")}
        </Button>
      )}
      <p role="status" aria-live="polite" className="text-sm text-ink-soft">
        {recorder.state === "recording"
          ? t("life.recordingNow", { seconds: recorder.seconds })
          : t("life.recordHint")}
      </p>
      {recorder.state === "blocked" ? (
        <p role="alert" className="font-bold text-danger">
          {t("life.micBlocked")}
        </p>
      ) : null}
      {url ? <audio controls src={url} className="w-full" /> : null}
    </div>
  );
}
