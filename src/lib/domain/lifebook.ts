import type { LifebookEntry, LifebookRevision } from "@/lib/types";

/** Keeps the previous wording whenever a memory's title or details are corrected. */
export function withRevision(previous: LifebookEntry | null, next: LifebookEntry, byName: string, now: Date): LifebookEntry {
  if (!previous || (previous.title === next.title && previous.detail === next.detail)) return next;
  const revision: LifebookRevision = { at: now.toISOString(), byName: byName.slice(0, 80), title: previous.title, detail: previous.detail };
  return { ...next, history: [revision, ...(previous.history ?? [])].slice(0, 10), updatedAt: now.toISOString() };
}

const fold = (s: string) => s.toLocaleLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");

/** Case- and accent-insensitive search over titles, details, relationships and dates. */
export function searchEntries(entries: readonly LifebookEntry[], query: string): LifebookEntry[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...entries];
  return entries.filter((e) => {
    const haystack = fold([e.title, e.detail, e.relationship ?? "", e.when ?? ""].join(" "));
    return terms.every((term) => haystack.includes(term));
  });
}

export const MAX_PHOTO_EDGE = 1280;
export const MAX_AUDIO_SECONDS = 120;
/** Demo Mode keeps media inside this browser's storage, so it must stay small. */
export const DEMO_MAX_MEDIA_BYTES = 1_500_000;
export const MAX_MEDIA_BYTES = 5_000_000;
