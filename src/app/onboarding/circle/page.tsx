"use client";

import { CircleManager } from "@/components/CircleManager";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { usePrefs } from "@/state/PrefsProvider";

export default function OnboardingCirclePage() {
  const { t } = usePrefs();
  return (
    <div className="space-y-6">
      <PageHeader title={t("circle.title")} subtitle={t("circle.onbSubtitle")} />
      <CircleManager />
      <ButtonLink href="/onboarding/consent" size="lg" icon="arrow">
        {t("circle.onbNext")}
      </ButtonLink>
    </div>
  );
}
