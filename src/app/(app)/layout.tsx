"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { DemoBanner, TopBar } from "@/components/TopBar";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Feedback";
import { Icon, type IconName } from "@/components/ui/Icon";
import { usePushReminders } from "@/hooks/usePushReminders";
import { useSafeZone } from "@/hooks/useSafeZone";
import { useReminders } from "@/hooks/useReminders";
import type { MessageKey } from "@/lib/i18n";
import { usePrefs } from "@/state/PrefsProvider";
import { useSession } from "@/state/SessionProvider";

interface NavItem {
  href: string;
  label: MessageKey;
  icon: IconName;
}

const ELDER_NAV: readonly NavItem[] = [
  { href: "/home", label: "nav.home", icon: "home" },
  { href: "/companion", label: "nav.talk", icon: "chat" },
  { href: "/medications", label: "nav.medicines", icon: "pill" },
  { href: "/health", label: "nav.health", icon: "heart" },
  { href: "/lifebook", label: "nav.lifebook", icon: "book" },
  { href: "/settings", label: "nav.settings", icon: "settings" },
];

const MEMBER_NAV: readonly NavItem[] = [
  { href: "/family", label: "nav.family", icon: "users" },
  { href: "/health", label: "nav.health", icon: "heart" },
  { href: "/lifebook", label: "nav.lifebook", icon: "book" },
  { href: "/settings", label: "nav.settings", icon: "settings" },
];

/** Signed-in shell: guards access, then renders the top bar, page and bottom navigation. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { t, prefs } = usePrefs();
  const { session, repo, elder, elderLoaded } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isElder = session.status === "ready" && session.actor.role === "elder";
  const needsWelcome =
    session.status === "signedOut" ||
    session.status === "needsSetup" ||
    (isElder && elderLoaded && !elder?.onboarded);

  useEffect(() => {
    if (needsWelcome) router.replace("/");
  }, [needsWelcome, router]);

  const reminderText = useMemo(
    () => ({
      medicine: (name: string) => t("remind.medicine", { name }),
      checkin: (label: string) => t("remind.checkin", { label }),
      appointment: (doctor: string) => t("remind.appointment", { doctor }),
    }),
    [t],
  );
  const elderId = session.status === "ready" ? session.elderId : "";
  useReminders(
    Boolean(isElder && repo && elder?.consent.reminders),
    repo as NonNullable<typeof repo>,
    elderId,
    reminderText,
  );
  const safe = useSafeZone();
  usePushReminders(
    Boolean(isElder && repo?.mode === "firebase" && elder?.consent.reminders),
    elderId,
  );

  if (session.status !== "ready" || !repo || !elderLoaded || needsWelcome) {
    return (
      <main className="mx-auto max-w-3xl px-4">
        <Loading />
      </main>
    );
  }

  const nav = isElder ? ELDER_NAV : MEMBER_NAV;
  const accessPaused = !isElder && elder === null;

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        onClick={(e) => {
          // Move focus without touching the URL hash (the single-file build routes on it).
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-pill focus:bg-primary-strong focus:px-4 focus:py-2 focus:font-bold focus:text-white"
      >
        {t("nav.skip")}
      </a>
      <DemoBanner />
      <TopBar homeHref={isElder ? "/home" : "/family"} />
      {safe.active ? (
        <p
          role="status"
          className="mx-auto mt-1 flex items-center gap-2 rounded-pill bg-surface px-4 py-1 text-sm font-bold text-ink-soft"
        >
          <Icon name="pin" className="h-4 w-4" />
          {safe.outside ? t("safe.outsideBadge") : t("safe.onBadge")}
        </p>
      ) : null}
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 pb-32 pt-2 lg:max-w-5xl"
      >
        {accessPaused ? (
          <Card className="space-y-2 text-center">
            <Icon
              name="pause"
              className="mx-auto h-10 w-10 text-primary-strong"
            />
            <h1 className="text-2xl font-extrabold">
              {t("family.pausedTitle")}
            </h1>
            <p className="text-ink-soft">{t("family.pausedBody")}</p>
          </Card>
        ) : (
          children
        )}
      </main>
      {/* Simple Mode keeps one calm screen: no menu bar to get lost in. */}
      {isElder && prefs.simpleMode ? null : (
        <nav
          aria-label={t("nav.main")}
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-surface"
        >
          <ul className="mx-auto flex max-w-3xl">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-sm font-extrabold ${active ? "border-t-4 border-primary-strong text-primary-strong" : "border-t-4 border-transparent text-ink-soft"}`}
                  >
                    <Icon name={item.icon} className="h-7 w-7" />
                    <span>{t(item.label)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
