/**
 * Per-person reminder preferences, and the timezone / quiet-hours maths that
 * both the browser reminders and the server reminder sweep use. Pure.
 */

export type ReminderKind = "medicine" | "checkin" | "appointment" | "circle";
export const REMINDER_KINDS: readonly ReminderKind[] = ["medicine", "checkin", "appointment", "circle"];

export interface NotifyPrefs {
  /** IANA timezone, e.g. "Asia/Kolkata". Reminder times are read in this zone. */
  timezone: string;
  /** No reminders between these local times ("HH:mm"). Equal values = quiet hours off. */
  quietStart: string;
  quietEnd: string;
  kinds: Record<ReminderKind, boolean>;
  /** Delivery channels beyond the in-app list (which is always on). */
  channels: { push: boolean; email: boolean };
  updatedAt: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function defaultNotifyPrefs(timezone = "Asia/Kolkata", now = new Date()): NotifyPrefs {
  return {
    timezone: isValidTimezone(timezone) ? timezone : "Asia/Kolkata",
    quietStart: "21:30",
    quietEnd: "07:00",
    kinds: { medicine: true, checkin: true, appointment: true, circle: true },
    channels: { push: false, email: false },
    updatedAt: now.toISOString(),
  };
}

/** Validates untrusted input; anything malformed falls back to the default for that field. */
export function sanitizeNotifyPrefs(raw: unknown, now = new Date()): NotifyPrefs {
  const base = defaultNotifyPrefs(undefined, now);
  if (typeof raw !== "object" || raw === null) return base;
  const r = raw as Partial<NotifyPrefs>;
  const kinds = { ...base.kinds };
  for (const k of REMINDER_KINDS) if (typeof r.kinds?.[k] === "boolean") kinds[k] = r.kinds[k];
  return {
    timezone: typeof r.timezone === "string" && isValidTimezone(r.timezone) ? r.timezone : base.timezone,
    quietStart: typeof r.quietStart === "string" && TIME_RE.test(r.quietStart) ? r.quietStart : base.quietStart,
    quietEnd: typeof r.quietEnd === "string" && TIME_RE.test(r.quietEnd) ? r.quietEnd : base.quietEnd,
    kinds,
    channels: { push: r.channels?.push === true, email: r.channels?.email === true },
    updatedAt: now.toISOString(),
  };
}

/** Local wall-clock parts of `date` in `timezone`. */
export function localParts(date: Date, timezone: string): { dateKey: string; time: string; minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  const time = `${hour}:${get("minute")}`;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { dateKey: `${get("year")}-${get("month")}-${get("day")}`, time, minutes: Number(hour) * 60 + Number(get("minute")), weekday };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** True when `date` falls in the person's quiet hours (handles windows that cross midnight). */
export function inQuietHours(prefs: Pick<NotifyPrefs, "quietStart" | "quietEnd" | "timezone">, date: Date): boolean {
  const start = toMinutes(prefs.quietStart);
  const end = toMinutes(prefs.quietEnd);
  if (start === end) return false;
  const now = localParts(date, prefs.timezone).minutes;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** Whether a reminder of this kind may be shown or sent to this person right now. */
export function mayRemind(prefs: NotifyPrefs, kind: ReminderKind, date: Date): boolean {
  return prefs.kinds[kind] && !inQuietHours(prefs, date);
}

export const REMINDER_WINDOW_MINUTES = 10;

function minutesInQuiet(prefs: Pick<NotifyPrefs, "quietStart" | "quietEnd">, minutes: number): boolean {
  const start = toMinutes(prefs.quietStart);
  const end = toMinutes(prefs.quietEnd);
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/**
 * What to do about one reminder right now, in the person's local minutes.
 * - "send": it is due (or its quiet-hours delay just ended)
 * - "wait": not yet due, or inside quiet hours — ask again later
 * - "skip": the kind is switched off, or the moment has passed
 * Something due during quiet hours is sent once, in the first minutes after they end.
 */
export function reminderDecision(prefs: NotifyPrefs, kind: ReminderKind, dueMinutes: number, nowMinutes: number): "send" | "wait" | "skip" {
  if (!prefs.kinds[kind]) return "skip";
  const elapsed = nowMinutes - dueMinutes;
  if (elapsed < 0) return "wait";
  if (minutesInQuiet(prefs, nowMinutes)) return "wait";
  if (elapsed < REMINDER_WINDOW_MINUTES) return "send";
  const quietEnd = toMinutes(prefs.quietEnd);
  const sinceQuietEnd = nowMinutes - quietEnd;
  const deferred = minutesInQuiet(prefs, dueMinutes) && sinceQuietEnd >= 0 && sinceQuietEnd < REMINDER_WINDOW_MINUTES;
  return deferred ? "send" : "skip";
}
