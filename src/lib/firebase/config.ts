/**
 * Public Firebase web config, read from the environment. Kept free of Firebase
 * SDK imports so Demo Mode never downloads the SDK.
 * Safe to ship: data access is decided by firestore.rules, not by this key.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
};

/** Web Push key from Firebase console → Cloud Messaging → Web configuration. Optional. */
export const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";
/** reCAPTCHA Enterprise site key for App Check. Optional; when set, App Check tokens are sent with every call. */
export const APP_CHECK_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY ?? "";

export const FUNCTIONS_REGION = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "asia-south1";
export const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

/** A production build needs these public Firebase identifiers before it can start. */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

/**
 * Demo fixtures are deliberately opt-in. They are useful for local development
 * and a synthetic judging walk-through, but must never become a silent
 * replacement for authentication, persistence, email, notifications or Gemini.
 */
export const isDemoModeEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

export type ApplicationMode = "firebase" | "demo" | "unconfigured";

export function resolveApplicationMode(firebaseConfigured: boolean, demoEnabled: boolean): ApplicationMode {
  if (firebaseConfigured) return "firebase";
  if (demoEnabled) return "demo";
  return "unconfigured";
}

export const applicationMode = resolveApplicationMode(isFirebaseConfigured, isDemoModeEnabled);
