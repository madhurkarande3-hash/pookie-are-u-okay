import { ValidationError } from "@/lib/types";

/** Input validation shared by every repository. Limits mirror firestore.rules. */

export const LIMITS = { name: 80, short: 120, note: 1000, detail: 2000, timesPerMedication: 8 } as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Trims, collapses control characters, and enforces length. */
export function cleanText(field: string, value: string, max: number, required = false): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (required && cleaned.length === 0) throw new ValidationError(field, "required");
  if (cleaned.length > max) throw new ValidationError(field, "tooLong");
  return cleaned;
}

export function assertTime(field: string, value: string): string {
  if (!TIME_RE.test(value)) throw new ValidationError(field, "badTime");
  return value;
}

export function assertDate(field: string, value: string): string {
  if (!DATE_RE.test(value)) throw new ValidationError(field, "badDate");
  return value;
}

export function cleanEmail(field: string, value: string): string {
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) throw new ValidationError(field, "badEmail");
  return email;
}

export function cleanTimes(field: string, values: readonly string[]): string[] {
  const unique = [...new Set(values.map((v) => assertTime(field, v)))].sort();
  if (unique.length === 0) throw new ValidationError(field, "required");
  if (unique.length > LIMITS.timesPerMedication) throw new ValidationError(field, "tooMany");
  return unique;
}

/** Digits, spaces, "+", "-" and brackets; 6–20 characters. Empty is allowed (no phone). */
export function cleanPhone(value: string): string {
  const phone = value.trim();
  if (!phone) return "";
  if (!/^\+?[0-9][0-9 ()-]{5,19}$/.test(phone)) throw new ValidationError("phone", "badPhone");
  return phone;
}
