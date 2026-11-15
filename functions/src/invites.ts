/**
 * Invitation email, sent through the Firebase "Trigger Email" extension when
 * EMAIL_ENABLED is "true". Says who invited them and where to sign in — no
 * health information. Without the extension, invitees sign in with the
 * invited email and find the invitation waiting.
 */
import { getFirestore } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

const EMAIL_ENABLED = defineString("EMAIL_ENABLED", { default: "false" });
const APP_URL = defineString("APP_URL", { default: "" });

export const emailInvitation = onDocumentCreated({ document: "elders/{elderId}/invites/{email}", region: "asia-south1" }, async (event) => {
  if (EMAIL_ENABLED.value() !== "true") return;
  const invite = event.data?.data();
  if (!invite || typeof invite.email !== "string") return;
  const who = typeof invite.elderName === "string" && invite.elderName ? invite.elderName : "Someone";
  const link = APP_URL.value() || "the Pookie app";
  try {
    await getFirestore()
      .doc(`mail/invite_${event.params.elderId}_${event.params.email}`.replace(/[^\w/-]/g, "_"))
      .create({
        to: invite.email,
        message: {
          subject: `${who} invited you to their Pookie Care Circle`,
          text: `${who} would like you in their Pookie Care Circle. Sign in at ${link} with this email address (${invite.email}) to accept or decline. You will only see what ${who} chooses to share.`,
        },
      });
  } catch (err) {
    logger.warn("invitation email not queued", { message: err instanceof Error ? err.message : "unknown" });
  }
});
