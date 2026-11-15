"use client";

import { useRouter } from "next/navigation";
import { DemoBanner, TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Feedback";
import type { MessageKey } from "@/lib/i18n";
import { usePrefs } from "@/state/PrefsProvider";

const ROWS = ["profile", "meds", "appts", "checkins", "lifebook", "talk"] as const;
type Row = (typeof ROWS)[number];
const cell = (row: Row, col: "what" | "why" | "who") => `privacy.row.${row}.${col}` as MessageKey;

/** Plain-language account of what Pookie stores, why, and who can see it. Works before sign-in. */
export default function PrivacyPage() {
  const { t } = usePrefs();
  const router = useRouter();
  return (
    <div className="min-h-screen">
      <DemoBanner />
      <TopBar />
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-2">
        <PageHeader title={t("privacy.title")} subtitle={t("privacy.subtitle")} />
        <ul className="grid gap-3 sm:grid-cols-2">
          {ROWS.map((row) => (
            <Card as="li" key={row} className="space-y-2">
              <h2 className="text-lg font-extrabold">{t(cell(row, "what"))}</h2>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-bold text-ink-soft">{t("privacy.col.why")}</dt>
                  <dd>{t(cell(row, "why"))}</dd>
                </div>
                <div>
                  <dt className="text-sm font-bold text-ink-soft">{t("privacy.col.who")}</dt>
                  <dd>{t(cell(row, "who"))}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </ul>
        <Notice icon="shield">
          <p>{t("privacy.ai")}</p>
        </Notice>
        <p>{t("privacy.control")}</p>
        <p className="text-ink-soft">{t("privacy.notMedical")}</p>
        <Button variant="secondary" icon="arrow" onClick={() => router.back()}>
          {t("privacy.back")}
        </Button>
      </main>
    </div>
  );
}
