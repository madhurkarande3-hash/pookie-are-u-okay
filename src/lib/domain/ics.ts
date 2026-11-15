import type { Appointment } from "@/lib/types";

/**
 * Builds an iCalendar (.ics) file for one appointment, so the elder or a
 * helper can add it to Google Calendar, Apple Calendar or Outlook without
 * Pookie needing access to their calendar account.
 *
 * Times are "floating" local times (no time zone): a 10:00 visit stays 10:00
 * on the phone that opens the file, which is what people expect for a
 * doctor's visit in their own town.
 */

const DEFAULT_MINUTES = 60;

/** RFC 5545 text escaping: backslash, semicolon, comma and newlines. */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding: lines longer than 75 octets continue on the next line after a space. */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (size + n > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function localStamp(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "").padEnd(4, "0")}00`;
}

function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes));
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`, time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` };
}

function utcStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export interface IcsLabels {
  /** Event title, e.g. "Visit: Dr. Mehta". */
  title: string;
  /** Heading for the preparation text in the description, e.g. "How to prepare". */
  prepLabel: string;
  /** Alarm text, e.g. "Appointment in 1 hour". */
  alarm: string;
}

export function appointmentToIcs(a: Appointment, labels: IcsLabels, now: Date = new Date()): string {
  const end = addMinutes(a.date, a.time, DEFAULT_MINUTES);
  const description = [a.prep ? `${labels.prepLabel}: ${a.prep}` : "", a.notes].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pookie//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.id}@pookie`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${localStamp(a.date, a.time)}`,
    `DTEND:${localStamp(end.date, end.time)}`,
    `SUMMARY:${escapeIcsText(labels.title)}`,
    a.location ? `LOCATION:${escapeIcsText(a.location)}` : "",
    description ? `DESCRIPTION:${escapeIcsText(description)}` : "",
    a.status === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    ...(a.remind ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcsText(labels.alarm)}`, "TRIGGER:-PT1H", "END:VALARM"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** A safe file name such as "pookie-visit-2026-11-18.ics". */
export function icsFileName(a: Appointment): string {
  return `pookie-visit-${a.date}.ics`;
}
