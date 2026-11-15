"use client";

import { useEffect, useRef, useState } from "react";
import { newId } from "@/lib/domain/dates";
import { ALERT_COOLDOWN_MS, isOutside } from "@/lib/domain/safety";
import type { HelpRequest } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useSession } from "@/state/SessionProvider";

const LAST_ALERT_KEY = "pookie.safezone.lastAlert";

/**
 * Wandering safety. Runs only on the elder's device, only while Pookie is
 * open, and only when a safe area was set up with recorded consent. Leaving
 * it raises one gentle help request (at most once an hour) for people who
 * receive help requests. Location is never stored or shared — only the alert.
 */
export function useSafeZone(): { active: boolean; outside: boolean } {
  const { t } = usePrefs();
  const { session, repo, elder } = useSession();
  const zone = elder?.safeZone;
  const isElder = session.status === "ready" && session.actor.role === "elder";
  const active = Boolean(isElder && zone?.enabled && repo && "geolocation" in navigator);
  const [outside, setOutside] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!active || !zone || !repo || !elder) return undefined;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const out = isOutside(zone, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy });
        setOutside(out);
        if (!out || busy.current) return;
        let last = 0;
        try {
          last = Number(window.localStorage.getItem(LAST_ALERT_KEY) ?? 0);
        } catch {
          /* storage unavailable: still alert */
        }
        if (Date.now() - last < ALERT_COOLDOWN_MS) return;
        busy.current = true;
        const request: HelpRequest = { id: newId(), kind: "safezone", createdAt: new Date().toISOString(), message: t("safe.alertMessage", { name: elder.preferredName }), status: "open", acknowledgedBy: null, acknowledgedAt: null };
        void repo
          .saveHelpRequest(elder.id, request)
          .then(() => {
            try {
              window.localStorage.setItem(LAST_ALERT_KEY, String(Date.now()));
            } catch {
              /* ignore */
            }
          })
          .finally(() => {
            busy.current = false;
          });
      },
      () => setOutside(false),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active, zone, repo, elder, t]);

  return { active, outside };
}
