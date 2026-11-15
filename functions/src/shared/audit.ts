/**
 * Audit entries: who changed what kind of record, which fields, and when.
 * Field NAMES only (e.g. "permissions.manageCare", "consent.sharingPaused"),
 * never their values, so the log itself holds no health details.
 */

export type AuditAction = "create" | "update" | "delete";

export interface AuditEntry {
  at: string;
  collection: string;
  docId: string;
  action: AuditAction;
  changedFields: string[];
  byUid: string | null;
  byType: string;
}

type Data = Record<string, unknown> | null | undefined;

/** Field names (one level deep for maps) whose values differ. */
export function changedFields(before: Data, after: Data): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: string[] = [];
  for (const key of [...keys].sort()) {
    if (key === "updatedAt") continue;
    const a = before?.[key];
    const b = after?.[key];
    const isMap = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
    if (isMap(a) || isMap(b)) {
      const inner = new Set([...Object.keys((a as Record<string, unknown>) ?? {}), ...Object.keys((b as Record<string, unknown>) ?? {})]);
      for (const k of [...inner].sort()) {
        if (k === "updatedAt") continue;
        if (JSON.stringify((a as Record<string, unknown> | undefined)?.[k]) !== JSON.stringify((b as Record<string, unknown> | undefined)?.[k])) out.push(`${key}.${k}`);
      }
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push(key);
    }
  }
  return out;
}

export function auditEntry(input: { before: Data; after: Data; collection: string; docId: string; byUid: string | null | undefined; byType: string | undefined; at: Date }): AuditEntry | null {
  const action: AuditAction = !input.before ? "create" : !input.after ? "delete" : "update";
  const fields = changedFields(input.before, input.after);
  if (action === "update" && fields.length === 0) return null;
  return {
    at: input.at.toISOString(),
    collection: input.collection,
    docId: input.docId.slice(0, 200),
    action,
    changedFields: fields.slice(0, 50),
    byUid: input.byUid ?? null,
    byType: input.byType ?? "unknown",
  };
}
