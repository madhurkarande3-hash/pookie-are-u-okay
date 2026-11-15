import type { Actor, MemberPermissions, MemberRole, PermissionKey } from "@/lib/types";

/**
 * Single access-control policy for the client. firestore.rules enforces the
 * same table on the backend; this copy drives the UI and the Demo repository.
 */
export type Action =
  | "elder:read"
  | "elder:write"
  | "circle:manage"
  | "medications:read"
  | "medications:write"
  | "doses:confirm"
  | "appointments:read"
  | "appointments:write"
  | "checkins:read"
  | "checkins:readShared"
  | "checkins:write"
  | "lifebook:read"
  | "lifebook:write"
  | "lifebook:contribute"
  | "schedules:read"
  | "schedules:propose"
  | "schedules:decide"
  | "summaries:read"
  | "summaries:readShared"
  | "summaries:write"
  | "help:request"
  | "help:read"
  | "help:acknowledge"
  | "medical:read"
  | "medical:write";

/** Which grants unlock an action for a Care Circle member. Absent = elder only. */
const MEMBER_GRANTS: Partial<Record<Action, readonly PermissionKey[] | "anyActiveMember">> = {
  "elder:read": "anyActiveMember",
  "schedules:read": "anyActiveMember",
  "medications:read": ["viewMedications", "manageCare"],
  "medications:write": ["manageCare"],
  "appointments:read": ["viewAppointments", "manageCare"],
  "appointments:write": ["manageCare"],
  "checkins:readShared": ["viewCheckins"],
  "summaries:readShared": ["viewSummaries"],
  "lifebook:read": ["viewLifebook"],
  "lifebook:contribute": ["contributeLifebook"],
  "schedules:propose": ["proposeSchedule"],
  "help:read": ["receiveHelp"],
  "medical:read": ["viewMedications", "manageCare"],
  "medical:write": ["manageCare"],
  "help:acknowledge": ["receiveHelp"],
};

export interface AccessContext {
  /** The elder's master "pause all sharing" switch. */
  sharingPaused: boolean;
}

export function can(actor: Actor | null, action: Action, ctx: AccessContext): boolean {
  if (!actor) return false;
  if (actor.role === "elder") return true;
  if (actor.status !== "active" || ctx.sharingPaused || !actor.permissions) return false;
  const grant = MEMBER_GRANTS[action];
  if (!grant) return false;
  if (grant === "anyActiveMember") return true;
  const permissions = actor.permissions;
  return grant.some((key) => permissions[key] === true);
}

export const NO_PERMISSIONS: MemberPermissions = {
  viewMedications: false,
  viewAppointments: false,
  viewCheckins: false,
  viewSummaries: false,
  viewLifebook: false,
  contributeLifebook: false,
  proposeSchedule: false,
  manageCare: false,
  receiveHelp: false,
};

/** Starting point shown to the elder when inviting; nothing applies until they confirm. */
export function suggestedPermissions(role: MemberRole): MemberPermissions {
  return role === "caregiver"
    ? { ...NO_PERMISSIONS, viewMedications: true, viewAppointments: true, manageCare: true, receiveHelp: true }
    : { ...NO_PERMISSIONS, viewMedications: true, viewAppointments: true, proposeSchedule: true, receiveHelp: true };
}

export const PERMISSION_KEYS = Object.keys(NO_PERMISSIONS) as PermissionKey[];
