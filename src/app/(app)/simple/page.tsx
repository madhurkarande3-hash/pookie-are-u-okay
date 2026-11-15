"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PookieAvatar } from "@/components/PookieAvatar";
import { MediaView } from "@/components/MediaView";
import { WhereAmI } from "@/components/WhereAmI";
import { HelpRequestCard } from "@/components/HelpRequest";
import { Icon } from "@/components/ui/Icon";
import { useAsyncData, useNow } from "@/hooks/useAsyncData";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

const HOLD_MS = 3000;

/**
 * Simple Mode: one calm screen for later stages. Big date and time, talk,
 * "where am I", and photo buttons that call family. Leaving needs a 3-second
 * hold so it can't happen by accident.
 */
export default function SimplePage() {
  const { t, locale, prefs, setPrefs } = usePrefs();
  const { repo, elderId, elder } = useReadySession();
  const router = useRouter();
  const now = useNow(30_000);
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const lifebook = useAsyncData(() => repo.listLifebook(elderId), [repo, elderId]);
  const entries = lifebook.data ?? [];
  const contacts = entries.filter((e) => e.category === "people" && e.confirmed && e.phone).slice(0, 4);
  const photoOf = (personId: string) => entries.find((e) => e.category === "photos" && e.confirmed && e.media && e.people?.includes(personId));

  const startHold = () => {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setPrefs({ simpleMode: false });
      router.push("/home");
    }, HOLD_MS);
  };
  const stopHold = () => {
    setHolding(false);
    if (timer.current) window.clearTimeout(timer.current);
  };

  return (
    <div className="space-y-6 text-center">
      <PookieAvatar companion={prefs.companion} size={140} />
      <div>
        <p className="text-4xl font-extrabold">{now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</p>
        <p className="text-2xl font-bold">{now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        {elder?.preferredName ? <p className="text-xl text-ink-soft">{t("simple.hello", { name: elder.preferredName })}</p> : null}
      </div>

      <Link href="/companion" className="flex min-h-[5.5rem] items-center justify-center gap-3 rounded-card bg-primary-strong px-6 text-3xl font-extrabold text-white shadow-card">
        <Icon name="chat" className="h-10 w-10" />
        {t("simple.talk")}
      </Link>

      <WhereAmI large />

      <Link href="/emergency" className="flex min-h-[4.5rem] items-center justify-center gap-3 rounded-card bg-danger px-6 text-2xl font-extrabold text-white">
        <Icon name="bell" className="h-8 w-8" />
        {t("emergency.open")}
      </Link>

      {contacts.length > 0 ? (
        <section aria-labelledby="simple-family" className="space-y-3">
          <h2 id="simple-family" className="text-2xl font-extrabold">
            {t("simple.callFamily")}
          </h2>
          <ul className="grid grid-cols-2 gap-4">
            {contacts.map((p) => {
              const photo = photoOf(p.id);
              return (
                <li key={p.id}>
                  <a href={`tel:${(p.phone ?? "").replace(/[^0-9+]/g, "")}`} className="flex flex-col items-center gap-2 rounded-card border-4 border-line bg-surface p-3 shadow-card focus:border-primary-strong">
                    {photo?.media ? <MediaView media={photo.media} title={p.title} /> : <Icon name="users" className="h-16 w-16 text-primary-strong" />}
                    <span className="text-2xl font-extrabold">{p.title}</span>
                    <span className="text-lg text-ink-soft">{p.relationship}</span>
                    <span className="text-base font-bold">{p.phone}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Link href="/remember" className="flex min-h-[4.5rem] items-center justify-center gap-3 rounded-card border-4 border-primary-strong px-6 text-2xl font-extrabold text-primary-strong">
        <Icon name="book" className="h-8 w-8" />
        {t("simple.memories")}
      </Link>

      <div className="text-left">
        <HelpRequestCard />
      </div>

      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !holding && startHold()}
        onKeyUp={stopHold}
        className="text-base font-bold text-ink-soft underline underline-offset-4"
        aria-describedby="simple-exit-hint"
      >
        {holding ? t("simple.exiting") : t("simple.exit")}
      </button>
      <p id="simple-exit-hint" className="text-sm text-ink-soft">
        {t("simple.exitHint")}
      </p>
    </div>
  );
}
