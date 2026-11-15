import { describe, expect, it } from "vitest";
import { defaultNotifyPrefs } from "@shared/notifyPrefs";
import { nextAttempt, planReminders, RETRY_BACKOFF_MINUTES } from "@shared/reminderPlan";
import { reminderText } from "@shared/reminderText";

const prefs = defaultNotifyPrefs("Asia/Kolkata");
const med = { id: "m1", name: "Metformin", times: ["09:00", "21:00"], active: true, createdAt: "2026-06-01T00:00:00.000Z" };
const slot = { id: "s1", label: "Morning check-in", time: "09:00", status: "accepted" };
const visit = { id: "a1", doctor: "Dr. Mehta", date: "2026-06-10", time: "11:00", remind: true };
// 09:02 in India
const nineAmIst = new Date("2026-06-10T03:32:00Z");

const plan = (overrides: Partial<Parameters<typeof planReminders>[0]> = {}) =>
  planReminders({ now: nineAmIst, prefs, remindersConsent: true, medications: [med], schedules: [slot], appointments: [visit], ...overrides });

describe("server reminder planning", () => {
  it("plans what is due in the elder's own timezone, once per item and time", () => {
    const due = plan();
    expect(due.map((r) => r.id)).toEqual(["2026-06-10_medicine_m1_0900", "2026-06-10_checkin_s1_0900"]);
  });

  it("reminds about an appointment an hour before", () => {
    const tenAm = new Date("2026-06-10T04:31:00Z");
    expect(plan({ now: tenAm }).map((r) => r.kind)).toEqual(["appointment"]);
    expect(plan({ now: tenAm, appointments: [{ ...visit, status: "cancelled" }] })).toEqual([]);
  });

  it("sends nothing without consent, for switched-off kinds, or for medicines not scheduled today", () => {
    expect(plan({ remindersConsent: false })).toEqual([]);
    expect(plan({ prefs: { ...prefs, kinds: { ...prefs.kinds, medicine: false } } }).map((r) => r.kind)).toEqual(["checkin"]);
    expect(plan({ medications: [{ ...med, frequency: { kind: "weekdays", days: [0] } }] }).map((r) => r.kind)).toEqual(["checkin"]);
  });

  it("holds a 9 pm medicine during quiet hours and sends it once they end", () => {
    const tenPm = new Date("2026-06-10T16:32:00Z");
    expect(plan({ now: tenPm, schedules: [], appointments: [] })).toEqual([]);
    const morningAfter = new Date("2026-06-11T01:32:00Z"); // 07:02 IST
    const due = plan({ now: morningAfter, schedules: [], appointments: [], medications: [{ ...med, times: ["06:30"] }] });
    expect(due.map((r) => r.id)).toEqual(["2026-06-11_medicine_m1_0630"]);
  });

  it("never puts medicine names or doctors on the lock screen", () => {
    for (const lang of ["en", "hi"]) {
      for (const kind of ["medicine", "appointment", "checkin", "circle"] as const) {
        const text = reminderText(kind, lang);
        expect(`${text.title} ${text.body}`).not.toMatch(/Metformin|Mehta/);
      }
    }
  });

  it("retries a failed push with backoff, then stops", () => {
    const now = new Date("2026-06-10T00:00:00Z");
    expect(nextAttempt(1, now)?.toISOString()).toBe("2026-06-10T00:05:00.000Z");
    expect(nextAttempt(RETRY_BACKOFF_MINUTES.length + 1, now)).toBeNull();
  });
});
