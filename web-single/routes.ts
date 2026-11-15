/**
 * Path ⇄ hash mapping for the single-file build. A hosted single page can only
 * route on a plain "#name", so each Next.js path gets a stable hash name.
 * ("settings" is reserved by the host, hence "prefs".)
 */
export const ROUTES = {
  "/": "",
  "/onboarding/pookie": "onboarding-pookie",
  "/onboarding/profile": "onboarding-profile",
  "/onboarding/circle": "onboarding-circle",
  "/onboarding/consent": "onboarding-consent",
  "/home": "home",
  "/companion": "talk",
  "/checkin": "checkin",
  "/medications": "medicines",
  "/appointments": "appointments",
  "/lifebook": "lifebook",
  "/family": "family",
  "/circle": "care-circle",
  "/settings": "prefs",
  "/privacy": "privacy",
  "/simple": "simple",
  "/remember": "remember",
  "/admin": "care-team",
  "/health": "health",
  "/emergency": "emergency",
  "/reminders": "reminders",
} as const;

export type RoutePath = keyof typeof ROUTES;

const BY_HASH = new Map<string, RoutePath>(Object.entries(ROUTES).map(([path, hash]) => [hash, path as RoutePath]));

export function pathFromHash(hash: string): RoutePath {
  return BY_HASH.get(hash.replace(/^#/, "")) ?? "/";
}

export function hashFromPath(href: string): string {
  const path = href.split(/[?#]/)[0] ?? "/";
  const name = (ROUTES as Record<string, string>)[path];
  return name === undefined || name === "" ? "#" : `#${name}`;
}
