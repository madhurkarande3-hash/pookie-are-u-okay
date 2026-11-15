import { describe, expect, it } from "vitest";
import { buildSample } from "@/lib/data/demoSample";
import { sanitizeAppointment, sanitizeCheckin, sanitizeLifebookEntry, sanitizeMedication, sanitizeSchedule, sanitizeSummary } from "@/lib/data/sanitize";
import { findConflicts } from "@shared/memoryConflicts";
import { ELDER, asActor, makeRepo } from "./helpers";

describe("sample data (fictional)", () => {
  const sample = buildSample("demo-elder", new Date("2026-06-10T09:00:00"));

  it("passes the same validation as real input", () => {
    expect(() => {
      sample.medications.forEach(sanitizeMedication);
      sample.appointments.forEach(sanitizeAppointment);
      sample.checkins.forEach(sanitizeCheckin);
      sample.lifebook.forEach(sanitizeLifebookEntry);
      sample.schedules.forEach(sanitizeSchedule);
      sample.summaries.forEach(sanitizeSummary);
    }).not.toThrow();
  });

  it("uses only example.com addresses and has no conflicting memories", () => {
    expect(sample.circle.every((m) => m.email.endsWith("@example.com"))).toBe(true);
    expect(findConflicts(sample.lifebook)).toEqual([]);
  });

  it("loads into Demo Mode with a working Care Circle", async () => {
    const ctx = makeRepo(ELDER);
    ctx.demo.loadSample(new Date("2026-06-10T09:00:00"));
    expect((await ctx.repo.getElder(ctx.elderId))?.preferredName).toBe("Asha");
    const ravi = asActor(ctx.demo.peekMember("ravi.sample@example.com")!);
    ctx.as(ravi);
    expect(await ctx.repo.listMedications(ctx.elderId)).toHaveLength(3);
    // The eye check-up is private, but Ravi manages care, so he sees all visits.
    expect(await ctx.repo.listAppointments(ctx.elderId)).toHaveLength(3);
    await expect(ctx.repo.listCheckins(ctx.elderId)).rejects.toThrow();
  });
});
