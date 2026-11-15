import { describe, expect, it } from "vitest";
import { auditEntry, changedFields } from "@shared/audit";
import { consume, type RateState } from "@shared/rateLimit";

describe("AI rate limit", () => {
  it("allows a burst up to the per-minute limit, then pauses until the next minute", () => {
    const limits = { perMinute: 3, perDay: 100 };
    let state: RateState | undefined;
    const t0 = Date.UTC(2026, 5, 10, 9, 0, 5);
    const results = [0, 1, 2, 3].map((i) => {
      const r = consume(state, t0 + i * 1000, limits);
      state = r.state;
      return r.allowed;
    });
    expect(results).toEqual([true, true, true, false]);
    expect(consume(state, t0 + 60_000, limits).allowed).toBe(true);
  });

  it("enforces a daily cap that resets the next day", () => {
    const limits = { perMinute: 100, perDay: 2 };
    const day = Date.UTC(2026, 5, 10, 9);
    let state = consume(undefined, day, limits).state;
    state = consume(state, day + 120_000, limits).state;
    expect(consume(state, day + 240_000, limits).allowed).toBe(false);
    expect(consume(state, day + 86_400_000, limits).allowed).toBe(true);
  });
});

describe("audit log", () => {
  it("records which permission changed, never its value", () => {
    const entry = auditEntry({
      before: { permissions: { viewMedications: true, manageCare: false }, status: "active" },
      after: { permissions: { viewMedications: true, manageCare: true }, status: "active" },
      collection: "members",
      docId: "priya",
      byUid: "elder-1",
      byType: "app_user",
      at: new Date("2026-06-10T09:00:00Z"),
    });
    expect(entry).toMatchObject({ action: "update", changedFields: ["permissions.manageCare"], byUid: "elder-1" });
    expect(JSON.stringify(entry)).not.toContain("true");
  });

  it("names creates and deletes, and skips no-op updates", () => {
    const base = { collection: "lifebook", docId: "e1", byUid: "x", byType: "app_user", at: new Date() };
    expect(auditEntry({ ...base, before: null, after: { title: "Meera" } })?.action).toBe("create");
    expect(auditEntry({ ...base, before: { title: "Meera" }, after: null })?.action).toBe("delete");
    expect(auditEntry({ ...base, before: { title: "Meera", updatedAt: "1" }, after: { title: "Meera", updatedAt: "2" } })).toBeNull();
  });

  it("notices consent changes inside the profile", () => {
    expect(changedFields({ consent: { sharingPaused: false, updatedAt: "1" } }, { consent: { sharingPaused: true, updatedAt: "2" } })).toEqual(["consent.sharingPaused"]);
  });
});
