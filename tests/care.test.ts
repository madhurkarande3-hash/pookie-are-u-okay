import { describe, expect, it } from "vitest";
import { cleanPhone } from "@/lib/domain/validation";
import { appliesOn, followUpSchedule, isExpired } from "@/lib/domain/schedule";
import { NO_PERMISSIONS } from "@/lib/domain/permissions";
import { PermissionError, ValidationError, type Appointment, type HelpRequest } from "@/lib/types";
import { ELDER, TODAY, asActor, at, elderProfile, makeRepo, member } from "./helpers";

const visit = (id: string, overrides: Partial<Appointment> = {}): Appointment => ({
  id,
  doctor: "Dr. Mehta",
  date: TODAY,
  time: "11:00",
  location: "",
  notes: "",
  remind: true,
  createdAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

describe("appointment visibility", () => {
  it("shows viewers only shared visits, while care managers see all", async () => {
    const ctx = makeRepo();
    await ctx.repo.saveElder(elderProfile());
    await ctx.repo.saveAppointment(ctx.elderId, visit("shared"));
    await ctx.repo.saveAppointment(ctx.elderId, visit("private", { shareWithCircle: false }));

    ctx.as(member({ viewAppointments: true }));
    expect((await ctx.repo.listAppointments(ctx.elderId)).map((a) => a.id)).toEqual(["shared"]);

    ctx.as(member({ manageCare: true }, { role: "caregiver" }));
    expect(await ctx.repo.listAppointments(ctx.elderId)).toHaveLength(2);
  });

  it("stores preparation, status and sharing with safe defaults", async () => {
    const ctx = makeRepo();
    await ctx.repo.saveElder(elderProfile());
    await ctx.repo.saveAppointment(ctx.elderId, visit("a", { prep: "  Fasting from 10 pm  " }));
    const [saved] = await ctx.repo.listAppointments(ctx.elderId);
    expect(saved).toMatchObject({ prep: "Fasting from 10 pm", status: "scheduled", shareWithCircle: true });
  });
});

describe("help requests", () => {
  const request = (id: string): HelpRequest => ({ id, createdAt: "2026-06-10T09:00:00.000Z", message: "Can someone call me?", status: "open", acknowledgedBy: null, acknowledgedAt: null });

  async function circleWithHelper(receiveHelp: boolean) {
    const ctx = makeRepo();
    await ctx.repo.saveElder(elderProfile());
    const invited = await ctx.repo.inviteMember(ctx.elderId, { name: "Priya", email: "priya@example.com", role: "family", permissions: { ...NO_PERMISSIONS, receiveHelp } });
    ctx.demo.simulateAcceptance(invited.id);
    return { ...ctx, priya: asActor(ctx.demo.peekMember(invited.id)!) };
  }

  it("reaches only members allowed to receive help, who can say they are on it", async () => {
    const ctx = await circleWithHelper(true);
    await ctx.repo.saveHelpRequest(ctx.elderId, request("h1"));

    ctx.as(ctx.priya);
    expect(await ctx.repo.listNotices(ctx.priya.uid)).toHaveLength(1);
    await ctx.repo.acknowledgeHelpRequest(ctx.elderId, "h1");

    ctx.as(ELDER);
    const [saved] = await ctx.repo.listHelpRequests(ctx.elderId);
    expect(saved).toMatchObject({ status: "acknowledged", acknowledgedBy: { name: "Priya" } });
  });

  it("is invisible to members without the permission, and only the elder can create one", async () => {
    const ctx = await circleWithHelper(false);
    await ctx.repo.saveHelpRequest(ctx.elderId, request("h1"));
    ctx.as(ctx.priya);
    await expect(ctx.repo.listHelpRequests(ctx.elderId)).rejects.toBeInstanceOf(PermissionError);
    await expect(ctx.repo.saveHelpRequest(ctx.elderId, request("h2"))).rejects.toBeInstanceOf(PermissionError);
    expect(await ctx.repo.listNotices(ctx.priya.uid)).toHaveLength(0);
  });

  it("is never re-notified when the elder later marks it resolved", async () => {
    const ctx = await circleWithHelper(true);
    await ctx.repo.saveHelpRequest(ctx.elderId, request("h1"));
    await ctx.repo.saveHelpRequest(ctx.elderId, { ...request("h1"), status: "resolved" });
    ctx.as(ctx.priya);
    expect(await ctx.repo.listNotices(ctx.priya.uid)).toHaveLength(1);
  });
});

describe("follow-up check-ins", () => {
  it("apply only on their own day and are created by the elder alone", () => {
    const followUp = followUpSchedule(ELDER, "Follow-up", "16:00", TODAY, at("14:00"));
    expect(followUp).toMatchObject({ status: "accepted", onDate: TODAY });
    expect(appliesOn(followUp, TODAY)).toBe(true);
    expect(appliesOn(followUp, "2026-06-11")).toBe(false);
    expect(isExpired(followUp, "2026-06-11")).toBe(true);
    expect(() => followUpSchedule(member({ proposeSchedule: true }), "x", "16:00", TODAY, at("14:00"))).toThrow(PermissionError);
  });
});

describe("Care Circle invitations", () => {
  it("can be declined, which grants nothing", async () => {
    const ctx = makeRepo();
    await ctx.repo.saveElder(elderProfile());
    const invited = await ctx.repo.inviteMember(ctx.elderId, { name: "Ravi", email: "ravi@example.com", role: "caregiver", permissions: { ...NO_PERMISSIONS, viewMedications: true } });
    ctx.demo.simulateDecline(invited.id);
    const declined = ctx.demo.peekMember(invited.id)!;
    expect(declined.status).toBe("declined");
    ctx.as(asActor(declined));
    await expect(ctx.repo.listMedications(ctx.elderId)).rejects.toBeInstanceOf(PermissionError);
  });
});

describe("phone numbers", () => {
  it("accepts common formats and rejects anything else", () => {
    expect(cleanPhone(" +91 98765-43210 ")).toBe("+91 98765-43210");
    expect(cleanPhone("")).toBe("");
    expect(() => cleanPhone("call me")).toThrow(ValidationError);
    expect(() => cleanPhone("12")).toThrow(ValidationError);
  });
});
