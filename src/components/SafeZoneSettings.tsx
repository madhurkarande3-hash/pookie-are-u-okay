"use client";

import { useState } from "react";
import { SAFE_RADII_M } from "@/lib/domain/safety";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession, useSession } from "@/state/SessionProvider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Checkbox, ChoiceGroup } from "./ui/Choice";
import { Notice, describeError } from "./ui/Feedback";

/** Elder (or guardian, in guardian mode) sets a safe area around home. Off by default. */
export function SafeZoneSettings() {
  const { t } = usePrefs();
  const { elder } = useReadySession();
  const { saveElder } = useSession();
  const zone = elder?.safeZone ?? null;
  const guardianMode = elder?.consent.decisionMode === "guardian";
  const [radius, setRadius] = useState(String(zone?.radiusM ?? 500));
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!elder) return null;

  const turnOn = () => {
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void saveElder({
          ...elder,
          safeZone: {
            enabled: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            radiusM: Number(radius),
            consentBy: guardianMode ? "guardian" : "self",
            consentAt: new Date().toISOString(),
          },
        })
          .catch(setError)
          .finally(() => setBusy(false));
      },
      () => {
        setError(new Error(t("safe.noLocation")));
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  return (
    <Card className="space-y-3">
      <p>{t("safe.explain")}</p>
      <Notice>
        <p>{t("safe.limits")}</p>
      </Notice>
      {zone?.enabled ? (
        <>
          <p className="font-bold" role="status">
            {t("safe.onStatus", { radius: zone.radiusM })}
          </p>
          <Button
            variant="secondary"
            busy={busy}
            onClick={() =>
              void saveElder({
                ...elder,
                safeZone: { ...zone, enabled: false },
              }).catch(setError)
            }
          >
            {t("safe.turnOff")}
          </Button>
        </>
      ) : (
        <>
          <ChoiceGroup
            legend={t("safe.radius")}
            value={radius}
            onChange={setRadius}
            options={SAFE_RADII_M.map((r) => ({
              value: String(r),
              label: t("safe.metres", { radius: r }),
            }))}
          />
          <Checkbox
            checked={agreed}
            onChange={setAgreed}
            label={
              guardianMode ? t("safe.consentGuardian") : t("safe.consentSelf")
            }
          />
          <Button icon="pin" busy={busy} disabled={!agreed} onClick={turnOn}>
            {t("safe.turnOn")}
          </Button>
        </>
      )}
      {error ? (
        <p role="alert" className="font-bold text-danger">
          {describeError(error, t)}
        </p>
      ) : null}
    </Card>
  );
}
