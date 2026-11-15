"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConsentForm, type ConsentChoices } from "@/components/ConsentForm";
import { LookAndCompanion } from "@/components/LookAndCompanion";
import { ProfileForm } from "@/components/ProfileForm";
import { ReminderPrefsForm } from "@/components/ReminderPrefsForm";
import { LanguageSwitch } from "@/components/TopBar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, PageHeader, Section } from "@/components/ui/Card";
import { ChoiceGroup, Toggle } from "@/components/ui/Choice";
import { Notice, describeError } from "@/components/ui/Feedback";
import type { TextSize } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession, useSession } from "@/state/SessionProvider";

type NotifyState = "unsupported" | "default" | "granted" | "denied";

export default function SettingsPage() {
  const { t, prefs, setPrefs } = usePrefs();
  const { actor, elder, repo, elderId } = useReadySession();
  const { saveElder, demo, mode, refresh } = useSession();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState<NotifyState>("unsupported");
  const isElder = actor.role === "elder";

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotify(Notification.permission);
  }, []);

  const attempt = async (work: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const updateConsent = (patch: Partial<ConsentChoices>) =>
    attempt(async () => {
      if (!elder) return;
      await saveElder({ ...elder, consent: { ...elder.consent, ...patch, updatedAt: new Date().toISOString() } });
    });

  const exportData = () =>
    attempt(async () => {
      const bundle = await repo.exportAll(elderId);
      const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "pookie-my-data.json";
      link.click();
      URL.revokeObjectURL(url);
    });

  const deleteEverything = () =>
    attempt(async () => {
      await repo.deleteAll(elderId);
      if (mode === "firebase") await (await import("@/lib/firebase/auth")).signOut();
      await refresh();
      router.replace("/");
    });

  const signOut = () =>
    attempt(async () => {
      await (await import("@/lib/firebase/auth")).signOut();
      router.replace("/");
    });

  return (
    <>
      <PageHeader title={t("settings.title")} />

      {isElder && elder ? (
        <Section title={t("settings.profile")} id="set-profile">
          <ProfileForm elder={elder} />
        </Section>
      ) : null}

      <Section title={t("settings.display")} id="set-display">
        <Card className="space-y-5">
          <div className="space-y-2">
            <p className="text-lg font-extrabold">{t("lang.label")}</p>
            <LanguageSwitch />
          </div>
          <LookAndCompanion
            compact
            onChange={(change) => {
              // Keep the stored profile in step so the server uses the same companion.
              if (isElder && elder) void saveElder({ ...elder, ...change }).catch(() => undefined);
            }}
          />
          <ChoiceGroup<TextSize>
            legend={t("settings.textSize")}
            columns="grid-cols-1 sm:grid-cols-3"
            value={prefs.textSize}
            onChange={(textSize) => setPrefs({ textSize })}
            options={[
              { value: "normal", label: t("settings.text.normal") },
              { value: "large", label: t("settings.text.large") },
              { value: "xlarge", label: t("settings.text.xlarge") },
            ]}
          />
          <Toggle label={t("settings.reduceMotion")} description={t("settings.reduceMotionDesc")} checked={prefs.reduceMotion} onChange={(reduceMotion) => setPrefs({ reduceMotion })} />
        </Card>
      </Section>

      <Section title={t("notify.title")} id="set-reminders">
        <ReminderPrefsForm />
      </Section>

      {isElder && elder ? (
        <>
          <Section title={t("settings.privacy")} id="set-privacy">
            <Card className="space-y-3">
              <p className="font-extrabold">{t("privacy.linkTitle")}</p>
              <p className="text-ink-soft">{t("privacy.linkBody")}</p>
              <ButtonLink href="/privacy" variant="secondary" icon="shield">
                {t("privacy.open")}
              </ButtonLink>
            </Card>
            <Card>
              <ConsentForm value={elder.consent} onChange={(patch) => void updateConsent(patch)} disabled={busy} />
            </Card>
            <Card className="space-y-3">
              <p className="font-extrabold">{t("settings.notifyTitle")}</p>
              <p className="text-ink-soft">{t(`settings.notify.${notify}`)}</p>
              {notify === "default" ? (
                <Button variant="secondary" icon="bell" onClick={() => void Notification.requestPermission().then(setNotify)}>
                  {t("settings.notifyEnable")}
                </Button>
              ) : null}
            </Card>
            <Card className="space-y-3">
              <p className="font-extrabold">{t("circle.title")}</p>
              <p className="text-ink-soft">{t("settings.circleBody")}</p>
              <ButtonLink href="/circle" variant="secondary" icon="users">
                {t("settings.circleOpen")}
              </ButtonLink>
            </Card>
          </Section>

          <Section title={t("settings.data")} id="set-data">
            <Card className="space-y-3">
              <p>{repo.mode === "demo" ? t("settings.dataDemo") : t("settings.dataLive")}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" busy={busy} onClick={() => void exportData()}>
                  {t("settings.export")}
                </Button>
                {confirmDelete ? (
                  <>
                    <Button variant="danger" icon="trash" busy={busy} onClick={() => void deleteEverything()}>
                      {t("settings.deleteConfirm")}
                    </Button>
                    <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
                      {t("common.cancel")}
                    </Button>
                  </>
                ) : (
                  <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>
                    {t("settings.delete")}
                  </Button>
                )}
              </div>
              {confirmDelete ? <p className="font-bold text-danger">{t("settings.deleteWarning")}</p> : null}
            </Card>
          </Section>
        </>
      ) : null}

      {!isElder && mode === "firebase" ? (
        <Section title={t("settings.data")} id="set-member-data">
          <Card className="space-y-3">
            <p>{t("settings.memberDelete")}</p>
            {confirmDelete ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" icon="trash" busy={busy} onClick={() => void deleteEverything()}>
                  {t("settings.deleteConfirm")}
                </Button>
                <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>
                {t("settings.memberDeleteButton")}
              </Button>
            )}
          </Card>
        </Section>
      ) : null}

      {demo ? (
        <Section title={t("settings.demo")} id="set-demo">
          <Card className="space-y-3">
            <p className="text-ink-soft">{t("settings.demoBody")}</p>
            <Button
              variant="secondary"
              icon="book"
              onClick={() => {
                void demo.loadSample().then(() => router.push("/home"));
              }}
            >
              {t("settings.demoSample")}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant={demo.personaId === "elder" ? "primary" : "secondary"} aria-pressed={demo.personaId === "elder"} onClick={() => demo.setPersona("elder")}>
                {t("settings.demoElder")}
              </Button>
              {demo.activeMembers().map((m) => (
                <Button key={m.id} variant={demo.personaId === m.id ? "primary" : "secondary"} aria-pressed={demo.personaId === m.id} onClick={() => demo.setPersona(m.id)}>
                  {m.name} ({t(`role.${m.role}`)})
                </Button>
              ))}
            </div>
          </Card>
        </Section>
      ) : (
        <Button variant="secondary" onClick={() => void signOut()}>
          {t("settings.signOut")}
        </Button>
      )}

      {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}

      <Notice>
        <p>{t("welcome.disclaimer")}</p>
      </Notice>
    </>
  );
}
