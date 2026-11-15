import { describe, expect, it } from "vitest";
import { doseLogId } from "@/lib/domain/medication";
import { proposeSchedule } from "@/lib/domain/schedule";
import { suggestedPermissions } from "@/lib/domain/permissions";
import { PermissionError, ValidationError, type Checkin, type LifebookEntry, type Medication } from "@/lib/types";
import { ELDER, TODAY, asActor, at, elderProfile, makeRepo, member } from "./helpers";

const medication: Medication = { id: "m1", name: "Metformin", dose: "500 mg", times: ["08:00"], notes: "", active: true, createdAt: "" };
const checkin = (id: string, shareWithCircle: boolean): Checkin => ({ id, dateKey: TODAY, createdAt: `2026-06-10T0${id}:00:00.000Z`, mood: 4, sleep: 3, energy: 3, assistance: "none", note: "", shareWithCircle, scheduleId: null });
const memory = (id: string, overrides: Partial<LifebookEntry> = {}): LifebookEntry => ({
  id,
  category: "people",
  title: "Meera",
  detail: "My daughter",
  source: { type: "self", byUid: ELDER.uid, byName: "Asha" },
  confirmed: true,
  aiAllowed: true,
  createdAt: "2026-06-10T00:00:00.000Z",
  updatedAt: "2026-06-10T00:00:00.000Z",
  ...overrides,
});

async function seeded() {
  const ctx = makeRepo();
  await ctx.repo.saveElder(elderProfile({ saveSummaries: true }));
  await ctx.repo.saveMedication(ctx.elderId, medication);
  await ctx.repo.saveCheckin(ctx.elderId, checkin("1", false));
  await ctx.repo.saveCheckin(ctx.elderId, checkin("2", true));
  await ctx.repo.saveLifebookEntry(ctx.elderId, memory("l1"));
  return ctx;
}

describe("Care Circle invitation and access", () => {
  it("gives an invited person no access until they are active", async () => {
    const ctx = await seeded();
    const invited = await ctx.repo.inviteMember(ctx.elderId, { name: "Priya", email: " Priya@Example.com ", role: "family", permissions: suggestedPermissions("family") });
    expect(invited).toMatchObject({ status: "invited", email: "priya@example.com" });

    ctx.as(asActor(invited));
    await expect(ctx.repo.listMedications(ctx.elderId)).rejects.toBeInstanceOf(PermissionError);

    ctx.as(ELDER);
    ctx.demo.simulateAcceptance(invited.id);
    ctx.as(asActor(ctx.demo.peekMember(invited.id)!));
    await expect(ctx.repo.listMedications(ctx.elderId)).resolves.toHaveLength(1);
  });

  it("rejects an invalid email address", async () => {
    const ctx = await seeded();
    await expect(ctx.repo.inviteMember(ctx.elderId, { name: "X", email: "not-an-email", role: "family", permissions: suggestedPermissions("family") })).rejects.toBeInstanceOf(ValidationError);
  });

  it("stops access immediately when the elder pauses, revokes or pauses all sharing", async () => {
    const ctx = await seeded();
    const viewer = member({ viewMedications: true });

    ctx.as(viewer);
    await expect(ctx.repo.listMedications(ctx.elderId)).resolves.toHaveLength(1);

    ctx.as({ ...viewer, status: "paused" });
    await expect(ctx.repo.listMedications(ctx.elderId)).rejects.toBeInstanceOf(PermissionError);

    ctx.as(ELDER);
    await ctx.repo.saveElder(elderProfile({ sharingPaused: true }));
    ctx.as(viewer);
    await expect(ctx.repo.listMedications(ctx.elderId)).rejects.toBeInstanceOf(PermissionError);
    await expect(ctx.repo.getElder(ctx.elderId)).rejects.toBeInstanceOf(PermissionError);
  });

  it("does not let members manage the circle or change consent", async () => {
    const ctx = await seeded();
    ctx.as(member({ manageCare: true, viewMedications: true }, { role: "caregiver" }));
    await expect(ctx.repo.inviteMember(ctx.elderId, { name: "Z", email: "z@example.com", role: "family", permissions: suggestedPermissions("family") })).rejects.toBeInstanceOf(PermissionError);
    await expect(ctx.repo.saveElder(elderProfile({ sharingPaused: false }))).rejects.toBeInstanceOf(PermissionError);
    await expect(ctx.repo.deleteAll(ctx.elderId)).rejects.toBeInstanceOf(PermissionError);
  });
});

