import { describe, expect, it } from "vitest";
import { buildSystemInstruction, selectFacts } from "@shared/companionContext";
import { findConflicts } from "@shared/memoryConflicts";
import { demoReply } from "@/lib/ai/demoCompanion";
import { searchEntries, withRevision } from "@/lib/domain/lifebook";
import { sanitizeLifebookEntry } from "@/lib/data/sanitize";
import { NO_PERMISSIONS } from "@/lib/domain/permissions";
import { ValidationError, type LifebookEntry } from "@/lib/types";
import { ELDER, asActor, elderProfile, makeRepo } from "./helpers";

const entry = (id: string, overrides: Partial<LifebookEntry> = {}): LifebookEntry => ({
  id,
  category: "people",
  title: "Meera",
  detail: "Lives in Pune",
  source: { type: "self", byUid: ELDER.uid, byName: "Asha" },
  confirmed: true,
  aiAllowed: true,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

describe("conflicting memories", () => {
  it("finds two different relationships or dates for the same name", () => {
    const conflicts = findConflicts([
      entry("a", { relationship: "daughter" }),
      entry("b", { relationship: "Niece" }),
      entry("c", { title: "Wedding", category: "milestones", when: "1975" }),
      entry("d", { title: "wedding", category: "milestones", when: "1976" }),
      entry("e", { title: "Ravi", relationship: "son" }),
    ]);
    expect(conflicts.map((c) => c.field)).toEqual(["relationship", "when"]);
  });

  it("does not treat the same relationship written differently as a conflict", () => {
    expect(findConflicts([entry("a", { relationship: "Daughter" }), entry("b", { relationship: " daughter " })])).toEqual([]);
  });

  it("tells the AI both notes are uncertain and to ask, and the demo asks too", () => {
    const entries = [entry("a", { relationship: "daughter" }), entry("b", { relationship: "niece" })];
    const prompt = buildSystemInstruction({ preferredName: "Asha", language: "en", aiPersonalization: true, entries });
    expect(prompt.match(/UNCERTAIN/g)).toHaveLength(2);
    const facts = selectFacts({ aiPersonalization: true, entries });
    expect(demoReply({ text: "Tell me about Meera", facts, language: "en", preferredName: "Asha", turn: 0 })).toMatch(/two different notes.*won't guess/);
  });
});

describe("corrections and search", () => {
  it("keeps the earlier wording when a memory is corrected", () => {
    const before = entry("a", { detail: "Lives in Mumbai" });
    const after = withRevision(before, { ...before, detail: "Lives in Pune" }, "Asha", new Date("2026-06-10T09:00:00Z"));
    expect(after.history?.[0]).toMatchObject({ detail: "Lives in Mumbai", byName: "Asha" });
    expect(withRevision(before, { ...before, aiAllowed: false }, "Asha", new Date()).history).toBeUndefined();
  });

  it("searches titles, details and relationships, ignoring case", () => {
    const list = [entry("a", { relationship: "daughter" }), entry("b", { title: "Ravi", detail: "Plays cricket" })];
    expect(searchEntries(list, "DAUGHTER").map((e) => e.id)).toEqual(["a"]);
    expect(searchEntries(list, "cricket ravi").map((e) => e.id)).toEqual(["b"]);
  });
});

describe("sharing and media", () => {
  it("shows viewers only the memories the elder shared, plus their own suggestions", async () => {
    const ctx = makeRepo();
    await ctx.repo.saveElder(elderProfile());
    await ctx.repo.saveLifebookEntry(ctx.elderId, entry("shared", { shareWithCircle: true }));
    await ctx.repo.saveLifebookEntry(ctx.elderId, entry("private", { shareWithCircle: false }));
    const invited = await ctx.repo.inviteMember(ctx.elderId, { name: "Priya", email: "priya@example.com", role: "family", permissions: { ...NO_PERMISSIONS, viewLifebook: true, contributeLifebook: true } });
    ctx.demo.simulateAcceptance(invited.id);
    const priya = asActor(ctx.demo.peekMember(invited.id)!);
    ctx.as(priya);
    await ctx.repo.saveLifebookEntry(ctx.elderId, entry("suggested", { confirmed: false, shareWithCircle: false, source: { type: "circle", byUid: priya.uid, byName: "Priya" } }));
    expect((await ctx.repo.listLifebook(ctx.elderId)).map((e) => e.id).sort()).toEqual(["shared", "suggested"]);
  });

  it("lets a photo memory have no caption but rejects unknown file types", () => {
    const photo = entry("p", { category: "photos", detail: "", media: { kind: "photo", contentType: "image/jpeg", dataUrl: "data:image/jpeg;base64,AA" } });
    expect(sanitizeLifebookEntry(photo).detail).toBe("");
    expect(() => sanitizeLifebookEntry({ ...photo, media: { kind: "photo", contentType: "application/pdf" } })).toThrow(ValidationError);
    expect(() => sanitizeLifebookEntry(entry("x", { detail: "" }))).toThrow(ValidationError);
  });
});
