/** Minimal hash-based stand-in for next/navigation, used only by the single-file build. */
import { useSyncExternalStore } from "react";
import { hashFromPath, pathFromHash } from "../routes";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => pathFromHash(window.location.hash), () => "/");
}

export function navigate(href: string, replace = false): void {
  const hash = hashFromPath(href);
  if (hash === (window.location.hash || "#")) return;
  if (replace) {
    const url = hash === "#" ? window.location.pathname + window.location.search : hash;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = hash === "#" ? "" : hash;
  }
}

const router = {
  push: (href: string) => navigate(href),
  replace: (href: string) => navigate(href, true),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => undefined,
  prefetch: () => undefined,
};

export function useRouter(): typeof router {
  return router;
}
