import { describe, expect, it } from "vitest";
import { decideSchedule, proposeSchedule, slotState } from "@/lib/domain/schedule";
import { PermissionError } from "@/lib/types";
import { ELDER, TODAY, at, member } from "./helpers";

const family = member({ proposeSchedule: true });

describe("care schedule consent flow", () => {
  it("starts a family suggestion as 'proposed', never active", () => {
    const s = proposeSchedule(family, "Morning check-in", "09:00", at("08:00"));
    expect(s.status).toBe("proposed");
    expect(s.decidedAt).toBeNull();
    expect(s.proposedBy).toMatchObject({ uid: family.uid, role: "family" });
  });

  it("activates a schedule the elder creates for themselves", () => {
    expect(proposeSchedule(ELDER, "Evening", "20:00", at("08:00")).status).toBe("accepted");
  });

  it("lets the elder accept, change the time, or decline", () => {
    const proposal = proposeSchedule(family, "Morning check-in", "09:00", at("08:00"));
    expect(decideSchedule(ELDER, proposal, { type: "accept" }, at("08:05")).status).toBe("accepted");
    const modified = decideSchedule(ELDER, proposal, { type: "modify", time: "10:30" }, at("08:05"));
    expect(modified).toMatchObject({ status: "accepted", time: "10:30", originalTime: "09:00" });
    expect(decideSchedule(ELDER, proposal, { type: "decline" }, at("08:05")).status).toBe("declined");
  });

  it("lets the elder pause and resume at any time", () => {
    const active = proposeSchedule(ELDER, "Evening", "20:00", at("08:00"));
    const paused = decideSchedule(ELDER, active, { type: "pause" }, at("09:00"));
    expect(paused.status).toBe("paused");
    expect(decideSchedule(ELDER, paused, { type: "resume" }, at("09:01")).status).toBe("accepted");
  });

  it("refuses decisions from anyone but the elder", () => {
    const proposal = proposeSchedule(family, "Morning check-in", "09:00", at("08:00"));
    expect(() => decideSchedule(family, proposal, { type: "accept" }, at("08:05"))).toThrow(PermissionError);
    expect(() => decideSchedule(member({ manageCare: true }, { role: "caregiver" }), proposal, { type: "accept" }, at("08:05"))).toThrow(PermissionError);
  });
});

describe("check-in slot state", () => {
  const slot = proposeSchedule(ELDER, "Morning", "09:00", at("07:00"));

  it("moves from upcoming to open to 'no response'", () => {
    expect(slotState(slot, TODAY, [], [], at("08:30"))).toBe("upcoming");
    expect(slotState(slot, TODAY, [], [], at("09:00"))).toBe("open");
    expect(slotState(slot, TODAY, [], [], at("11:00"))).toBe("noResponse");
  });

  it("is completed by a check-in or a saved conversation note for that slot today", () => {
    expect(slotState(slot, TODAY, [{ dateKey: TODAY, scheduleId: slot.id }], [], at("12:00"))).toBe("completed");
    expect(slotState(slot, TODAY, [], [{ dateKey: TODAY, scheduleId: slot.id }], at("12:00"))).toBe("completed");
  });

  it("is not completed by yesterday's record or another slot's record", () => {
    expect(slotState(slot, TODAY, [{ dateKey: "2026-06-09", scheduleId: slot.id }], [], at("12:00"))).toBe("noResponse");
    expect(slotState(slot, TODAY, [{ dateKey: TODAY, scheduleId: "other" }], [], at("09:30"))).toBe("open");
  });
});

describe("scheduleLabel", () => {
  it("shows built-in check-in names in the current language and leaves custom names alone", async () => {
    const { scheduleLabel } = await import("@/lib/domain/schedule");
    const { en } = await import("@/lib/i18n/en");
    const { hi } = await import("@/lib/i18n/hi");
    const tHi = (k: keyof typeof hi) => hi[k];
    expect(scheduleLabel(en["sched.morning"], tHi, [en, hi])).toBe(hi["sched.morning"]);
    expect(scheduleLabel("Tea with Meera", tHi, [en, hi])).toBe("Tea with Meera");
  });
});
