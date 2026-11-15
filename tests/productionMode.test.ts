import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/functions", () => ({
  httpsCallable: () => () => Promise.reject(new Error("service unavailable")),
}));

vi.mock("@/lib/firebase/client", () => ({
  getFirebase: () => ({ functions: {} }),
}));

import { CompanionServiceUnavailableError, requestCompanionReply } from "@/lib/ai/companionClient";
import { resolveApplicationMode } from "@/lib/firebase/config";

describe("production mode selection", () => {
  it("requires Firebase unless an explicit development fixture is enabled", () => {
    expect(resolveApplicationMode(true, false)).toBe("firebase");
    expect(resolveApplicationMode(false, true)).toBe("demo");
    expect(resolveApplicationMode(false, false)).toBe("unconfigured");
  });
});

describe("companion service boundary", () => {
  const request = {
    turns: [{ role: "user" as const, text: "Hello" }],
    language: "en" as const,
    facts: [],
    preferredName: "Asha",
    persona: "pookie" as const,
  };

  it("uses scripted text only for explicit demo mode", async () => {
    const reply = await requestCompanionReply({ ...request, mode: "demo" });
    expect(reply.source).toBe("scripted");
  });

  it("surfaces a real-service failure instead of fabricating a reply", async () => {
    await expect(requestCompanionReply({ ...request, mode: "firebase" })).rejects.toBeInstanceOf(CompanionServiceUnavailableError);
  });
});
