"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Language } from "@/lib/types";
import { LANGUAGE_NAMES } from "@/lib/i18n";
import { usePrefs } from "@/state/PrefsProvider";
import { useSession } from "@/state/SessionProvider";
import { Icon } from "./ui/Icon";

const LANGUAGES: readonly Language[] = ["en", "hi"];

/** Always-visible language switch. Changes language only — never the theme. */
export function LanguageSwitch() {
  const { prefs, setPrefs, t } = usePrefs();
  return (
    <div role="group" aria-label={t("lang.label")} className="inline-flex rounded-pill border-2 border-primary-strong bg-surface p-0.5">
      {LANGUAGES.map((code) => {
        const active = prefs.language === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            onClick={() => setPrefs({ language: code })}
            className={`min-h-[2.5rem] rounded-pill px-3.5 text-base font-extrabold ${active ? "bg-primary-strong text-white" : "text-primary-strong"}`}
          >
            {LANGUAGE_NAMES[code]}
          </button>
        );
      })}
    </div>
  );
}

export function TopBar({ homeHref = "/" }: { homeHref?: string }) {
  const { t } = usePrefs();
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
      <Link href={homeHref} className="flex items-center gap-2 text-2xl font-extrabold text-primary-strong" aria-label={t("nav.homeLink")}>
        <Icon name="heart" className="h-7 w-7" />
        <span>Pookie</span>
      </Link>
      <LanguageSwitch />
    </header>
  );
}

/** Honest, persistent label while running without Firebase/Gemini. */
export function DemoBanner() {
  const { t } = usePrefs();
  const { mode, session, demo } = useSession();
  const router = useRouter();
  if (mode !== "demo") return null;
  const viewingAs = session.status === "ready" && session.actor.role !== "elder" ? session.actor.name : null;
  return (
    <div className="border-b-2 border-warn bg-surface px-4 py-2 text-center text-sm font-bold text-warn" role="note">
      <span>{t("demo.banner")}</span>
      {viewingAs && demo ? (
        <>
          {" "}
          <span>{t("demo.viewingAs", { name: viewingAs })}</span>{" "}
          <button type="button" className="underline underline-offset-4" onClick={() => {
              demo.setPersona("elder");
              router.push("/home");
            }}
          >
            {t("demo.backToElder")}
          </button>
        </>
      ) : null}
    </div>
  );
}
