/**
 * Who in the Care Circle gets told that the elder shared something.
 * Pure and dependency-free: used by the Cloud Function (authoritative) and by
 * Demo Mode, so both follow the same rules.
 *
 * A notice is deliberately content-free: it says *that* a check-in or a
 * conversation note was shared and on which day — never the mood, the note
 * or anything said. The member opens the app to read it, where
 * firestore.rules decide again whether they still may.
 */

export type NoticeKind = "summary" | "checkin" | "help";
export type SharedKind = Exclude<NoticeKind, "help">;

export interface NoticeMember {
  id: string;
  status: string;
  permissions?: object;
}

export interface CircleNotice {
  id: string;
  elderId: string;
  elderName: string;
  kind: NoticeKind;
  /** The day the shared record belongs to, "YYYY-MM-DD". */
  dateKey: string;
  createdAt: string;
  read: boolean;
}

/** The permission a member needs before they are even told a record exists. */
export const NOTICE_PERMISSION: Record<NoticeKind, string> = {
  summary: "viewSummaries",
  checkin: "viewCheckins",
  help: "receiveHelp",
};

/** The field that marks a record as shared, per kind. */
export const SHARED_FIELD: Record<SharedKind, "shared" | "shareWithCircle"> = {
  summary: "shared",
  checkin: "shareWithCircle",
};

type Shareable = Partial<Record<"shared" | "shareWithCircle", unknown>> | null | undefined;

/** True only on the write that turns sharing on (create-as-shared, or unshared → shared). */
export function becameShared(kind: SharedKind, before: Shareable, after: Shareable): boolean {
  const field = SHARED_FIELD[kind];
  return after?.[field] === true && before?.[field] !== true;
}

/**
 * Whether this write should notify the circle. Shared records: when sharing
 * turns on. Help requests: only when the elder creates one (they pressed the button).
 */
export function shouldNotify(kind: NoticeKind, before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined): boolean {
  if (kind === "help") return !before && after?.status === "open";
  return becameShared(kind, before as Shareable, after as Shareable);
}

/** Active members holding the matching permission; nobody while sharing is paused. */
export function noticeRecipients(kind: NoticeKind, members: readonly NoticeMember[], sharingPaused: boolean): string[] {
  if (sharingPaused) return [];
  const permission = NOTICE_PERMISSION[kind];
  return members.filter((m) => m.status === "active" && (m.permissions as Record<string, unknown> | undefined)?.[permission] === true).map((m) => m.id);
}

/** Stable id, so a retried function or a re-share never produces duplicates. */
export function noticeId(elderId: string, kind: NoticeKind, recordId: string): string {
  return `${elderId}_${kind}_${recordId}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 300);
}

export function buildNotice(input: { elderId: string; elderName: string; kind: NoticeKind; recordId: string; dateKey: string; now: Date }): CircleNotice {
  return {
    id: noticeId(input.elderId, input.kind, input.recordId),
    elderId: input.elderId,
    elderName: input.elderName.slice(0, 80),
    kind: input.kind,
    dateKey: /^\d{4}-\d{2}-\d{2}$/.test(input.dateKey) ? input.dateKey : input.now.toISOString().slice(0, 10),
    createdAt: input.now.toISOString(),
    read: false,
  };
}
