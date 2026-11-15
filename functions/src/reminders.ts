/**
 * Reminders that arrive when Pookie is closed.
 *
 * reminderSweep (every 5 minutes):
 *  1. For each elder who consented to reminders, plan what is due right now in
 *     their own timezone, honouring quiet hours and the kinds they switched on.
 *  2. Create one notifications doc per reminder with a deterministic id — a
 *     second create fails, so the same reminder is never sent twice.
 *  3. Deliver each pending reminder: web push (FCM) and/or email, as chosen.
 *     Failed pushes are retried with backoff (5, 15, 45 min), then marked failed.
 *
 * Status is honest: "sent" means FCM or the mail queue accepted it.
 * "deliveredAt" is written only by the elder's own device when it actually
 * receives or opens the reminder.
 */
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions/v2";
import { defineString } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { inQuietHours, localParts, sanitizeNotifyPrefs, type NotifyPrefs, type ReminderKind } from "./shared/notifyPrefs";
import { nextAttempt, planReminders, type AppointmentLite, type MedicationLite, type ScheduleLite } from "./shared/reminderPlan";
import { reminderText } from "./shared/reminderText";

const REGION = "asia-south1";
/** "true" once the Firebase Trigger Email extension is installed (it sends docs written to `mail`). */
const EMAIL_ENABLED = defineString("EMAIL_ENABLED", { default: "false" });
const APP_URL = defineString("APP_URL", { default: "" });

type ChannelState = "off" | "pending" | "sent" | "queued" | "no-device" | "failed";

export interface ReminderDoc {
  kind: ReminderKind;
  refId: string;
  dateKey: string;
  time: string;
  status: "scheduled" | "retry" | "done";
  channels: { inApp: "available"; push: ChannelState; email: ChannelState };
  attempts: number;
  nextAttemptAt: Timestamp;
  createdAt: Timestamp;
  deliveredAt?: Timestamp | null;
}

async function loadPrefs(uid: string): Promise<NotifyPrefs> {
  const snap = await getFirestore().doc(`users/${uid}/settings/notify`).get();
  return sanitizeNotifyPrefs(snap.data());
}

/** Sends a web push to every device the person registered. Removes tokens FCM says are dead. */
export async function sendPush(uid: string, payload: { title: string; body: string; data: Record<string, string> }): Promise<"sent" | "no-device" | "failed"> {
  const db = getFirestore();
  const devices = await db.collection(`users/${uid}/devices`).get();
  const tokens = devices.docs.map((d) => String(d.get("token") ?? "")).filter(Boolean);
  if (tokens.length === 0) return "no-device";
  const link = APP_URL.value() ? `${APP_URL.value()}/home?reminder=${encodeURIComponent(payload.data.notificationId ?? "")}` : undefined;
  const result = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    webpush: link ? { fcmOptions: { link } } : undefined,
  });
  const dead = result.responses
    .map((r, i) => (!r.success && /registration-token-not-registered|invalid-registration-token/.test(r.error?.code ?? "") ? devices.docs.at(i)?.ref : undefined))
    .filter((ref): ref is DocumentReference => Boolean(ref));
  await Promise.all(dead.map((ref) => ref.delete()));
  return result.successCount > 0 ? "sent" : "failed";
}

async function queueEmail(uid: string, id: string, text: { title: string; body: string }): Promise<"queued" | "failed"> {
  try {
    const user = await getAuth().getUser(uid);
    if (!user.email || !user.emailVerified) return "failed";
    await getFirestore().doc(`mail/${id}`).create({ to: user.email, message: { subject: text.title, text: text.body } });
    return "queued";
  } catch (err) {
    // An existing mail doc means it was already queued: never send twice.
    if (String((err as { code?: unknown }).code) === "6") return "queued";
    logger.warn("email queue failed", { message: err instanceof Error ? err.message : "unknown" });
    return "failed";
  }
}

