"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_AUDIO_SECONDS, MAX_PHOTO_EDGE } from "@/lib/domain/lifebook";

/**
 * Re-draws a photo onto a canvas at most `maxEdge` pixels wide/high and
 * exports a JPEG. Besides making it small, this drops all EXIF metadata,
 * including GPS location — nothing about where the photo was taken is kept.
 */
export async function resizePhoto(file: Blob, maxEdge = MAX_PHOTO_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.82));
}

export type RecorderState = "idle" | "recording" | "done" | "unsupported" | "blocked";

/** Voice recording with MediaRecorder, stopped automatically at the time limit. */
export function useRecorder(maxSeconds = MAX_AUDIO_SECONDS) {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia)) setState("unsupported");
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm", "audio/ogg", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setBlob(new Blob(chunks, { type: (recorder.mimeType || "audio/webm").split(";")[0] }));
        setState("done");
      };
      recorderRef.current = recorder;
      setBlob(null);
      setSeconds(0);
      recorder.start();
      setState("recording");
      const started = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(elapsed);
        if (elapsed >= maxSeconds) stop();
      }, 250);
    } catch {
      setState("blocked");
    }
  }, [maxSeconds, stop]);

  return { state, seconds, blob, start, stop };
}
