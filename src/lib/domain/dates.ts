/** Small local-time helpers. Dates are stored as "YYYY-MM-DD", times as "HH:mm". */

const pad = (n: number): string => String(n).padStart(2, "0");

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeKey(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function minutesOf(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

export function minutesNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function formatTime(time: string, locale: string): string {
  const d = new Date(2000, 0, 1, Math.floor(minutesOf(time) / 60), minutesOf(time) % 60);
  return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

export function formatDate(dateKey: string, locale: string): string {
  const [y = 2000, m = 1, d = 1] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Calendar arithmetic on "YYYY-MM-DD" keys, independent of the device timezone. */
const utcOf = (dateKey: string): number => {
  const [y = 2000, m = 1, d = 1] = dateKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function addDays(dateKey: string, days: number): string {
  return new Date(utcOf(dateKey) + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((utcOf(toKey) - utcOf(fromKey)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(dateKey: string): number {
  return new Date(utcOf(dateKey)).getUTCDay();
}
