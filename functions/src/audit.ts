/**
 * Audit trail for the changes that matter most to an elder's autonomy and
 * safety: who can see what (members, invitations, consent), memories, and
 * medicines. Written by triggers with the caller's auth context; the elder
 * can read it, nobody can edit it.
 */
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWrittenWithAuthContext } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { auditEntry } from "./shared/audit";

const REGION = "asia-south1";

async function record(elderId: string, collection: string, docId: string, eventId: string, before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined, authId: string | undefined, authType: string | undefined) {
  const entry = auditEntry({ before, after, collection, docId, byUid: authId, byType: authType, at: new Date() });
  if (!entry) return;
  try {
    // The event id makes retries idempotent.
    await getFirestore().doc(`elders/${elderId}/auditLogs/${eventId}`).set(entry);
  } catch (err) {
    logger.error("audit write failed", { message: err instanceof Error ? err.message : "unknown" });
  }
}

export const auditElderProfile = onDocumentWrittenWithAuthContext({ document: "elders/{elderId}", region: REGION }, async (event) => {
  // A deleted account takes its audit log with it; nothing to record.
  if (!event.data?.after.exists) return;
  await record(event.params.elderId, "profile", event.params.elderId, event.id, event.data.before.data(), event.data.after.data(), event.authId, event.authType);
});

/** One trigger per audited collection, so reminder and audit writes never fire it. */
const auditOf = (collection: string) =>
  onDocumentWrittenWithAuthContext({ document: `elders/{elderId}/${collection}/{docId}`, region: REGION }, async (event) => {
    const params = event.params as { elderId: string; docId: string };
    await record(params.elderId, collection, params.docId, event.id, event.data?.before.data(), event.data?.after.data(), event.authId, event.authType);
  });

export const auditMembers = auditOf("members");
export const auditInvites = auditOf("invites");
export const auditLifebook = auditOf("lifebook");
export const auditMedications = auditOf("medications");
export const auditAppointments = auditOf("appointments");
export const auditSchedules = auditOf("schedules");
