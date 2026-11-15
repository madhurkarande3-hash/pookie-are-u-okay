import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { NoProviderError, getAIManager } from "@/lib/server/ai";
import { ALL_PROVIDERS, type ProviderId } from "@/lib/server/ai/providers";
import { allow, hasGeminiKey } from "@/lib/server/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only. Off (404) unless ADMIN_DIAGNOSTICS_TOKEN is set; never returns keys or raw provider errors. */
function authorised(request: Request): boolean {
  const token = process.env.ADMIN_DIAGNOSTICS_TOKEN;
  if (!token || token.length < 16) return false;
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

export function GET(request: Request) {
  if (!process.env.ADMIN_DIAGNOSTICS_TOKEN) return new NextResponse(null, { status: 404 });
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const ai = getAIManager();
  return NextResponse.json({
    order: ai.order,
    primary: ai.order[0] ?? null,
    fallback: ai.order[1] ?? null,
    providers: ai.health(),
    voice: { geminiLive: hasGeminiKey(), cloudTts: false, browserFallback: true },
  });
}

/** Sends one tiny prompt to one provider ("Reply with the word ok"). */
export async function POST(request: Request) {
  if (!process.env.ADMIN_DIAGNOSTICS_TOKEN) return new NextResponse(null, { status: 404 });
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!allow(request, "diag")) return NextResponse.json({ error: "slow-down" }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { provider?: string };
  const provider = (ALL_PROVIDERS as readonly string[]).includes(body.provider ?? "") ? (body.provider as ProviderId) : undefined;
  if (!provider) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const started = Date.now();
  try {
    const r = await getAIManager().reply({ turns: [{ role: "user", text: "Reply with the single word: ok" }], personal: "You are a connectivity test. Reply with one word.", plain: "You are a connectivity test. Reply with one word.", temperature: 0, maxOutputTokens: 16 }, provider);
    return NextResponse.json({ ok: true, provider: r.provider, model: r.model, ms: Date.now() - started });
  } catch (e) {
    return NextResponse.json({ ok: false, provider, category: e instanceof NoProviderError ? (e.skipped[0]?.category ?? "not_configured") : "network", ms: Date.now() - started });
  }
}
