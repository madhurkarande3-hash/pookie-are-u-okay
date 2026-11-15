import { NextResponse } from "next/server";
import { allow, parse } from "@/lib/server/gemini";
import { NoProviderError, getAIManager } from "@/lib/server/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the app show honestly whether replies come from a real AI or are scripted. */
export function GET() {
  return NextResponse.json({ available: getAIManager().configured });
}

/**
 * One companion reply. Tries the configured providers in priority order
 * (default Adaption → Gemini → OpenAI → Groq → OpenRouter). Nothing is
 * stored; logs carry only the provider and an error category.
 */
export async function POST(request: Request) {
  const ai = getAIManager();
  if (!ai.configured) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  if (!allow(request, "chat")) return NextResponse.json({ error: "slow-down" }, { status: 429 });
  const raw = await request.text();
  if (raw.length > 200_000) return NextResponse.json({ error: "too-large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const { turns, systemInstruction, plainInstruction } = parse(body);
  if (!turns) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const reply = await ai.reply({ turns, personal: systemInstruction, plain: plainInstruction, temperature: 0.6, maxOutputTokens: 1024 });
    if (reply.skipped.length) console.warn("companion fallback:", reply.skipped.map((s) => `${s.provider}:${s.category}`).join(","), "→", reply.provider);
    return NextResponse.json({ text: reply.text, provider: reply.provider });
  } catch (err) {
    const skipped = err instanceof NoProviderError ? err.skipped.map((s) => `${s.provider}:${s.category}`).join(",") : "unknown";
    console.error("companion unavailable:", skipped);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
