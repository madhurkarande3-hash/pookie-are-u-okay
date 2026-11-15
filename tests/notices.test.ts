import { describe, expect, it } from "vitest";
import { becameShared, buildNotice, noticeId, noticeRecipients } from "@shared/circleNotices";
import { NO_PERMISSIONS } from "@/lib/domain/permissions";
import { PermissionError, type Checkin, type CareSummary } from "@/lib/types";
import { ELDER, TODAY, asActor, elderProfile, makeRepo } from "./helpers";

const members = [
  { id: "a", status: "active", permissions: { ...NO_PERMISSIONS, viewCheckins: true } },
  { id: "b", status: "active", permissions: { ...NO_PERMISSIONS, viewSummaries: true } },
  { id: "c", status: "paused", permissions: { ...NO_PERMISSIONS, viewCheckins: true, viewSummaries: true } },
  { id: "d", status: "invited", permissions: { ...NO_PERMISSIONS, viewCheckins: true } },
];

describe("who is notified when the elder shares", () => {
  it("notifies only on the write that turns sharing on", () => {
    expect(becameShared("checkin", null, { shareWithCircle: true })).toBe(true);
    expect(becameShared("checkin", { shareWithCircle: false }, { shareWithCircle: true })).toBe(true);
    expect(becameShared("checkin", { shareWithCircle: true }, { shareWithCircle: true })).toBe(false);
    expect(becameShared("checkin", null, { shareWithCircle: false })).toBe(false);
    expect(becameShared("summary", { shared: true }, null)).toBe(false);
  });

  it("picks active members holding the matching permission only", () => {
    expect(noticeRecipients("checkin", members, false)).toEqual(["a"]);
    expect(noticeRecipients("summary", members, false)).toEqual(["b"]);
  });

  it("notifies nobody while sharing is paused", () => {
    expect(noticeRecipients("checkin", members, true)).toEqual([]);
  });

  it("never copies the shared content into the notice", () => {
    const notice = buildNotice({ elderId: "e1", elderName: "Asha", kind: "checkin", recordId: "r1", dateKey: TODAY, now: new Date("2026-06-10T10:00:00Z") });
    expect(Object.keys(notice).sort()).toEqual(["createdAt", "dateKey", "elderId", "elderName", "id", "kind", "read"]);
    expect(notice.id).toBe(noticeId("e1", "checkin", "r1"));
  });
});

describe("Demo Mode notices follow the same rules", () => {
  const checkin = (id: string, shareWithCircle: boolean): Checkin => ({ id, dateKey: TODAY, createdAt: `2026-06-10T0${id}:00:00.000Z`, mood: 4, sleep: 3, energy: 3, assistance: "none", note: "private words", shareWithCircle, scheduleId: null });
  const summary = (id: string, shared: boolean): CareSummary => ({ id, dateKey: TODAY, createdAt: "2026-06-10T09:00:00.000Z", feeling: "good", note: "", exchanges: 3, shared, scheduleId: null });

  async function circle() {
    const ctx = makeRepo();
    await ctx.repo.saveElder(elderProfile({ saveSummaries: true }));
    const priya = await ctx.repo.inviteMember(ctx.elderId, { name: "Priya", email: "priya@example.com", role: "family", permissions: { ...NO_PERMISSIONS, viewCheckins: true } });
    ctx.demo.simulateAcceptance(priya.id);
    return { ...ctx, priya: asActor(ctx.demo.peekMember(priya.id)!) };
  }

  it("tells a permitted member once, without the private note", async () => {
    const ctx = await circle();
    await ctx.repo.saveCheckin(ctx.elderId, checkin("1", false));
    await ctx.repo.saveCheckin(ctx.elderId, checkin("1", true));
    await ctx.repo.saveCheckin(ctx.elderId, checkin("1", true));

    ctx.as(ctx.priya);
    const notices = await ctx.repo.listNotices(ctx.priya.uid);
    expect(notices).toHaveLength(1);
    expect(JSON.stringify(notices)).not.toContain("private words");

    await ctx.repo.markNoticeRead(ctx.priya.uid, notices[0]!.id);
    expect((await ctx.repo.listNotices(ctx.priya.uid))[0]?.read).toBe(true);
  });

  it("does not notify about kinds the member may not see, or while paused", async () => {
    const ctx = await circle();
    await ctx.repo.saveSummary(ctx.elderId, summary("s1", true));
    await ctx.repo.saveElder(elderProfile({ saveSummaries: true, sharingPaused: true }));
    await ctx.repo.saveCheckin(ctx.elderId, checkin("2", true));

    ctx.as(ctx.priya);
    expect(await ctx.repo.listNotices(ctx.priya.uid)).toHaveLength(0);
  });

  it("lets nobody read someone else's notices", async () => {
    const ctx = await circle();
    ctx.as(ELDER);
    await expect(ctx.repo.listNotices(ctx.priya.uid)).rejects.toBeInstanceOf(PermissionError);
  });
});
