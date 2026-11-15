import { describe, expect, it } from "vitest";
import { buildDailyDoses, countDoses, doseLogId, makeDoseLog, resolveDoseState } from "@/lib/domain/medication";
import type { DoseLog, Medication } from "@/lib/types";
import { TODAY, at } from "./helpers";

const med = (id: string, times: string[], active = true): Medication => ({ id, name: `Med ${id}`, dose: "1 tablet", times, notes: "", active, createdAt: "" });
const log = (medicationId: string, time: string, status: DoseLog["status"], dateKey = TODAY): DoseLog => ({ id: doseLogId(dateKey, medicationId, time), medicationId, dateKey, time, status, confirmedAt: "" });

describe("dose states", () => {
  it("is upcoming before the time, due within the grace period, unconfirmed after it", () => {
    expect(resolveDoseState("09:00", null, true, at("08:59"))).toBe("upcoming");
    expect(resolveDoseState("09:00", null, true, at("09:00"))).toBe("due");
    expect(resolveDoseState("09:00", null, true, at("09:59"))).toBe("due");
    expect(resolveDoseState("09:00", null, true, at("10:00"))).toBe("unconfirmed");
  });

  it("never turns silence into 'missed' — only an explicit log can", () => {
    expect(resolveDoseState("09:00", null, true, at("23:59"))).toBe("unconfirmed");
    expect(resolveDoseState("09:00", null, false, at("00:01"))).toBe("unconfirmed");
    expect(resolveDoseState("09:00", log("a", "09:00", "missed"), true, at("23:59"))).toBe("missed");
  });

  it("uses the elder's answer regardless of the clock", () => {
    expect(resolveDoseState("21:00", log("a", "21:00", "taken"), true, at("08:00"))).toBe("taken");
    expect(resolveDoseState("09:00", log("a", "09:00", "taken"), true, at("22:00"))).toBe("taken");
  });
});

describe("daily dose list", () => {
  const meds = [med("a", ["20:00", "08:00"]), med("b", ["08:00"]), med("c", ["12:00"], false)];

  it("expands active medicines into time-ordered doses and skips inactive ones", () => {
    const doses = buildDailyDoses(meds, [], TODAY, TODAY, at("07:00"));
    expect(doses.map((d) => `${d.medication.id}@${d.time}`)).toEqual(["a@08:00", "b@08:00", "a@20:00"]);
  });

  it("keeps taken, missed and unconfirmed as three separate states", () => {
    const logs = [log("a", "08:00", "taken"), log("b", "08:00", "missed")];
    const doses = buildDailyDoses([...meds, med("d", ["09:00"])], logs, TODAY, TODAY, at("13:00"));
    expect(countDoses(doses)).toEqual({ taken: 1, missed: 1, unconfirmed: 1, upcoming: 1, due: 0 });
  });

  it("ignores logs from other days", () => {
    const doses = buildDailyDoses(meds, [log("a", "08:00", "taken", "2026-06-09")], TODAY, TODAY, at("08:10"));
    expect(doses[0]?.state).toBe("due");
  });

  it("creates a log that points back at exactly one dose", () => {
    const [first] = buildDailyDoses(meds, [], TODAY, TODAY, at("08:10"));
    const created = makeDoseLog(first!, TODAY, "taken", at("08:10"));
    expect(created).toMatchObject({ id: doseLogId(TODAY, "a", "08:00"), medicationId: "a", time: "08:00", status: "taken" });
    const after = buildDailyDoses(meds, [created], TODAY, TODAY, at("08:10"));
    expect(after.filter((d) => d.state === "taken")).toHaveLength(1);
  });
});

describe("medicine frequency and dates", async () => {
  const { isScheduledOn } = await import("@/lib/domain/medication");
  const { sanitizeMedication } = await import("@/lib/data/sanitize");
  const { ValidationError } = await import("@/lib/types");
  const base = { id: "m", name: "Vitamin D", dose: "", times: ["09:00"], notes: "", active: true, createdAt: "2026-06-01T00:00:00.000Z" };

  it("defaults to every day from the day it was added", () => {
    expect(isScheduledOn(base, "2026-05-31")).toBe(false);
    expect(isScheduledOn(base, "2026-06-10")).toBe(true);
  });

  it("follows chosen weekdays (2026-06-10 is a Wednesday)", () => {
    const med = { ...base, frequency: { kind: "weekdays" as const, days: [1, 3, 5] } };
    expect(isScheduledOn(med, "2026-06-10")).toBe(true);
    expect(isScheduledOn(med, "2026-06-11")).toBe(false);
  });

  it("counts every-N-days from the start date", () => {
    const med = { ...base, startDate: "2026-06-01", frequency: { kind: "interval" as const, everyDays: 3 } };
    expect(["2026-06-01", "2026-06-04", "2026-06-07"].every((d) => isScheduledOn(med, d))).toBe(true);
    expect(isScheduledOn(med, "2026-06-02")).toBe(false);
  });

  it("stops after the end date and never schedules a paused medicine", () => {
    expect(isScheduledOn({ ...base, endDate: "2026-06-05" }, "2026-06-06")).toBe(false);
    expect(isScheduledOn({ ...base, active: false }, "2026-06-10")).toBe(false);
  });

  it("rejects an end before the start, empty weekdays and silly intervals", () => {
    expect(() => sanitizeMedication({ ...base, startDate: "2026-06-10", endDate: "2026-06-01" })).toThrow(ValidationError);
    expect(() => sanitizeMedication({ ...base, frequency: { kind: "weekdays", days: [] } })).toThrow(ValidationError);
    expect(() => sanitizeMedication({ ...base, frequency: { kind: "interval", everyDays: 1 } })).toThrow(ValidationError);
    expect(sanitizeMedication(base)).toMatchObject({ frequency: { kind: "daily" }, startDate: "2026-06-01", endDate: null });
  });
});
