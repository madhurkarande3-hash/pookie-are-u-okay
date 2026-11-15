"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { DemoBanner, TopBar } from "@/components/TopBar";
import { Loading } from "@/components/ui/Feedback";
import { usePrefs } from "@/state/PrefsProvider";
import { useSession } from "@/state/SessionProvider";

const STEPS = ["pookie", "profile", "circle", "consent"] as const;

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { t } = usePrefs();
  const { session, repo, elder, elderLoaded } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const step = Math.max(0, STEPS.findIndex((s) => pathname.endsWith(s)));

  const isElder = session.status === "ready" && session.actor.role === "elder";
  const blocked = session.status === "signedOut" || session.status === "needsSetup" || (session.status === "ready" && !isElder);
  // The Care Circle and consent steps need the profile created in step 2.
  const needsProfile = isElder && elderLoaded && !elder && step >= 2;

  useEffect(() => {
    if (blocked) router.replace("/");
    else if (needsProfile) router.replace("/onboarding/profile");
  }, [blocked, needsProfile, router]);

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <TopBar />
      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 pt-2">
        <div>
          <p className="font-bold text-ink-soft" aria-live="polite">
            {t("onb.step", { current: step + 1, total: STEPS.length })}
          </p>
          <div className="mt-2 flex gap-2" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s} className={`h-2.5 flex-1 rounded-pill ${i <= step ? "bg-primary-strong" : "bg-line"}`} />
            ))}
          </div>
        </div>
        {!isElder || !repo || !elderLoaded || needsProfile ? <Loading /> : children}
      </main>
    </div>
  );
}
