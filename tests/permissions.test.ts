import { describe, expect, it } from "vitest";
import { can, suggestedPermissions, NO_PERMISSIONS, type Action } from "@/lib/domain/permissions";
import { ELDER, member } from "./helpers";

const OPEN = { sharingPaused: false };
const ELDER_ONLY: Action[] = ["elder:write", "circle:manage", "doses:confirm", "checkins:read", "checkins:write", "lifebook:write", "schedules:decide", "summaries:read", "summaries:write"];

describe("access policy", () => {
  it("lets the elder do everything", () => {
    for (const action of [...ELDER_ONLY, "medications:read", "lifebook:contribute"] as Action[]) {
      expect(can(ELDER, action, OPEN)).toBe(true);
    }
  });

  it("denies everyone when there is no signed-in actor", () => {
    expect(can(null, "medications:read", OPEN)).toBe(false);
  });

  it("gives a member with no grants nothing but the elder's name and the schedule", () => {
    const m = member();
    expect(can(m, "elder:read", OPEN)).toBe(true);
    expect(can(m, "schedules:read", OPEN)).toBe(true);
    for (const action of ["medications:read", "appointments:read", "checkins:readShared", "summaries:readShared", "lifebook:read", "lifebook:contribute", "schedules:propose"] as Action[]) {
      expect(can(m, action, OPEN)).toBe(false);
    }
  });

  it("never lets a member perform elder-only actions, whatever they were granted", () => {
    const everything = member({ viewMedications: true, viewAppointments: true, viewCheckins: true, viewSummaries: true, viewLifebook: true, contributeLifebook: true, proposeSchedule: true, manageCare: true, receiveHelp: true }, { role: "caregiver" });
    for (const action of ELDER_ONLY) expect(can(everything, action, OPEN)).toBe(false);
  });

  it("maps each grant to exactly its own actions", () => {
    expect(can(member({ viewMedications: true }), "medications:read", OPEN)).toBe(true);
    expect(can(member({ viewMedications: true }), "medications:write", OPEN)).toBe(false);
    expect(can(member({ viewMedications: true }), "appointments:read", OPEN)).toBe(false);
    expect(can(member({ manageCare: true }), "medications:write", OPEN)).toBe(true);
    expect(can(member({ manageCare: true }), "appointments:write", OPEN)).toBe(true);
    expect(can(member({ viewCheckins: true }), "checkins:readShared", OPEN)).toBe(true);
    expect(can(member({ viewLifebook: true }), "lifebook:contribute", OPEN)).toBe(false);
    expect(can(member({ proposeSchedule: true }), "schedules:propose", OPEN)).toBe(true);
  });

  it("blocks invited and paused members completely", () => {
    const grants = { viewMedications: true, manageCare: true };
    expect(can(member(grants, { status: "invited" }), "medications:read", OPEN)).toBe(false);
    expect(can(member(grants, { status: "paused" }), "medications:read", OPEN)).toBe(false);
    expect(can(member(grants, { status: "paused" }), "elder:read", OPEN)).toBe(false);
  });

  it("blocks every member while the elder has paused sharing, but not the elder", () => {
    const m = member({ viewMedications: true });
    expect(can(m, "medications:read", { sharingPaused: true })).toBe(false);
    expect(can(m, "elder:read", { sharingPaused: true })).toBe(false);
    expect(can(ELDER, "medications:read", { sharingPaused: true })).toBe(true);
  });

  it("never suggests sharing check-ins, notes or the LifeBook by default", () => {
    for (const role of ["family", "caregiver"] as const) {
      const p = suggestedPermissions(role);
      expect(p.viewCheckins).toBe(false);
      expect(p.viewSummaries).toBe(false);
      expect(p.viewLifebook).toBe(false);
    }
    expect(Object.values(NO_PERMISSIONS).every((v) => v === false)).toBe(true);
  });
});
