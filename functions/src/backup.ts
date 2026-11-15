/**
 * Nightly Firestore export to Cloud Storage, so data can be restored after a
 * mistake. Off until BACKUP_BUCKET is set (e.g. "gs://my-project-pookie-backups").
 * The function's service account needs the "Cloud Datastore Import Export
 * Admin" role and write access to the bucket. Restore: see README.
 */
import { v1 } from "@google-cloud/firestore";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

const BACKUP_BUCKET = defineString("BACKUP_BUCKET", { default: "" });

export const nightlyBackup = onSchedule({ schedule: "every day 02:30", timeZone: "Asia/Kolkata", region: "asia-south1", timeoutSeconds: 120 }, async () => {
  const bucket = BACKUP_BUCKET.value();
  if (!bucket.startsWith("gs://")) {
    logger.info("backup skipped: BACKUP_BUCKET not set");
    return;
  }
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
  if (!projectId) throw new Error("No project id");
  const client = new v1.FirestoreAdminClient();
  const [operation] = await client.exportDocuments({
    name: client.databasePath(projectId, "(default)"),
    outputUriPrefix: `${bucket}/${new Date().toISOString().slice(0, 10)}`,
    collectionIds: [],
  });
  logger.info("backup started", { operation: operation.name });
});
