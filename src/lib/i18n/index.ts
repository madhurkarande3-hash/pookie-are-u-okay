import type { Language } from "@/lib/types";
import { en, type MessageKey } from "./en";
import { hi } from "./hi";

export type { MessageKey };
export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { en, hi };

export const LOCALES: Record<Language, string> = { en: "en-IN", hi: "hi-IN" };
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", hi: "हिन्दी" };

export function createTranslator(language: Language): Translate {
  const dict = DICTIONARIES[language];
  return (key, params) => {
    const template = dict[key] ?? en[key];
    return params ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? "")) : template;
  };
}
