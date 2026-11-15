"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveState, LiveVoice } from "@/lib/ai/liveSession";
import type { MessageKey } from "@/lib/i18n";
import type { Companion } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { PookieAvatar } from "./PookieAvatar";
import { Button } from "./ui/Button";
import { Notice } from "./ui/Feedback";
import { Icon, type IconName } from "./ui/Icon";

interface Line {
  who: "user" | "pookie";
  text: string;
}

const VIEW: Record<LiveState, { icon: IconName; label: MessageKey }> = {
  connecting: { icon: "clock", label: "live.connecting" },
  listening: { icon: "mic", label: "talk.status.listening" },
  thinking: { icon: "clock", label: "talk.status.thinking" },
  speaking: { icon: "chat", label: "talk.status.speaking" },
  paused: { icon: "pause", label: "talk.status.paused" },
  closed: { icon: "stop", label: "talk.endedTitle" },
  error: { icon: "info", label: "live.error" },
};

/** Real-time voice conversation with Gemini Live (preview). Ends with the usual note-and-consent step. */
export function LiveVoicePanel({ companion, onEnded, onFallback }: { companion: Companion; onEnded: (exchanges: number) => void; onFallback: () => void }) {
  const { t, prefs } = usePrefs();
  const [state, setState] = useState<LiveState>("connecting");
  const [lines, setLines] = useState<Line[]>([]);
  const voiceRef = useRef<LiveVoice | null>(null);
  const turnsRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    void import("@/lib/ai/liveSession").then(async ({ LiveVoice }) => {
      if (disposed) return;
      const voice = new LiveVoice(prefs.language, {
        onState: setState,
        onTranscript: (who, text) =>
          setLines((current) => {
            const last = current.at(-1);
            if (last && last.who === who) return [...current.slice(0, -1), { who, text: last.text + text }];
            if (who === "user") turnsRef.current += 1;
            return [...current, { who, text }];
          }),
        onTurnEnd: () => undefined,
      });
      voiceRef.current = voice;
      try {
        await voice.start();
      } catch {
        setState("error");
      }
    });
    return () => {
      disposed = true;
      voiceRef.current?.end();
    };
  }, [prefs.language]);

  const view = VIEW[state];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-card border-2 border-primary-strong bg-surface p-4">
        <PookieAvatar companion={companion} size={72} />
        <div>
          <p className="font-bold text-ink-soft">
            {t(`persona.${companion}.name`)} · {t("live.badge")}
          </p>
          <p role="status" aria-live="polite" className="flex items-center gap-2 text-xl font-extrabold text-primary-strong">
            <Icon name={view.icon} className="h-7 w-7" />
            {t(view.label)}
          </p>
        </div>
      </div>

      {lines.length > 0 ? (
        <ol role="log" aria-label={t("talk.transcript")} aria-live="polite" className="max-h-[22rem] space-y-3 overflow-y-auto rounded-card border border-line bg-surface p-4" tabIndex={0}>
          {lines.map((line, i) => (
            <li key={i} className={`flex flex-col ${line.who === "user" ? "items-end" : "items-start"}`}>
              <span className="text-sm font-bold text-ink-soft">{line.who === "user" ? t("talk.you") : `${t(`persona.${companion}.name`)} · ${t("talk.tagGemini")}`}</span>
              <p className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-lg ${line.who === "user" ? "bg-primary-strong text-white" : "border border-line bg-bg"}`}>{line.text}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {state === "error" ? (
        <Notice tone="warn">
          <p>{t("live.errorBody")}</p>
          <Button variant="secondary" onClick={onFallback}>
            {t("live.useStandard")}
          </Button>
        </Notice>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" size="lg" icon="stop" disabled={state !== "speaking"} onClick={() => voiceRef.current?.stopPlayback()}>
            {t("talk.interrupt")}
          </Button>
          <Button variant="secondary" size="lg" icon={state === "paused" ? "play" : "pause"} onClick={() => voiceRef.current?.setPaused(state !== "paused")}>
            {state === "paused" ? t("talk.resume") : t("talk.pause")}
          </Button>
          <Button
            variant="danger"
            size="lg"
            icon="cross"
            onClick={() => {
              voiceRef.current?.end();
              onEnded(turnsRef.current);
            }}
          >
            {t("talk.end")}
          </Button>
        </div>
      )}
    </div>
  );
}
