import { GoogleGenAI, Modality } from "@google/genai";
import { NextResponse } from "next/server";
import { LIVE_VOICE } from "@shared/voices";
import { LIVE_MODEL, allow, hasGeminiKey, parse } from "@/lib/server/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Single-use, short-lived Gemini Live token with the model, voice and safety instructions locked in. */
export async function POST(request: Request) {
  if (!hasGeminiKey()) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  if (!allow(request, "live")) return NextResponse.json({ error: "slow-down" }, { status: 429 });
  const raw = await request.text();
  if (raw.length > 200_000) return NextResponse.json({ error: "too-large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const { systemInstruction, persona } = parse({ ...(body as object), messages: [{ role: "user", text: "-" }] });
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1alpha" } });
    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: LIVE_VOICE[persona] } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
        httpOptions: { apiVersion: "v1alpha" },
      },
    });
    if (!token.name) throw new Error("no token");
    return NextResponse.json({ token: token.name, model: LIVE_MODEL });
  } catch (err) {
    console.error("live-token failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
