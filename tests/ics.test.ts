import { describe, expect, it } from "vitest";
import { appointmentToIcs, escapeIcsText, foldIcsLine, icsFileName } from "@/lib/domain/ics";
import type { Appointment } from "@/lib/types";

const labels = { title: "Visit: Dr. Mehta", prepLabel: "How to prepare", alarm: "Appointment in 1 hour" };
const base: Appointment = {
  id: "a1",
  doctor: "Dr. Mehta",
  date: "2026-11-18",
  time: "11:00",
  location: "City Care Hospital, 2nd floor",
  notes: "Ask about dizziness",
  prep: "Bring reports; medicine list",
  remind: true,
  status: "scheduled",
  createdAt: "2026-11-01T00:00:00.000Z",
};
const now = new Date("2026-11-15T10:00:00.000Z");

describe("appointment calendar file", () => {
  it("writes a one-hour floating-time event with escaped text", () => {
    const ics = appointmentToIcs(base, labels, now);
    expect(ics).toContain("DTSTART:20261118T110000\r\n");
    expect(ics).toContain("DTEND:20261118T120000\r\n");
    expect(ics).toContain("DTSTAMP:20261115T100000Z\r\n");
    expect(ics).toContain("LOCATION:City Care Hospital\\, 2nd floor");
    expect(ics).toContain("UID:a1@pookie");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("adds a 1-hour alarm only when the reminder is on", () => {
    expect(appointmentToIcs(base, labels, now)).toContain("TRIGGER:-PT1H");
    expect(appointmentToIcs({ ...base, remind: false }, labels, now)).not.toContain("VALARM");
  });

  it("rolls the end time past midnight", () => {
    const ics = appointmentToIcs({ ...base, date: "2026-12-31", time: "23:30" }, labels, now);
    expect(ics).toContain("DTEND:20270101T003000");
  });

  it("marks cancelled visits and leaves out empty fields", () => {
    const ics = appointmentToIcs({ ...base, status: "cancelled", location: "", notes: "", prep: "" }, labels, now);
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("DESCRIPTION:How");
  });

  it("escapes and folds per RFC 5545", () => {
    expect(escapeIcsText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
    const long = "DESCRIPTION:" + "अ".repeat(60);
    const folded = foldIcsLine(long);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").map((l, i) => (i === 0 ? l : l.slice(1))).join("")).toBe(long);
    expect(icsFileName(base)).toBe("pookie-visit-2026-11-18.ics");
  });
});
