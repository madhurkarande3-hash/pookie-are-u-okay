"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Companion, Language, PookieTheme, TextSize } from "@/lib/types";
import { LOCALES, createTranslator, type Translate } from "@/lib/i18n";
import { PREFS_STORAGE_KEY } from "@/lib/theme/tokens";

/** Device-level display preferences. Language and theme are independent of each other. */
export interface Prefs {
  language: Language;
  pookie: PookieTheme;
  companion: Companion;
  textSize: TextSize;
  reduceMotion: boolean;
  voiceOutput: boolean;
  /** One calm screen for later stages (Simple Mode). */
  simpleMode: boolean;
}

export const DEFAULT_PREFS: Prefs = { language: "en", pookie: "sweet", companion: "pookie", textSize: "normal", reduceMotion: false, voiceOutput: true, simpleMode: false };

interface PrefsContextValue {
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  t: Translate;
  locale: string;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function applyToDocument(prefs: Prefs): void {
  const root = document.documentElement;
  root.lang = prefs.language;
  root.dataset.pookie = prefs.pookie;
  root.dataset.text = prefs.textSize;
  root.dataset.motion = prefs.reduceMotion ? "off" : "on";
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    const stored = loadPrefs();
    setState(stored);
    applyToDocument(stored);
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setState((current) => {
      const next = { ...current, ...patch };
      applyToDocument(next);
      try {
        window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: preferences last for this visit only */
      }
      return next;
    });
  }, []);

  const value = useMemo<PrefsContextValue>(
    () => ({ prefs, setPrefs, t: createTranslator(prefs.language), locale: LOCALES[prefs.language] }),
    [prefs, setPrefs],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}
