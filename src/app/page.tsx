"use client";

import { useRouter } from "next/navigation";
import { AccountSetup, SignInForm } from "@/components/AuthPanel";
import { PookieAvatar } from "@/components/PookieAvatar";
import { DemoBanner, TopBar } from "@/components/TopBar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Loading, Notice } from "@/components/ui/Feedback";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { MessageKey } from "@/lib/i18n";
import { usePrefs } from "@/state/PrefsProvider";
import { useSession } from "@/state/SessionProvider";

const HIGHLIGHTS: readonly { icon: IconName; text: MessageKey }[] = [
  { icon: "chat", text: "welcome.point.companion" },
  { icon: "pill", text: "welcome.point.medicines" },
  { icon: "users", text: "welcome.point.circle" },
  { icon: "book", text: "welcome.point.lifebook" },
];

export default function WelcomePage() {
  const { t, prefs } = usePrefs();
  const { mode, session, elder, elderLoaded, demo } = useSession();
  const router = useRouter();

  const ready = session.status === "ready" && elderLoaded;
  const isElder = session.status === "ready" && session.actor.role === "elder";
  const nextHref = !isElder ? "/family" : elder?.onboarded ? "/home" : "/onboarding/pookie";

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <TopBar />
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pb-16 pt-4 text-center">
        <PookieAvatar companion={prefs.companion} size={190} animate title={t("welcome.avatarAlt")} />
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold">{t("welcome.title")}</h1>
          <p className="text-xl font-bold text-primary-strong" lang="en">
            A little care, a lot of love.
          </p>
          <p className="mx-auto max-w-prose text-ink-soft">{t("welcome.body")}</p>
        </div>

        <ul className="grid w-full gap-3 text-left sm:grid-cols-2">
          {HIGHLIGHTS.map((item) => (
            <li key={item.text} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
              <Icon name={item.icon} className="h-8 w-8 text-primary-strong" />
              <span className="font-bold">{t(item.text)}</span>
            </li>
          ))}
        </ul>

        {mode === "demo" ? (
          <Notice tone="warn">
            <p className="text-left font-bold">{t("welcome.demoTitle")}</p>
            <p className="text-left">{t("welcome.demoBody")}</p>
          </Notice>
        ) : null}

        {session.status === "loading" || (session.status === "ready" && !elderLoaded) ? <Loading /> : null}
        {session.status === "signedOut" ? <SignInForm /> : null}
        {session.status === "needsSetup" ? <AccountSetup user={session.user} onElderChosen={() => router.push("/onboarding/pookie")} onJoined={() => router.push("/family")} /> : null}
        {ready ? (
          <ButtonLink href={nextHref} size="lg" icon="arrow">
            {isElder && !elder?.onboarded ? t("welcome.start") : t("welcome.continue")}
          </ButtonLink>
        ) : null}
        {ready && demo && isElder && !elder?.onboarded ? (
          <div className="space-y-1">
            <Button
              variant="secondary"
              size="lg"
              icon="book"
              onClick={() => {
                void demo.loadSample().then(() => router.push("/home"));
              }}
            >
              {t("welcome.sample")}
            </Button>
            <p className="text-sm text-ink-soft">{t("welcome.sampleHint")}</p>
          </div>
        ) : null}

        <ButtonLink href="/privacy" variant="quiet" icon="shield">
          {t("privacy.linkTitle")}
        </ButtonLink>
        <p className="max-w-prose text-sm text-ink-soft">{t("welcome.disclaimer")}</p>
      </main>
    </div>
  );
}