async function planForElder(elderId: string, language: unknown, now: Date): Promise<number> {
  const db = getFirestore();
  const prefs = await loadPrefs(elderId);
  const today = localParts(now, prefs.timezone).dateKey;
  const [meds, schedules, appointments] = await Promise.all([
    db.collection(`elders/${elderId}/medications`).where("active", "==", true).get(),
    db.collection(`elders/${elderId}/schedules`).where("status", "==", "accepted").get(),
    db.collection(`elders/${elderId}/appointments`).where("date", "==", today).get(),
  ]);
  const due = planReminders({
    now,
    prefs,
    remindersConsent: true,
    medications: meds.docs.map((d) => ({ ...(d.data() as MedicationLite), id: d.id })),
    schedules: schedules.docs.map((d) => ({ ...(d.data() as ScheduleLite), id: d.id })),
    appointments: appointments.docs.map((d) => ({ ...(d.data() as AppointmentLite), id: d.id })),
  });
  const emailOn = prefs.channels.email && EMAIL_ENABLED.value() === "true";
  let created = 0;
  for (const r of due) {
    const doc: ReminderDoc = {
      kind: r.kind,
      refId: r.refId,
      dateKey: r.dateKey,
      time: r.time,
      status: "scheduled",
      channels: { inApp: "available", push: prefs.channels.push ? "pending" : "off", email: emailOn ? "pending" : "off" },
      attempts: 0,
      nextAttemptAt: Timestamp.fromDate(now),
      createdAt: Timestamp.fromDate(now),
      deliveredAt: null,
    };
    try {
      await db.doc(`elders/${elderId}/notifications/${r.id}`).create({ ...doc, language: language === "hi" ? "hi" : "en" });
      created += 1;
    } catch {
      // Already exists: this reminder was planned in an earlier sweep. Duplicate prevented.
    }
  }
  return created;
}

async function deliver(ref: DocumentReference, now: Date): Promise<void> {
  const snap = await ref.get();
  const r = snap.data() as (ReminderDoc & { language?: string }) | undefined;
  if (!r || r.status === "done") return;
  const elderId = ref.parent.parent?.id;
  if (!elderId) return;
  const text = reminderText(r.kind, r.language);
  const channels = { ...r.channels };

  if (channels.push === "pending" || (r.status === "retry" && channels.push === "failed")) {
    channels.push = await sendPush(elderId, { ...text, data: { notificationId: ref.id, elderId, kind: r.kind } });
  }
  if (channels.email === "pending") channels.email = await queueEmail(elderId, `${elderId}_${ref.id}`, text);

  const attempts = r.attempts + 1;
  const retryAt = channels.push === "failed" ? nextAttempt(attempts, now) : null;
  await ref.update({
    channels,
    attempts,
    status: retryAt ? "retry" : "done",
    nextAttemptAt: retryAt ? Timestamp.fromDate(retryAt) : FieldValue.delete(),
    lastAttemptAt: Timestamp.fromDate(now),
  });
}

export const reminderSweep = onSchedule({ schedule: "every 5 minutes", region: REGION, timeoutSeconds: 240, memory: "512MiB", maxInstances: 1 }, async () => {
  const db = getFirestore();
  const now = new Date();
  const elders = await db.collection("elders").where("consent.reminders", "==", true).get();
  let planned = 0;
  for (const elder of elders.docs) {
    try {
      planned += await planForElder(elder.id, elder.get("language"), now);
    } catch (err) {
      logger.error("planning failed", { message: err instanceof Error ? err.message : "unknown" });
    }
  }
  const pending = await db.collectionGroup("notifications").where("status", "in", ["scheduled", "retry"]).where("nextAttemptAt", "<=", Timestamp.fromDate(now)).limit(300).get();
  for (const doc of pending.docs) {
    try {
      await deliver(doc.ref, now);
    } catch (err) {
      logger.error("delivery failed", { message: err instanceof Error ? err.message : "unknown" });
    }
  }
  logger.info("reminder sweep", { elders: elders.size, planned, delivered: pending.size });
});

/** Push to Care Circle members about a shared update — only if they chose push and are not in quiet hours. */
export async function pushCircleUpdate(uids: readonly string[], now: Date): Promise<void> {
  for (const uid of uids) {
    try {
      const prefs = await loadPrefs(uid);
      if (!prefs.kinds.circle || !prefs.channels.push || inQuietHours(prefs, now)) continue;
      await sendPush(uid, { ...reminderText("circle", "en"), data: { kind: "circle" } });
    } catch (err) {
      logger.warn("circle push failed", { message: err instanceof Error ? err.message : "unknown" });
    }
  }
}
