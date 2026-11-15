"use client";

import { useEffect } from "react";

/**
 * Real-server mode only. Records that a push reminder actually reached this
 * device: when it arrives while Pookie is open, or when Pookie is opened from
 * the notification (/home?reminder=id). While the app is open the reminder is
 * already shown by useReminders, so nothing is shown twice.
 */
export function usePushReminders(enabled: boolean, elderId: string): void {
  useEffect(() => {
    if (!enabled) return undefined;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("@/lib/firebase/messaging").then(async (m) => {
      const opened = new URLSearchParams(window.location.search).get("reminder");
      if (opened) await m.markReminderDelivered(elderId, opened).catch(() => undefined);
      const unsubscribe = await m.listenForReminders(elderId, () => undefined);
      if (cancelled) unsubscribe();
      else stop = unsubscribe;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled, elderId]);
}
