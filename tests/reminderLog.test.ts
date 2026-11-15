import { describe, expect, it } from "vitest";
import { REMINDER_LOG_KEY, REMINDER_LOG_MAX, appendReminderLog, mergeReminderHistory, readReminderLog, type ReminderRecord } from "@/lib/reminderLog";

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
}

describe("reminder history", () => {
  it("keeps shown reminders newest first, once per id", () => {
    const store = memoryStore();
    appendReminderLog({ id: "med:m1:08:00:2026-11-15", kind: "medicine", dateKey: "2026-11-15", time: "08:00", text: "Amlodipine" }, store);
    appendReminderLog({ id: "slot:s1:2026-11-15", kind: "checkin", dateKey: "2026-11-15", time: "09:00", text: "Morning" }, store);
    appendReminderLog({ id: "med:m1:08:00:2026-11-15", kind: "medicine", dateKey: "2026-11-15", time: "08:00", text: "Amlodipine" }, store);
    const log = readReminderLog(store);
    expect(log.map((r) => r.id)).toEqual(["med:m1:08:00:2026-11-15", "slot:s1:2026-11-15"]);
    expect(log.every((r) => r.source === "device")).toBe(true);
  });

  it("caps the log and survives bad stored data", () => {
    const store = memoryStore();
    for (let i = 0; i < REMINDER_LOG_MAX + 5; i += 1) appendReminderLog({ id: `r${i}`, kind: "medicine", dateKey: "2026-11-15", time: "08:00" }, store);
    expect(readReminderLog(store)).toHaveLength(REMINDER_LOG_MAX);
    expect(readReminderLog(memoryStore({ [REMINDER_LOG_KEY]: "not json" }))).toEqual([]);
    expect(readReminderLog(memoryStore({ [REMINDER_LOG_KEY]: '[{"id":1},{"id":"a","kind":"checkin","dateKey":"2026-11-15","time":"09:00"}]' }))).toHaveLength(1);
    expect(readReminderLog(null)).toEqual([]);
  });

  it("merges device and server records, server details winning, newest first", () => {
    const device: ReminderRecord[] = [
      { id: "a", kind: "medicine", dateKey: "2026-11-14", time: "20:00", text: "Evening pill", source: "device" },
      { id: "b", kind: "checkin", dateKey: "2026-11-15", time: "09:00", source: "device" },
    ];
    const server: ReminderRecord[] = [{ id: "a", kind: "medicine", dateKey: "2026-11-14", time: "20:00", source: "server", status: "done" }, { id: "c", kind: "appointment", dateKey: "2026-11-15", time: "10:00", source: "server" }];
    const merged = mergeReminderHistory(device, server);
    expect(merged.map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(merged[2]).toMatchObject({ source: "server", status: "done", text: "Evening pill" });
  });
});
