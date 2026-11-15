/**
 * Real-time voice with Gemini Live (real-server mode only).
 * - Microphone → 16 kHz PCM via an AudioWorklet → session.sendRealtimeInput
 * - Model audio (24 kHz PCM) is queued for gap-free playback and stopped at
 *   once when the model reports it was interrupted (the elder talked over it)
 * - Live transcripts of both sides are reported for the on-screen log
 * - One automatic reconnect with a fresh token if the connection drops
 * The token comes from the `liveToken` Cloud Function, which locks the model,
 * voice and safety instructions; the API key never reaches the browser.
 */
import type { CompanionEntry, CompanionLanguage } from "@shared/companionContext";
import type { CompanionPersona } from "@shared/persona";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { deviceTimeZone } from "./serverAi";

/** What the token server needs in browser-stored mode (with Firebase, the server reads it itself). */
export interface LiveContext {
  persona: CompanionPersona;
  preferredName: string;
  entries: readonly CompanionEntry[];
}

export type LiveState = "connecting" | "listening" | "thinking" | "speaking" | "paused" | "closed" | "error";

export interface LiveCallbacks {
  onState: (state: LiveState) => void;
  onTranscript: (who: "user" | "pookie", text: string) => void;
  onTurnEnd: () => void;
}

const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

function toBase64Pcm16(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64Pcm16(data: string): Float32Array<ArrayBuffer> {
  const binary = atob(data);
  const out = new Float32Array(new ArrayBuffer((binary.length / 2) * 4));
  for (let i = 0; i < out.length; i += 1) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    const v = (hi << 8) | lo;
    out[i] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000;
  }
  return out;
}

async function fetchToken(language: CompanionLanguage, context: LiveContext): Promise<{ token: string; model: string }> {
  if (!isFirebaseConfigured) {
    const res = await fetch("/api/live-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, persona: context.persona, preferredName: context.preferredName, entries: context.entries, timeZone: deviceTimeZone() }),
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as { token: string; model: string };
  }
  const [{ httpsCallable }, { getFirebase }] = await Promise.all([import("firebase/functions"), import("@/lib/firebase/client")]);
  const call = httpsCallable<{ language: CompanionLanguage }, { token: string; model: string }>(getFirebase().functions, "liveToken");
  return (await call({ language })).data;
}

export class LiveVoice {
  private session: { sendRealtimeInput: (p: { audio?: { data: string; mimeType: string }; audioStreamEnd?: boolean }) => void; close: () => void } | null = null;
  private micContext: AudioContext | null = null;
  private playContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private playing: AudioBufferSourceNode[] = [];
  private playhead = 0;
  private paused = false;
  private closedByUser = false;
  private reconnects = 0;

  constructor(
    private readonly language: CompanionLanguage,
    private readonly cb: LiveCallbacks,
    private readonly context: LiveContext,
  ) {}

  async start(): Promise<void> {
    this.closedByUser = false;
    this.cb.onState("connecting");
    this.stream ??= await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    await this.connect();
    await this.startMic();
  }

  private async connect(): Promise<void> {
    const { token, model } = await fetchToken(this.language, this.context);
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });
    this.session = await ai.live.connect({
      model,
      callbacks: {
        onopen: () => this.cb.onState(this.paused ? "paused" : "listening"),
        onmessage: (message) => {
          const content = message.serverContent;
          if (!content) return;
          if (content.interrupted) this.stopPlayback();
          if (content.inputTranscription?.text) {
            this.cb.onTranscript("user", content.inputTranscription.text);
            if (this.playing.length === 0) this.cb.onState("thinking");
          }
          if (content.outputTranscription?.text) this.cb.onTranscript("pookie", content.outputTranscription.text);
          for (const part of content.modelTurn?.parts ?? []) {
            if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/pcm")) this.play(part.inlineData.data);
          }
          if (content.turnComplete) this.cb.onTurnEnd();
        },
        onerror: () => this.cb.onState("error"),
        onclose: () => void this.handleClose(),
      },
    });
  }

  private async handleClose(): Promise<void> {
    this.session = null;
    if (this.closedByUser) return;
    // The connection dropped (network, token expiry): try once with a fresh token.
    if (this.reconnects < 1) {
      this.reconnects += 1;
      try {
        this.cb.onState("connecting");
        await this.connect();
        return;
      } catch {
        /* fall through */
      }
    }
    this.cb.onState("error");
    this.teardown();
  }

  private async startMic(): Promise<void> {
    if (!this.stream) return;
    this.micContext = new AudioContext({ sampleRate: 16000 });
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await this.micContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const source = this.micContext.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(this.micContext, "pcm-capture");
    let buffer: Float32Array[] = [];
    let size = 0;
    node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (this.paused || !this.session) return;
      buffer.push(e.data);
      size += e.data.length;
      if (size >= 1600) {
        // ~100 ms chunks
        const chunk = new Float32Array(size);
        let offset = 0;
        for (const b of buffer) {
          chunk.set(b, offset);
          offset += b.length;
        }
        buffer = [];
        size = 0;
        this.session.sendRealtimeInput({ audio: { data: toBase64Pcm16(chunk), mimeType: "audio/pcm;rate=16000" } });
      }
    };
    source.connect(node);
  }

  private play(base64: string): void {
    this.playContext ??= new AudioContext({ sampleRate: 24000 });
    const ctx = this.playContext;
    const samples = fromBase64Pcm16(base64);
    const buffer = ctx.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    this.playhead = Math.max(this.playhead, ctx.currentTime);
    node.start(this.playhead);
    this.playhead += buffer.duration;
    this.playing.push(node);
    this.cb.onState("speaking");
    node.onended = () => {
      this.playing = this.playing.filter((n) => n !== node);
      if (this.playing.length === 0 && !this.paused) this.cb.onState("listening");
    };
  }

  /** Stops Pookie talking right away (the "interrupt" control, or when the elder talks over it). */
  stopPlayback(): void {
    for (const n of this.playing) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.playing = [];
    this.playhead = 0;
    if (!this.paused) this.cb.onState("listening");
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.stopPlayback();
      this.session?.sendRealtimeInput({ audioStreamEnd: true });
      this.cb.onState("paused");
    } else {
      this.cb.onState("listening");
    }
  }

  end(): void {
    this.closedByUser = true;
    this.session?.close();
    this.session = null;
    this.teardown();
    this.cb.onState("closed");
  }

  private teardown(): void {
    this.stopPlayback();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.micContext?.close();
    void this.playContext?.close();
    this.micContext = null;
    this.playContext = null;
  }
}
