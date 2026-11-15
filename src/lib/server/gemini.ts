/**
 * Server-only helpers for the Vercel AI routes (/api/companion, /api/live-token).
 * Used when Pookie runs without Firebase: the browser keeps the data, the
 * server holds GEMINI_API_KEY and builds the safety instructions itself.
 */
import "server-only";
import { buildSystemInstruction, MAX_FACTS, sanitizeTurns, type ChatTurn, type CompanionEntry, type CompanionLanguage } from "@shared/companionContext";
import { toPersona } from "@shared/persona";
import { consume, type RateState } from "@shared/rateLimit";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
export const LIVE_MODEL = process.env.LIVE_MODEL || "gemini-2.5-flash-native-audio-preview-09-2025";
export const hasGeminiKey = (): boolean => Boolean(process.env.GEMINI_API_KEY);

/** Best-effort per-visitor limit (per server instance) so a public link can't run up the bill. */
const buckets = new Map<string, RateState>();
export function allow(request: Request, bucket: string): boolean {
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() ?? "local";
  const key = `${bucket}:${ip}`;
  const result = consume(buckets.get(key), Date.now(), { perMinute: 8, perDay: 200 });
  buckets.set(key, result.state);
  if (buckets.size > 5000) buckets.clear();
  return result.allowed;
}

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

/** Validates LifeBook entries sent by the browser (the elder's own, already confirmed and AI-allowed). */
function cleanEntries(raw: unknown): CompanionEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_FACTS).flatMap((e): CompanionEntry[] => {
    if (typeof e !== "object" || e === null) return [];
    const x = e as Record<string, unknown>;
    const source = (x.source ?? {}) as Record<string, unknown>;
    if (x.confirmed !== true || x.aiAllowed !== true) return [];
    return [
      {
        id: str(x.id, 100),
        category: str(x.category, 20),
        title: str(x.title, 120),
        detail: str(x.detail, 2000),
        relationship: str(x.relationship, 60),
        when: str(x.when, 60),
        people: Array.isArray(x.people) ? x.people.slice(0, 20).map((p) => str(p, 100)) : [],
        confirmed: true,
        aiAllowed: true,
        source: { type: source.type === "circle" ? "circle" : "self", byName: str(source.byName, 80) },
      },
    ];
  });
}

function nowText(language: CompanionLanguage, timeZone: unknown): string {
  const tz = typeof timeZone === "string" && /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(timeZone) ? timeZone : "Asia/Kolkata";
  try {
    return new Date().toLocaleString(language === "hi" ? "hi-IN" : "en-IN", { timeZone: tz, dateStyle: "full", timeStyle: "short" });
  } catch {
    return new Date().toUTCString();
  }
}

export interface ParsedRequest {
  turns: ChatTurn[] | null;
  language: CompanionLanguage;
  systemInstruction: string;
  /** The same rules without any LifeBook facts, for providers not allowed to see them. */
  plainInstruction: string;
  persona: ReturnType<typeof toPersona>;
}

export function parse(body: unknown): ParsedRequest {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const language: CompanionLanguage = b.language === "hi" ? "hi" : "en";
  const persona = toPersona(b.persona);
  const entries = cleanEntries(b.entries);
  const base = { preferredName: str(b.preferredName, 80), language, persona, now: nowText(language, b.timeZone) };
  const systemInstruction = buildSystemInstruction({ ...base, aiPersonalization: entries.length > 0, entries });
  const plainInstruction = buildSystemInstruction({ ...base, aiPersonalization: false, entries: [] });
  return { turns: sanitizeTurns(b.messages), language, systemInstruction, plainInstruction, persona };
}
