"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { selectFacts, type ChatTurn } from "@shared/companionContext";
import { PERSONA_GENDER } from "@shared/persona";
import { LiveVoicePanel } from "@/components/LiveVoicePanel";
import { PookieAvatar } from "@/components/PookieAvatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { Checkbox, ChoiceGroup, Toggle } from "@/components/ui/Choice";
import { EmptyState, Notice, describeError } from "@/components/ui/Feedback";
import { TextArea } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useAsyncData } from "@/hooks/useAsyncData";
import { requestCompanionReply, requestCompanionVoice, type CompanionReply } from "@/lib/ai/companionClient";
import { useSpeech } from "@/lib/ai/useSpeech";
import { newId, toDateKey } from "@/lib/domain/dates";
import type { MessageKey } from "@/lib/i18n";
import type { CareSummary, Feeling } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

interface Message {
  id: string;
  role: "user" | "pookie";
  text: string;
  /** "app" = fixed greeting written into the app. */
  source: "user" | "app" | CompanionReply["source"];
}

type Status = "ready" | "listening" | "thinking" | "speaking" | "paused";
const STATUS_VIEW: Record<Status, { icon: IconName; label: MessageKey }> = {
  ready: { icon: "chat", label: "talk.status.ready" },
  listening: { icon: "mic", label: "talk.status.listening" },
  thinking: { icon: "clock", label: "talk.status.thinking" },
  speaking: { icon: "play", label: "talk.status.speaking" },
  paused: { icon: "pause", label: "talk.status.paused" },
};