describe("health data access", () => {
  it("lets only the elder confirm a dose, even for a caregiver who manages medicines", async () => {
    const ctx = await seeded();
    const log = { id: doseLogId(TODAY, "m1", "08:00"), medicationId: "m1", dateKey: TODAY, time: "08:00", status: "taken" as const, confirmedAt: "" };
    ctx.as(member({ manageCare: true }, { role: "caregiver" }));
    await expect(ctx.repo.saveMedication(ctx.elderId, { ...medication, dose: "250 mg" })).resolves.toBeUndefined();
    await expect(ctx.repo.saveDoseLog(ctx.elderId, log)).rejects.toBeInstanceOf(PermissionError);
    ctx.as(ELDER);
    await ctx.repo.saveDoseLog(ctx.elderId, log);
    await expect(ctx.repo.listDoseLogs(ctx.elderId, TODAY)).resolves.toHaveLength(1);
  });

  it("shows members only the check-ins the elder chose to share", async () => {
    const ctx = await seeded();
    ctx.as(member({ viewCheckins: true }));
    const visible = await ctx.repo.listCheckins(ctx.elderId);
    expect(visible.map((c) => c.id)).toEqual(["2"]);
    ctx.as(member({ viewMedications: true }));
    await expect(ctx.repo.listCheckins(ctx.elderId)).rejects.toBeInstanceOf(PermissionError);
  });

  it("validates medicine input", async () => {
    const ctx = await seeded();
    await expect(ctx.repo.saveMedication(ctx.elderId, { ...medication, name: "   " })).rejects.toBeInstanceOf(ValidationError);
    await expect(ctx.repo.saveMedication(ctx.elderId, { ...medication, times: ["25:00"] })).rejects.toBeInstanceOf(ValidationError);
    await expect(ctx.repo.saveMedication(ctx.elderId, { ...medication, times: [] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("saves a conversation note only with consent, and shares it only if marked shared", async () => {
    const ctx = await seeded();
    const note = { id: "s1", dateKey: TODAY, createdAt: "2026-06-10T10:00:00.000Z", feeling: "good" as const, note: "Nice chat", exchanges: 3, shared: false, scheduleId: null };
    await ctx.repo.saveSummary(ctx.elderId, note);
    ctx.as(member({ viewSummaries: true }));
    await expect(ctx.repo.listSummaries(ctx.elderId)).resolves.toEqual([]);

    ctx.as(ELDER);
    await ctx.repo.saveElder(elderProfile({ saveSummaries: false }));
    await expect(ctx.repo.saveSummary(ctx.elderId, { ...note, id: "s2" })).rejects.toBeInstanceOf(PermissionError);
  });
});

describe("LifeBook contributions", () => {
  it("stores a family contribution as unconfirmed and attributed, whatever the client sends", async () => {
    const ctx = await seeded();
    const contributor = member({ contributeLifebook: true });
    ctx.as(contributor);
    await ctx.repo.saveLifebookEntry(ctx.elderId, memory("l2", { title: "Wedding", confirmed: true, source: { type: "self", byUid: ELDER.uid, byName: "Asha" } }));

    ctx.as(ELDER);
    const stored = (await ctx.repo.listLifebook(ctx.elderId)).find((e) => e.id === "l2");
    expect(stored).toMatchObject({ confirmed: false, source: { type: "circle", byUid: contributor.uid, byName: "Priya" } });
  });

  it("does not let a contributor overwrite, confirm, delete or read other entries", async () => {
    const ctx = await seeded();
    ctx.as(member({ contributeLifebook: true }));
    await expect(ctx.repo.saveLifebookEntry(ctx.elderId, memory("l1", { detail: "changed" }))).rejects.toBeInstanceOf(PermissionError);
    await expect(ctx.repo.deleteLifebookEntry(ctx.elderId, "l1")).rejects.toBeInstanceOf(PermissionError);
    await expect(ctx.repo.listLifebook(ctx.elderId)).resolves.toEqual([]);
  });

  it("lets the elder confirm, correct and delete", async () => {
    const ctx = await seeded();
    ctx.as(member({ contributeLifebook: true }));
    await ctx.repo.saveLifebookEntry(ctx.elderId, memory("l2", { title: "Wedding" }));
    ctx.as(ELDER);
    const pending = (await ctx.repo.listLifebook(ctx.elderId)).find((e) => e.id === "l2")!;
    await ctx.repo.saveLifebookEntry(ctx.elderId, { ...pending, detail: "Corrected", confirmed: true });
    expect((await ctx.repo.listLifebook(ctx.elderId)).find((e) => e.id === "l2")).toMatchObject({ confirmed: true, detail: "Corrected" });
    await ctx.repo.deleteLifebookEntry(ctx.elderId, "l2");
    expect(await ctx.repo.listLifebook(ctx.elderId)).toHaveLength(1);
  });
});

describe("schedule proposals in storage", () => {
  it("accepts a member's proposal only as 'proposed' and only the elder can activate it", async () => {
    const ctx = await seeded();
    const proposer = member({ proposeSchedule: true });
    ctx.as(proposer);
    const proposal = proposeSchedule(proposer, "Morning", "09:00", at("08:00"));
    await ctx.repo.saveSchedule(ctx.elderId, proposal);
    await expect(ctx.repo.saveSchedule(ctx.elderId, { ...proposal, status: "accepted" })).rejects.toBeInstanceOf(PermissionError);
    await expect(ctx.repo.saveSchedule(ctx.elderId, { ...proposeSchedule(proposer, "Sneaky", "10:00", at("08:00")), status: "accepted" })).rejects.toBeInstanceOf(PermissionError);

    ctx.as(ELDER);
    await ctx.repo.saveSchedule(ctx.elderId, { ...proposal, status: "accepted" });
    expect((await ctx.repo.listSchedules(ctx.elderId))[0]?.status).toBe("accepted");
  });
});

describe("the elder's data rights", () => {
  it("exports everything and deletes everything", async () => {
    const ctx = await seeded();
    const bundle = await ctx.repo.exportAll(ctx.elderId);
    expect(bundle.medications).toHaveLength(1);
    expect(bundle.checkins).toHaveLength(2);
    await ctx.repo.deleteAll(ctx.elderId);
    expect(await ctx.repo.getElder(ctx.elderId)).toBeNull();
    expect(await ctx.repo.listMedications(ctx.elderId)).toEqual([]);
  });
});
