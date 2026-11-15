"use client";

import { useState } from "react";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePolicy } from "@/hooks/usePolicy";
import {
  EMERGENCY_NUMBER,
  mapLink,
  preferredHospital,
  telHref,
} from "@/lib/domain/medical";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

/**
 * Emergency screen. Every call is a button the person presses themselves —
 * Pookie never calls anyone automatically, and location is only read when
 * they press "share my location".
 */
export default function EmergencyPage() {
  const { t } = usePrefs();
  const { repo, elderId, elder } = useReadySession();
  const canRead = usePolicy()("medical:read");
  const data = useAsyncData(
    () => (canRead ? repo.getMedical(elderId) : Promise.resolve(null)),
    [repo, elderId, canRead],
  );
  const medical = data.data ?? null;
  const hospital = preferredHospital(medical);
  const [loc, setLoc] = useState<{ link: string } | "asking" | "denied" | null>(
    null,
  );

  const share = () => {
    setLoc("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ link: mapLink(p.coords.latitude, p.coords.longitude) }),
      () => setLoc("denied"),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };
  const smsBody = (link: string) =>
    encodeURIComponent(
      t("emergency.smsBody", { name: elder?.preferredName ?? "", link }),
    );

  return (
    <>
      <PageHeader
        title={t("emergency.title")}
        subtitle={t("emergency.subtitle")}
      />
      <a
        href={telHref(EMERGENCY_NUMBER)}
        className="flex min-h-[6rem] items-center justify-center gap-3 rounded-card bg-danger px-6 text-3xl font-extrabold text-white shadow-card"
      >
        <Icon name="bell" className="h-10 w-10" />
        {t("emergency.call112")}
      </a>
      <Notice>
        <p>{t("emergency.howTo")}</p>
      </Notice>

      {medical?.emergencyContacts.length ? (
        <Card className="space-y-3">
          <h2 className="text-xl font-extrabold">{t("health.contacts")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {medical.emergencyContacts.map((c) => (
              <li key={c.id}>
                <ButtonLink
                  href={telHref(c.phone)}
                  size="lg"
                  variant="secondary"
                  className="w-full"
                >
                  {t("health.call", {
                    name: `${c.name}${c.relationship ? ` (${c.relationship})` : ""}`,
                  })}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {hospital ? (
        <Card className="space-y-2">
          <h2 className="text-xl font-extrabold">{hospital.name}</h2>
          <p className="text-sm font-bold text-ink-soft">
            {t("health.sourceManual")}
          </p>
          {hospital.address ? <p>{hospital.address}</p> : null}
          <div className="flex flex-wrap gap-2">
            {hospital.emergencyPhone ? (
              <ButtonLink
                href={telHref(hospital.emergencyPhone)}
                variant="danger"
              >
                {t("emergency.callHospitalEmergency")}
              </ButtonLink>
            ) : null}
            {hospital.phone ? (
              <ButtonLink href={telHref(hospital.phone)} variant="secondary">
                {t("health.callHospital")}
              </ButtonLink>
            ) : null}
          </div>
        </Card>
      ) : null}

      {medical &&
      (medical.bloodGroup ||
        medical.allergies ||
        medical.conditions ||
        medical.instructions) ? (
        <Card className="space-y-1">
          <h2 className="text-xl font-extrabold">
            {t("emergency.forResponders")}
          </h2>
          {medical.bloodGroup ? (
            <p>
              <strong>{t("health.blood")}:</strong> {medical.bloodGroup}
            </p>
          ) : null}
          {medical.allergies ? (
            <p>
              <strong>{t("health.allergies")}:</strong> {medical.allergies}
            </p>
          ) : null}
          {medical.conditions ? (
            <p>
              <strong>{t("health.conditions")}:</strong> {medical.conditions}
            </p>
          ) : null}
          {medical.instructions ? (
            <p>
              <strong>{t("health.instructions")}:</strong>{" "}
              {medical.instructions}
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card className="space-y-3">
        <h2 className="text-xl font-extrabold">{t("emergency.location")}</h2>
        <p className="text-ink-soft">{t("emergency.locationExplain")}</p>
        {loc && typeof loc === "object" ? (
          <div className="flex flex-wrap gap-2">
            {medical?.emergencyContacts[0] ? (
              <ButtonLink
                href={`sms:${medical.emergencyContacts[0].phone.replace(/[^0-9+]/g, "")}?body=${smsBody(loc.link)}`}
                variant="secondary"
              >
                {t("emergency.sendTo", {
                  name: medical.emergencyContacts[0].name,
                })}
              </ButtonLink>
            ) : null}
            <Button
              variant="quiet"
              onClick={() => void navigator.clipboard?.writeText(loc.link)}
            >
              {t("emergency.copyLink")}
            </Button>
          </div>
        ) : (
          <Button
            icon="pin"
            variant="secondary"
            busy={loc === "asking"}
            onClick={share}
          >
            {t("emergency.shareLocation")}
          </Button>
        )}
        {loc === "denied" ? (
          <p role="alert" className="font-bold text-danger">
            {t("safe.noLocation")}
          </p>
        ) : null}
      </Card>
      <p className="text-sm text-ink-soft">{t("emergency.never")}</p>
    </>
  );
}
