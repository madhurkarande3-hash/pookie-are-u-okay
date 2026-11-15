import { describe, expect, it } from "vitest";
import { distanceM, isOutside } from "@/lib/domain/safety";
import { orientationLines } from "@/lib/domain/orientation";
import { byAttention, summarisePatient } from "@/lib/careTeam/summary";
import { decisionReady } from "@/lib/domain/decision";
import { createTranslator } from "@/lib/i18n";
import type { Medication } from "@/lib/types";

const t = createTranslator("en");

describe("safe zone", () => {
  it("measures distance with haversine", () => {
    expect(distanceM({ lat: 18.65, lng: 73.73 }, { lat: 18.65, lng: 73.73 })).toBe(0);
    const d = distanceM({ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });
  it("only counts as outside beyond GPS accuracy", () => {
    const zone = { lat: 0, lng: 0, radiusM: 500 };
    expect(isOutside(zone, { lat: 0.006, lng: 0, accuracyM: 20 })).toBe(true);
    expect(isOutside(zone, { lat: 0.006, lng: 0, accuracyM: 300 })).toBe(false);
    expect(isOutside(zone, { lat: 0.001, lng: 0, accuracyM: 5 })).toBe(false);
  });
});

describe("where am I", () => {
  it("answers from approved data only, the same way each time", () => {
    const input = {
      elder: { preferredName: "Asha", homeLabel: "your home in Pune" },
      now: new Date(2026, 10, 15, 10, 0),
      todayKey: "2026-11-15",
      appointments: [{ id: "a", doctor: "Dr Rao", date: "2026-11-15", time: "16:00", place: "", notes: "", createdAt: "" }],
      schedules: [],
      people: [
        { id: "p", category: "people", title: "Priya", detail: "", relationship: "daughter", confirmed: true },
        { id: "q", category: "people", title: "Unconfirmed", detail: "", relationship: "x", confirmed: false },
      ],
      t,
      locale: "en-IN",
    } as never;
    const lines = orientationLines(input).join(" ");
    expect(orientationLines(input).join(" ")).toBe(lines);
    expect(lines).toContain("You are Asha.");
    expect(lines).toContain("your home in Pune");
    expect(lines).toContain("Dr Rao");
    expect(lines).toContain("Priya (daughter)");
    expect(lines).not.toContain("Unconfirmed");
  });
});

describe("care-team summary", () => {
  const med: Medication = { id: "m", name: "BP", dose: "", notes: "", times: ["08:00"], active: true, createdAt: "2026-11-01T00:00:00Z", startDate: "2026-11-01" };
  it("puts open help first and hides what is not shared", () => {
    const now = new Date(2026, 10, 15, 12, 0);
    const a = summarisePatient({ elderId: "a", elder: { preferredName: "Asha" } as never, medications: [med], doseLogs: [], help: [{ status: "open" } as never], checkins: null, appointments: null }, "2026-11-15", now);
    const b = summarisePatient({ elderId: "b", elder: { preferredName: "Bina" } as never, medications: null, doseLogs: null, help: [], checkins: null, appointments: null }, "2026-11-15", now);
    expect(a.openHelp).toBe(1);
    expect(a.doses).not.toBeNull();
    expect(b.doses).toBeNull();
    expect([b, a].sort(byAttention)[0]?.elderId).toBe("a");
    expect(summarisePatient({ elderId: "c", elder: null, medications: null, doseLogs: null, help: null, checkins: null, appointments: null }, "2026-11-15", now).sharingPaused).toBe(true);
  });
});

describe("guardian consent", () => {
  it("needs a named supporter, and an attested guardian", () => {
    const g = { name: "Ravi", relationship: "son", attested: false, recordedAt: "" };
    expect(decisionReady({ mode: "self", guardian: null })).toBe(true);
    expect(decisionReady({ mode: "supported", guardian: g })).toBe(true);
    expect(decisionReady({ mode: "guardian", guardian: g })).toBe(false);
    expect(decisionReady({ mode: "guardian", guardian: { ...g, attested: true } })).toBe(true);
    expect(decisionReady({ mode: "supported", guardian: { ...g, name: " " } })).toBe(false);
  });
});