function SummaryStep({ exchanges, slot, onRestart }: { exchanges: number; slot: string | null; onRestart: () => void }) {
  const { t } = usePrefs();
  const { repo, elderId, elder } = useReadySession();
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [note, setNote] = useState("");
  const [shared, setShared] = useState(false);
  const [state, setState] = useState<"form" | "saved" | "skipped">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mayKeep = elder?.consent.saveSummaries === true;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!feeling) return;
    setBusy(true);
    setError(null);
    try {
      const now = new Date();
      const summary: CareSummary = { id: newId(), dateKey: toDateKey(now), createdAt: now.toISOString(), feeling, note, exchanges, shared, scheduleId: slot };
      await repo.saveSummary(elderId, summary);
      setState("saved");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!mayKeep || state !== "form") {
    return (
      <Card className="space-y-3 text-center">
        <Icon name="heart" className="mx-auto h-12 w-12 text-primary-strong" />
        <h2 className="text-2xl font-extrabold">{t("talk.endedTitle")}</h2>
        <p className="text-ink-soft">{state === "saved" ? (shared ? t("talk.savedShared") : t("talk.savedPrivate")) : mayKeep ? t("talk.notSaved") : t("talk.notSavedNoConsent")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" icon="chat" onClick={onRestart}>
            {t("talk.again")}
          </Button>
          <ButtonLink href="/home" icon="home">
            {t("nav.home")}
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={save} className="space-y-5" noValidate>
        <div>
          <h2 className="text-2xl font-extrabold">{t("talk.summaryTitle")}</h2>
          <p className="text-ink-soft">{t("talk.summaryBody")}</p>
        </div>
        <ChoiceGroup
          legend={t("talk.feelingQ")}
          value={feeling}
          onChange={setFeeling}
          options={[
            { value: "good", label: t("talk.feeling.good"), emoji: "🙂" },
            { value: "okay", label: t("talk.feeling.okay"), emoji: "😐" },
            { value: "low", label: t("talk.feeling.low"), emoji: "🙁" },
          ]}
        />
        <TextArea label={t("talk.summaryNote")} hint={t("talk.summaryNoteHint")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        <Checkbox label={t("talk.summaryShare")} checked={shared} onChange={setShared}>
          {t("talk.summaryShareHint")}
        </Checkbox>
        {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" icon="check" busy={busy} disabled={!feeling}>
            {t("talk.summarySave")}
          </Button>
          <Button variant="quiet" onClick={() => setState("skipped")}>
            {t("talk.summarySkip")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function CompanionPage() {
  const { t, prefs, setPrefs, locale } = usePrefs();
  const { repo, elderId, elder, actor } = useReadySession();
  // Pookie, Granny Pookie or Kaka Pookie: the elder's own choice, independent of the theme.
  const persona = prefs.companion;
  // With Pookie's server, replies use the companion's own Cloud voice; Demo Mode uses the device voice.
  const language = prefs.language;
  const serverVoice = useCallback((text: string) => requestCompanionVoice(text, language), [language]);
  const speech = useSpeech(locale, PERSONA_GENDER[persona], repo.mode === "firebase" ? serverVoice : undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [live, setLive] = useState(false);
  const [liveExchanges, setLiveExchanges] = useState<number | null>(null);
  const [serviceError, setServiceError] = useState(false);
  const [draft, setDraft] = useState("");
  const [slot, setSlot] = useState<string | null>(null);
  const requestRef = useRef(0);
  const logEndRef = useRef<HTMLLIElement | null>(null);
  const isElder = actor.role === "elder";
  const personalised = elder?.consent.aiPersonalization === true;

  // LifeBook is read only when the elder has allowed personalisation.
  const lifebook = useAsyncData(() => (isElder && personalised ? repo.listLifebook(elderId) : Promise.resolve([])), [repo, elderId, isElder, personalised]);

  useEffect(() => {
    setSlot(new URLSearchParams(window.location.search).get("slot"));
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, thinking]);

  const { stopSpeaking, stopListening, speak } = speech;

  /**
   * Hands-free conversation: once started, Pookie listens, replies, and goes
   * back to listening by itself — no repeated taps. Silence simply keeps it
   * listening. Pause, Stop and End always work. A ref keeps the loop current.
   */
  const handsFreeRef = useRef(false);
  const loopRef = useRef<() => void>(() => undefined);
  const sendRef = useRef<(text: string) => void>(() => undefined);
  const silenceRef = useRef(0);
  loopRef.current = () => {
    if (!handsFreeRef.current || paused || ended || !speech.canListen || speech.listening) return;
    speech.listen(
      (text) => {
        silenceRef.current = 0;
        sendRef.current(text);
      },
      () => {
        // Keep listening through pauses; after a long quiet spell, rest until tapped.
        silenceRef.current += 1;
        if (silenceRef.current < 6) window.setTimeout(() => loopRef.current(), 400);
      },
    );
  };
  const afterSpeaking = useCallback(() => loopRef.current(), []);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || paused || ended) return;
      stopSpeaking();
      const userMessage: Message = { id: newId(), role: "user", text: clean, source: "user" };
      const history = [...messages, userMessage];
      setMessages(history);
      setThinking(true);
      setServiceError(false);
      const requestId = (requestRef.current += 1);
      const turns: ChatTurn[] = history.filter((m) => m.source !== "app").map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.text }));
      let reply: CompanionReply;
      try {
        reply = await requestCompanionReply({
          mode: repo.mode,
          turns,
          language: prefs.language,
          facts: selectFacts({ aiPersonalization: personalised, entries: lifebook.data ?? [] }),
          preferredName: personalised ? (elder?.preferredName ?? "") : "",
          persona,
        });
      } catch {
        if (requestRef.current === requestId) {
          setThinking(false);
          setServiceError(true);
        }
        return;
      }
      // Ignore replies that arrive after the user paused, ended or sent again.
      if (requestRef.current !== requestId) return;
      setThinking(false);
      setMessages((current) => [...current, { id: newId(), role: "pookie", text: reply.text, source: reply.source }]);
      if (prefs.voiceOutput) speak(reply.text, afterSpeaking);
      else afterSpeaking();
    },
    [paused, ended, messages, repo.mode, prefs.language, prefs.voiceOutput, personalised, lifebook.data, elder?.preferredName, persona, stopSpeaking, speak, afterSpeaking],
  );
  sendRef.current = (text) => void send(text);

  // If the microphone is already allowed, the conversation starts by itself when Pookie opens.
  const startRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!isElder || live) return;
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    void perms
      ?.query({ name: "microphone" as PermissionName })
      .then((state) => {
        if (state.state === "granted") startRef.current();
      })
      .catch(() => undefined);
    // Run once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const halt = useCallback(() => {
    requestRef.current += 1;
    setThinking(false);
    stopSpeaking();
    stopListening();
  }, [stopSpeaking, stopListening]);

  if (!isElder) return <EmptyState icon="shield" title={t("error.noAccessTitle")} body={t("talk.elderOnly")} />;

  const started = messages.length > 0;
  const status: Status = paused ? "paused" : speech.listening ? "listening" : thinking ? "thinking" : speech.speaking ? "speaking" : "ready";
  const statusView = STATUS_VIEW[status];
  const exchanges = liveExchanges ?? messages.filter((m) => m.role === "user").length;

  const start = () => {
    const name = personalised ? (elder?.preferredName ?? "") : "";
    const greeting = name ? t(`talk.greeting.${persona}`, { name }) : t(`talk.greetingNoName.${persona}`);
    setMessages([{ id: newId(), role: "pookie", text: greeting, source: "app" }]);
    handsFreeRef.current = speech.canListen;
    silenceRef.current = 0;
    if (prefs.voiceOutput) speak(greeting, afterSpeaking);
    else afterSpeaking();
  };
  startRef.current = () => {
    if (messages.length === 0 && !ended) start();
  };
  const restart = () => {
    setMessages([]);
    setEnded(false);
    setLive(false);
    setLiveExchanges(null);
    setPaused(false);
    setServiceError(false);
  };
  const submitText = (e: FormEvent) => {
    e.preventDefault();
    const text = draft;
    setDraft("");
    void send(text);
  };

  return (
    <>
      <PageHeader title={t("talk.title")} subtitle={t("talk.subtitle")} />

      <Notice tone={repo.mode === "demo" ? "warn" : "neutral"}>
        <p className="font-bold">{repo.mode === "demo" ? t("talk.modeDemo") : t("talk.modeGemini")}</p>
        <p className="text-sm">{repo.mode === "firebase" ? t("talk.voiceEngineServer") : t("talk.voiceEngine")}</p>
      </Notice>
      {personalised ? null : (
        <Notice icon="shield">
          <p>{t("talk.personalOff")}</p>
        </Notice>
      )}
      {serviceError ? (
        <Notice tone="warn">
          <p className="font-bold">{t("talk.modeUnavailable")}</p>
          <p className="text-sm">{t("error.offline")}</p>
        </Notice>
      ) : null}

      {ended ? (
        <SummaryStep exchanges={exchanges} slot={slot} onRestart={restart} />
      ) : live ? (
        <LiveVoicePanel
          companion={persona}
          onFallback={() => setLive(false)}
          onEnded={(turns) => {
            setLiveExchanges(turns);
            setEnded(true);
          }}
        />
      ) : !started ? (
        <Card className="flex flex-col items-center gap-4 text-center">
          <PookieAvatar companion={prefs.companion} size={150} animate />
          <div>
            <p className="text-2xl font-extrabold text-primary-strong">{t(`persona.${persona}.name`)}</p>
            <p className="text-ink-soft">{t(`persona.${persona}.tagline`)}</p>
          </div>
          <p className="text-lg">{t("talk.intro")}</p>
          <Button size="lg" icon="chat" onClick={start}>
            {t("talk.start")}
          </Button>
          {repo.mode === "firebase" ? (
            <div className="space-y-1">
              <Button variant="secondary" icon="mic" onClick={() => setLive(true)}>
                {t("live.start")}
              </Button>
              <p className="text-sm text-ink-soft">{t("live.hint")}</p>
            </div>
          ) : null}
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-card border-2 border-primary-strong bg-surface p-4">
            <PookieAvatar companion={prefs.companion} size={72} />
            <div className="min-w-0">
              <p className="font-bold text-ink-soft">{t(`persona.${persona}.name`)}</p>
              <p role="status" aria-live="polite" className={`flex items-center gap-2 text-xl font-extrabold text-primary-strong ${status === "listening" || status === "thinking" ? "pookie-pulse" : ""}`}>
              <Icon name={statusView.icon} className="h-7 w-7" />
              {t(statusView.label)}
              </p>
            </div>
          </div>

          <ol role="log" aria-label={t("talk.transcript")} aria-live="polite" className="max-h-[26rem] space-y-3 overflow-y-auto rounded-card border border-line bg-surface p-4" tabIndex={0}>
            {messages.map((m) => (
              <li key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <span className="text-sm font-bold text-ink-soft">
                  {m.role === "user" ? t("talk.you") : t(`persona.${persona}.name`)}
                  {m.source === "scripted" ? ` · ${t("talk.tagScripted")}` : m.source === "gemini" ? ` · ${t("talk.tagGemini")}` : ""}
                </span>
                <p className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-lg ${m.role === "user" ? "bg-primary-strong text-white" : "border border-line bg-bg"}`}>{m.text}</p>
              </li>
            ))}
            {speech.interim ? <li className="text-right italic text-ink-soft">{speech.interim}</li> : null}
            <li ref={logEndRef} aria-hidden="true" />
          </ol>

          <div className="grid gap-2 sm:grid-cols-2">
            {speech.listening ? (
              <Button size="lg" icon="stop" onClick={stopListening} className="sm:w-full">
                {t("talk.stopListening")}
              </Button>
            ) : (
              <Button size="lg" icon="mic" disabled={!speech.canListen || paused || thinking} onClick={() => speech.listen((text) => void send(text))} className="sm:w-full">
                {t("talk.tapToTalk")}
              </Button>
            )}
            <Button
              size="lg"
              variant="secondary"
              icon="stop"
              disabled={!speech.speaking && !thinking}
              onClick={() => {
                halt();
                window.setTimeout(() => loopRef.current(), 300);
              }}
              className="sm:w-full"
            >
              {t("talk.interrupt")}
            </Button>
            {paused ? (
              <Button
                size="lg"
                variant="secondary"
                icon="play"
                onClick={() => {
                  setPaused(false);
                  silenceRef.current = 0;
                  window.setTimeout(() => loopRef.current(), 200);
                }}
                className="sm:w-full"
              >
                {t("talk.resume")}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="secondary"
                icon="pause"
                onClick={() => {
                  halt();
                  setPaused(true);
                }}
                className="sm:w-full"
              >
                {t("talk.pause")}
              </Button>
            )}
            <Button
              size="lg"
              variant="danger"
              icon="cross"
              onClick={() => {
                handsFreeRef.current = false;
                halt();
                setEnded(true);
              }}
              className="sm:w-full"
            >
              {t("talk.end")}
            </Button>
          </div>
          {speech.canListen ? null : <p className="text-ink-soft">{t("talk.noMic")}</p>}
          {speech.error ? <p role="alert" className="font-bold text-danger">{t("talk.micError")}</p> : null}

          <form onSubmit={submitText} className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="talk-text" className="mb-1.5 block font-bold">
                {t("talk.typeLabel")}
              </label>
              <input id="talk-text" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} disabled={paused} autoComplete="off" className="min-h-tap w-full rounded-2xl border-2 border-line bg-surface px-4 py-2.5 focus:border-primary-strong" />
            </div>
            <Button type="submit" icon="send" disabled={paused || thinking || !draft.trim()}>
              {t("talk.send")}
            </Button>
          </form>

          <Card>
            <Toggle label={t("talk.voiceOutput")} description={speech.canSpeak ? t("talk.voiceOutputDesc") : t("talk.noSpeech")} checked={prefs.voiceOutput && speech.canSpeak} disabled={!speech.canSpeak} onChange={(voiceOutput) => {
              if (!voiceOutput) stopSpeaking();
              setPrefs({ voiceOutput });
            }} />
          </Card>
        </>
      )}

      <Notice>
        <p>{t("talk.disclaimer")}</p>
      </Notice>
    </>
  );
}
