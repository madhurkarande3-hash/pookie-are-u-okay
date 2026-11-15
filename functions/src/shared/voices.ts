/**
 * Google Cloud Text-to-Speech voices for each companion and language, so
 * Granny always sounds like a woman and Kaka like a man, on every device.
 * Slightly slow for older listeners. Voice names: Cloud TTS "Wavenet"
 * Indian English (en-IN) and Hindi (hi-IN) voices.
 */
import type { CompanionPersona } from "./persona";

export interface CloudVoice {
  languageCode: "en-IN" | "hi-IN";
  name: string;
  ssmlGender: "FEMALE" | "MALE";
  speakingRate: number;
  pitch: number;
}

const VOICES: Record<CompanionPersona, Record<"en" | "hi", CloudVoice>> = {
  pookie: {
    en: { languageCode: "en-IN", name: "en-IN-Wavenet-D", ssmlGender: "FEMALE", speakingRate: 0.9, pitch: 1 },
    hi: { languageCode: "hi-IN", name: "hi-IN-Wavenet-D", ssmlGender: "FEMALE", speakingRate: 0.9, pitch: 1 },
  },
  granny: {
    en: { languageCode: "en-IN", name: "en-IN-Wavenet-A", ssmlGender: "FEMALE", speakingRate: 0.88, pitch: -1 },
    hi: { languageCode: "hi-IN", name: "hi-IN-Wavenet-A", ssmlGender: "FEMALE", speakingRate: 0.88, pitch: -1 },
  },
  kaka: {
    en: { languageCode: "en-IN", name: "en-IN-Wavenet-B", ssmlGender: "MALE", speakingRate: 0.88, pitch: -2 },
    hi: { languageCode: "hi-IN", name: "hi-IN-Wavenet-B", ssmlGender: "MALE", speakingRate: 0.88, pitch: -2 },
  },
};

export function voiceFor(persona: CompanionPersona, language: unknown): CloudVoice {
  return VOICES[persona][language === "hi" ? "hi" : "en"];
}

export const MAX_SPEAK_CHARS = 800;

/** Gemini Live prebuilt voices per companion (check names in AI Studio if Google renames them). */
export const LIVE_VOICE: Record<CompanionPersona, string> = { pookie: "Zephyr", granny: "Aoede", kaka: "Charon" };
