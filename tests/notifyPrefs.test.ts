import { describe, expect, it } from "vitest";
import { defaultNotifyPrefs, inQuietHours, localParts, reminderDecision, sanitizeNotifyPrefs } from "@shared/notifyPrefs";

const prefs = defaultNotifyPrefs("Asia/Kolkata"); // quiet 21:30 → 07:00
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe("timezones", () => {
  it("reads wall-clock time in the person's timezone, not the server's", () => {
    const instant = new Date("2026-06-10T03:30:00Z");
    expect(localParts(instant, "Asia/Kolkata")).toMatchObject({ dateKey: "2026-06-10", time: "09:00" });
    expect(localParts(instant, "America/New_York")).toMatchObject({ dateKey: "2026-06-09", time: "23:30" });
  });

  it("handles quiet hours that cross midnight", () => {
    expect(inQuietHours(prefs, new Date("2026-06-10T17:00:00Z"))).toBe(true); // 22:30 IST
    expect(inQuietHours(prefs, new Date("2026-06-10T00:00:00Z"))).toBe(true); // 05:30 IST
    expect(inQuietHours(prefs, new Date("2026-06-10T04:30:00Z"))).toBe(false); // 10:00 IST
    expect(inQuietHours({ ...prefs, quietStart: "07:00", quietEnd: "07:00" }, new Date())).toBe(false);
  });
});

describe("reminder decisions", () => {
  it("sends when due, waits before, skips once the moment has passed", () => {
    expect(reminderDecision(prefs, "medicine", at("09:00"), at("08:59"))).toBe("wait");
    expect(reminderDecision(prefs, "medicine", at("09:00"), at("09:04"))).toBe("send");
    expect(reminderDecision(prefs, "medicine", at("09:00"), at("09:30"))).toBe("skip");
  });

  it("holds reminders during quiet hours and sends a medicine once they end", () => {
    expect(reminderDecision(prefs, "medicine", at("06:30"), at("06:35"))).toBe("wait");
    expect(reminderDecision(prefs, "medicine", at("06:30"), at("07:02"))).toBe("send");
    expect(reminderDecision(prefs, "medicine", at("06:30"), at("07:30"))).toBe("skip");
  });

  it("never sends a kind the person switched off", () => {
    const off = { ...prefs, kinds: { ...prefs.kinds, checkin: false } };
    expect(reminderDecision(off, "checkin", at("14:00"), at("14:01"))).toBe("skip");
    expect(reminderDecision(off, "medicine", at("14:00"), at("14:01"))).toBe("send");
  });
});

describe("validation", () => {
  it("replaces anything malformed with safe defaults", () => {
    const clean = sanitizeNotifyPrefs({ timezone: "Mars/Olympus", quietStart: "25:00", quietEnd: "7am", kinds: { medicine: "yes", circle: false }, channels: { push: 1, email: true }, extra: "x" });
    expect(clean.timezone).toBe("Asia/Kolkata");
    expect(clean.quietStart).toBe("21:30");
    expect(clean.quietEnd).toBe("07:00");
    expect(clean.kinds).toEqual({ medicine: true, checkin: true, appointment: true, circle: false });
    expect(clean.channels).toEqual({ push: false, email: true });
    expect(Object.keys(clean)).not.toContain("extra");
  });
});
