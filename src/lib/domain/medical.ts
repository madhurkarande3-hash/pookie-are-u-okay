import type { Hospital, MedicalProfile } from "@/lib/types";

export function emptyMedical(): MedicalProfile {
  return { bloodGroup: "", allergies: "", conditions: "", instructions: "", emergencyContacts: [], hospitals: [], doctors: [], preferredHospitalId: null, preferredDoctorId: null, updatedAt: "" };
}

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/** India's single emergency number. */
export const EMERGENCY_NUMBER = "112";

export function searchHospitals(list: readonly Hospital[], query: string): Hospital[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...list];
  return list.filter((h) => [h.name, h.address, h.departments, h.notes].some((f) => f.toLowerCase().includes(q)));
}

export function preferredHospital(p: MedicalProfile | null): Hospital | null {
  return p?.hospitals.find((h) => h.id === p.preferredHospitalId) ?? p?.hospitals[0] ?? null;
}

export const telHref = (phone: string): string => `tel:${phone.replace(/[^0-9+]/g, "")}`;

/** A map link for the person to send themselves. Built only after they press "share my location". */
export const mapLink = (lat: number, lng: number): string => `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
