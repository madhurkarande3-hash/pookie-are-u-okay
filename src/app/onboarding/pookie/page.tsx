"use client";

import { LookAndCompanion } from "@/components/LookAndCompanion";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { usePrefs } from "@/state/PrefsProvider";

export default function ChoosePookiePage() {
  const { t } = usePrefs();
  return (
    <div className="space-y-6">
      <PageHeader title={t("pookie.title")} subtitle={t("pookie.subtitle")} />
      <LookAndCompanion />
      <p className="text-ink-soft">{t("pookie.changeLater")}</p>
      <ButtonLink href="/onboarding/profile" size="lg" icon="arrow">
        {t("common.next")}
      </ButtonLink>
    </div>
  );
}
