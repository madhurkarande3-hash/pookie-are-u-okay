/**
 * Finds LifeBook notes that disagree, e.g. "Meera — daughter" and
 * "Meera — niece", or two different dates for the same birthday. Pookie
 * never picks one: the elder is asked, and the AI treats both as uncertain.
 */

export interface ConflictEntry {
  id: string;
  category: string;
  title: string;
  /** For people: the relationship ("daughter"). For milestones: when it happens. */
  relationship?: string;
  when?: string;
  confirmed: boolean;
}

export interface MemoryConflict {
  ids: [string, string];
  title: string;
  field: "relationship" | "when";
}

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function findConflicts(entries: readonly ConflictEntry[]): MemoryConflict[] {
  const out: MemoryConflict[] = [];
  const groups = new Map<string, ConflictEntry[]>();
  for (const e of entries) {
    if (e.category !== "people" && e.category !== "milestones") continue;
    const key = `${e.category}:${norm(e.title)}`;
    if (!norm(e.title)) continue;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group.at(i);
        const b = group.at(j);
        if (!a || !b) continue;
        const field = a.category === "people" ? "relationship" : "when";
        const va = norm(a[field]);
        const vb = norm(b[field]);
        if (va && vb && va !== vb) out.push({ ids: [a.id, b.id], title: a.title.trim(), field });
      }
    }
  }
  return out;
}

/** Ids of entries involved in any conflict. */
export function conflictedIds(entries: readonly ConflictEntry[]): Set<string> {
  return new Set(findConflicts(entries).flatMap((c) => c.ids));
}
