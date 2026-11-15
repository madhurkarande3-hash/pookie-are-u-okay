import type { Actor, CircleMember, ElderProfile, MemberPermissions } from "@/lib/types";
import { DemoRepository, DEMO_ELDER_ID, type KeyValueStore } from "@/lib/data/demoRepository";
import type { Repository } from "@/lib/data/repository";
import { NO_PERMISSIONS } from "@/lib/domain/permissions";

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

export const ELDER: Actor = { uid: DEMO_ELDER_ID, name: "Asha", role: "elder" };

export function member(permissions: Partial<MemberPermissions> = {}, overrides: Partial<Actor> = {}): Actor {
  return { uid: "priya@example.com", name: "Priya", role: "family", status: "active", permissions: { ...NO_PERMISSIONS, ...permissions }, ...overrides };
}

export function elderProfile(consent: Partial<ElderProfile["consent"]> = {}): ElderProfile {
  return {
    id: DEMO_ELDER_ID,
    fullName: "Asha Rao",
    preferredName: "Asha",
    pookie: "sweet",
    language: "en",
    onboarded: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    consent: { aiPersonalization: false, saveSummaries: false, reminders: false, sharingPaused: false, updatedAt: "2026-01-01T00:00:00.000Z", ...consent },
  };
}

/** A demo repository whose current actor can be swapped mid-test. */
export function makeRepo(initial: Actor | null = ELDER) {
  const state = { actor: initial };
  const demo = new DemoRepository(new MemoryStore(), () => state.actor);
  // `repo` is typed as the shared interface so tests exercise the same contract as the UI.
  const repo: Repository = demo;
  return { repo, demo, as: (actor: Actor | null) => (state.actor = actor), elderId: DEMO_ELDER_ID };
}

export function asActor(m: CircleMember): Actor {
  return { uid: m.id, name: m.name, role: m.role, status: m.status, permissions: m.permissions };
}

/** Local time today at HH:mm. */
export function at(time: string): Date {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return new Date(2026, 5, 10, h, m, 0);
}
export const TODAY = "2026-06-10";
