"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickVoice, voiceShape, type VoiceGender } from "./voicePick";

/** Minimal typings for the Web Speech API (not in lib.dom for all browsers). */
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechControls {
  canListen: boolean;
  canSpeak: boolean;
  listening: boolean;
  speaking: boolean;
  interim: string;
  error: string | null;
  /** `onNothing` runs when listening ends without words (silence), so a hands-free loop can listen again. */
  listen: (onFinal: (text: string) => void, onNothing?: () => void) => void;
  stopListening: () => void;
  speak: (text: string, onDone?: () => void) => void;
  /** Stops speech output immediately (the "interrupt" control). */
  stopSpeaking: () => void;
}

/**
 * Browser speech-to-text and text-to-speech. `locale` e.g. "en-IN" / "hi-IN".
 * `gender` picks Kaka's (male) or Granny's (female) voice where the device has one.
 */
export function useSpeech(locale: string, gender: VoiceGender = "female", serverVoice?: (text: string) => Promise<string | null>): SpeechControls {
  const [support, setSupport] = useState({ listen: false, speak: false });
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakIdRef = useRef(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Voice lists arrive asynchronously in most browsers.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => {
    setSupport({ listen: getRecognitionCtor() !== null, speak: "speechSynthesis" in window });
    return () => {
      recognitionRef.current?.abort();
      audioRef.current?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    speakIdRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const listen = useCallback(
    (onFinal: (text: string) => void, onNothing?: () => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return;
      stopSpeaking();
      recognitionRef.current?.abort();
      const recognition = new Ctor();
      recognition.lang = locale;
      recognition.interimResults = true;
      recognition.continuous = false;
      let finalText = "";
      recognition.onresult = (e) => {
        let live = "";
        for (let i = 0; i < e.results.length; i += 1) {
          const result = e.results[i];
          const transcript = result?.[0]?.transcript ?? "";
          if (result?.isFinal) finalText += transcript;
          else live += transcript;
        }
        setInterim(live || finalText);
      };
      recognition.onerror = (e) => {
        if (e.error !== "aborted" && e.error !== "no-speech") setError(e.error);
      };
      recognition.onend = () => {
        setListening(false);
        setInterim("");
        recognitionRef.current = null;
        if (finalText.trim()) onFinal(finalText.trim());
        else onNothing?.();
      };
      recognitionRef.current = recognition;
      setError(null);
      setListening(true);
      try {
        recognition.start();
      } catch {
        setListening(false);
        setError("start-failed");
      }
    },
    [locale, stopSpeaking],
  );

  const speakWithDevice = useCallback(
    (text: string, onDone?: () => void) => {
      if (!("speechSynthesis" in window)) {
        setSpeaking(false);
        onDone?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const { voice, genderMatched } = pickVoice(voices, locale, gender);
      const shape = voiceShape(gender, genderMatched);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? locale;
      utterance.pitch = shape.pitch;
      utterance.rate = shape.rate;
      const finish = () => {
        setSpeaking(false);
        onDone?.();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [locale, gender, voices],
  );

  /** The companion's own server voice when available; otherwise the device voice. */
  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      const id = (speakIdRef.current += 1);
      if (!serverVoice) {
        speakWithDevice(text, onDone);
        return;
      }
      setSpeaking(true);
      void serverVoice(text)
        .then((src) => {
          if (speakIdRef.current !== id) return;
          if (!src) throw new Error("no audio");
          const audio = new Audio(src);
          audioRef.current = audio;
          const finish = () => {
            if (audioRef.current === audio) audioRef.current = null;
            setSpeaking(false);
            onDone?.();
          };
          audio.onended = finish;
          audio.onerror = finish;
          return audio.play();
        })
        .catch(() => {
          if (speakIdRef.current === id) speakWithDevice(text, onDone);
        });
    },
    [serverVoice, speakWithDevice],
  );

  return { canListen: support.listen, canSpeak: support.speak, listening, speaking, interim, error, listen, stopListening, speak, stopSpeaking };
}
