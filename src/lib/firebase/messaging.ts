import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { getFirebase } from "./client";
import { VAPID_KEY, firebaseConfig } from "./config";

export type PushSetup = "enabled" | "unsupported" | "denied" | "not-configured";

/** Short, stable id for a token so re-registering the same device overwrites its doc. */
async function tokenId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Turns on web push for this device: asks the browser for permission,
 * registers the messaging service worker and stores the device token under
 * users/{uid}/devices for the reminder sweep.
 */
export async function enablePush(uid: string): Promise<PushSetup> {
  if (!VAPID_KEY || !firebaseConfig.messagingSenderId) return "not-configured";
  if (!(await isSupported()) || !("serviceWorker" in navigator)) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    projectId: firebaseConfig.projectId,
    appId: firebaseConfig.appId,
    messagingSenderId: firebaseConfig.messagingSenderId,
  });
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
  const { app, db } = getFirebase();
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  await setDoc(doc(db, "users", uid, "devices", await tokenId(token)), { token, createdAt: new Date().toISOString(), userAgent: navigator.userAgent.slice(0, 300) });
  return "enabled";
}

/** Records that a reminder really reached this device (shown in the open app, or opened from a notification). */
export async function markReminderDelivered(elderId: string, notificationId: string): Promise<void> {
  if (!/^[\w-]{1,200}$/.test(notificationId)) return;
  await updateDoc(doc(getFirebase().db, "elders", elderId, "notifications", notificationId), { deliveredAt: serverTimestamp() });
}

/** While the app is open, a push arrives here instead of the system tray. Returns an unsubscribe function. */
export async function listenForReminders(elderId: string, show: (body: string) => void): Promise<() => void> {
  if (!VAPID_KEY || !(await isSupported())) return () => undefined;
  return onMessage(getMessaging(getFirebase().app), (payload) => {
    const id = payload.data?.notificationId;
    if (payload.notification?.body) show(payload.notification.body);
    if (id && payload.data?.elderId === elderId) void markReminderDelivered(elderId, id).catch(() => undefined);
  });
}
