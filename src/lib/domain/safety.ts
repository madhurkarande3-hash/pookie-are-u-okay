import type { SafeZone } from "@/lib/types";

/** Great-circle distance in metres (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Outside the safe area, allowing for GPS error: a fix is only counted as
 * outside when even its accuracy circle lies beyond the radius.
 */
export function isOutside(zone: Pick<SafeZone, "lat" | "lng" | "radiusM">, fix: { lat: number; lng: number; accuracyM: number }): boolean {
  return distanceM(zone, fix) - Math.min(fix.accuracyM, 500) > zone.radiusM;
}

export const SAFE_RADII_M = [200, 500, 1000, 2000] as const;
export const ALERT_COOLDOWN_MS = 60 * 60 * 1000;
