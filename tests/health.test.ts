import { describe, expect, it } from "vitest";
import { sanitizeMedical } from "@/lib/data/sanitize";
import { buildSampleMedical } from "@/lib/data/demoSample";
import { mapLink, preferredHospital, searchHospitals, telHref } from "@/lib/domain/medical";
import { can } from "@/lib/domain/permissions";

describe("health hub", () => {
  it("cleans the profile and drops dangling hospital/doctor links", () => {
    const p = buildSampleMedical(new Date());
    const clean = sanitizeMedical({ ...p, preferredHospitalId: "nope", doctors: [{ ...p.doctors[0]!, hospitalId: "gone" }] });
    expect(clean.preferredHospitalId).toBeNull();
    expect(clean.doctors[0]?.hospitalId).toBeNull();
    expect(clean.hospitals.every((h) => h.source === "manual")).toBe(true);
  });
  it("rejects bad phone numbers and contacts without a phone", () => {
    const p = buildSampleMedical(new Date());
    expect(() => sanitizeMedical({ ...p, emergencyContacts: [{ id: "x", name: "A", relationship: "", phone: "call me" }] })).toThrow();
    expect(() => sanitizeMedical({ ...p, emergencyContacts: [{ id: "x", name: "A", relationship: "", phone: "" }] })).toThrow();
  });
  it("searches, picks the preferred hospital and builds safe links", () => {
    const p = buildSampleMedical(new Date());
    expect(searchHospitals(p.hospitals, "cardio")).toHaveLength(1);
    expect(searchHospitals(p.hospitals, "dental")).toHaveLength(0);
    expect(preferredHospital(p)?.id).toBe("h-sample");
    expect(telHref("+91 20 0000 0001")).toBe("tel:+912000000001");
    expect(mapLink(18.651234, 73.7612)).toBe("https://maps.google.com/?q=18.65123,73.76120");
  });
  it("only lets permitted members read or edit medical details", () => {
    const member = (perms: Record<string, boolean>) => ({ uid: "m", name: "M", role: "family" as const, status: "active" as const, permissions: perms as never });
    expect(can(member({ viewMedications: true }), "medical:read", { sharingPaused: false })).toBe(true);
    expect(can(member({ viewMedications: true }), "medical:write", { sharingPaused: false })).toBe(false);
    expect(can(member({ manageCare: true }), "medical:write", { sharingPaused: false })).toBe(true);
    expect(can(member({ viewLifebook: true }), "medical:read", { sharingPaused: false })).toBe(false);
  });
});
