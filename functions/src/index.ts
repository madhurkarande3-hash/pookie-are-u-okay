import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { defineBoolean, defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten, type FirestoreEvent, type Change, type DocumentSnapshot } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { GoogleGenAI, Modality } from "@google/genai";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { LIVE_VOICE, MAX_SPEAK_CHARS, voiceFor } from "./shared/voices";
import { pushCircleUpdate } from "./reminders";
import { toPersona } from "./shared/persona";
import { consume, type RateState } from "./shared/rateLimit";
import { shouldNotify, buildNotice, noticeRecipients, type NoticeKind, type NoticeMember } from "./shared/circleNotices";
import { MAX_FACTS, buildSystemInstruction, sanitizeTurns, type CompanionEntry, type CompanionLanguage } from "./shared/companionContext";

initializeApp();

export { reminderSweep } from "./reminders";
export { auditAppointments, auditElderProfile, auditInvites, auditLifebook, auditMedications, auditMembers, auditSchedules } from "./audit";
export { nightlyBackup } from "./backup";
export { emailInvitation } from "./invites";

/** Set with: firebase functions:secrets:set GEMINI_API_KEY — never shipped to the browser. */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = defineString("GEMINI_MODEL", { default: "gemini-flash-latest" });
/** Gemini Live (native audio) model. Set to the current Live model name in functions/.env if this one is retired. */
const LIVE_MODEL = defineString("LIVE_MODEL", { default: "gemini-2.5-flash-native-audio-preview-09-2025" });
/** Set true once App Check (reCAPTCHA Enterprise) is configured for the web app. */
const ENFORCE_APP_CHECK = defineBoolean("ENFORCE_APP_CHECK", { default: false });

/** Per-person AI rate limit, stored server-side (rules deny all client access to rateLimits). */
async function takeAiQuota(uid: string, bucket: "chat" | "voice" | "live"): Promise<void> {
  const db = getFirestore();
  const ref = db.doc(`rateLimits/${uid}_${bucket}`);
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const result = consume(snap.data() as RateState | undefined, Date.now());
    tx.set(ref, result.state);
    return result.allowed;
  });
  if (!allowed) throw new HttpsError("resource-exhausted", "Let's take a short pause and talk again in a minute.");
}

interface CompanionRequest {
  messages?: unknown;
  language?: unknown;
}

interface CompanionResponse {
  text: string;
  personalised: boolean;
}

/**
 * One companion reply from Gemini.
 * - Only a signed-in elder can call it, and only about themselves (uid == elderId).
 * - Consent and LifeBook entries are read here on the server; the client cannot
 *   inject "facts" or bypass consent.
 * - Nothing from the conversation is stored or logged.
 */
export const companionReply = onCall<CompanionRequest, Promise<CompanionResponse>>(
  { region: "asia-south1", secrets: [GEMINI_API_KEY], memory: "256MiB", timeoutSeconds: 30, maxInstances: 5, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to talk with Pookie.");
    await takeAiQuota(uid, "chat");

    const turns = sanitizeTurns(request.data?.messages);
    if (!turns) throw new HttpsError("invalid-argument", "Invalid conversation.");
    const language: CompanionLanguage = request.data?.language === "hi" ? "hi" : "en";

    const db = getFirestore();
    const elderSnap = await db.doc(`elders/${uid}`).get();
    if (!elderSnap.exists) throw new HttpsError("permission-denied", "Only the elder can use the companion.");
    const elder = elderSnap.data() as { preferredName?: string; companion?: string; consent?: { aiPersonalization?: boolean } };
    const aiPersonalization = elder.consent?.aiPersonalization === true;

    let entries: CompanionEntry[] = [];
    if (aiPersonalization) {
      const snap = await db
        .collection(`elders/${uid}/lifebook`)
        .where("confirmed", "==", true)
        .where("aiAllowed", "==", true)
        .limit(MAX_FACTS)
        .get();
      entries = snap.docs.map((d) => ({ ...(d.data() as CompanionEntry), id: d.id }));
    }

    const systemInstruction = buildSystemInstruction({
      preferredName: elder.preferredName ?? "",
      language,
      aiPersonalization,
      entries,
      now: new Date().toLocaleString(language === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" }),
      // Read from the stored profile, not the request, so the client cannot swap personas mid-call.
      persona: toPersona(elder.companion),
    });

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
      const result = await ai.models.generateContent({
        model: GEMINI_MODEL.value(),
        contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        config: { systemInstruction, temperature: 0.6, maxOutputTokens: 1024 },
      });
      const text = result.text?.trim();
      if (!text) throw new Error("Empty model response");
      // Metadata only — never the words of the conversation.
      await db.collection(`elders/${uid}/conversationMetadata`).add({
        at: new Date().toISOString(),
        language,
        persona: toPersona(elder.companion),
        turns: turns.length,
        personalised: entries.length > 0,
        model: GEMINI_MODEL.value(),
      });
      return { text, personalised: entries.length > 0 };
    } catch (err) {
      // Log the failure only — never the user's words.
      logger.error("companionReply failed", { message: err instanceof Error ? err.message : "unknown" });
      throw new HttpsError("unavailable", "Pookie's AI is not available right now.");
    }
  },
);

/**
 * "Notify family according to consent": when the elder shares a check-in or a
 * conversation note, each active member holding the matching permission gets
 * a content-free notice in users/{uid}/notices. Nothing is sent while sharing
 * is paused, and the notice never contains the record itself.
 */
async function notifyCircle(kind: NoticeKind, elderId: string, recordId: string, change: Change<DocumentSnapshot> | undefined): Promise<void> {
  if (!change) return;
  const before = change.before.exists ? change.before.data() : null;
  const after = change.after.exists ? change.after.data() : null;
  if (!shouldNotify(kind, before, after)) return;

  const db = getFirestore();
  const elderSnap = await db.doc(`elders/${elderId}`).get();
  if (!elderSnap.exists) return;
  const elder = elderSnap.data() as { preferredName?: string; consent?: { sharingPaused?: boolean } };

  const membersSnap = await db.collection(`elders/${elderId}/members`).where("status", "==", "active").get();
  const members: NoticeMember[] = membersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NoticeMember, "id">) }));
  const recipients = noticeRecipients(kind, members, elder.consent?.sharingPaused === true);
  if (recipients.length === 0) return;

  const notice = buildNotice({
    elderId,
    elderName: elder.preferredName ?? "",
    kind,
    recordId,
    dateKey: typeof after?.dateKey === "string" ? after.dateKey : typeof after?.createdAt === "string" ? after.createdAt.slice(0, 10) : "",
    now: new Date(),
  });
  const batch = db.batch();
  for (const uid of recipients) batch.set(db.doc(`users/${uid}/notices/${notice.id}`), notice);
  await batch.commit();
  await pushCircleUpdate(recipients, new Date());
  logger.info("circle notified", { kind, recipients: recipients.length });
}

type WrittenEvent = FirestoreEvent<Change<DocumentSnapshot> | undefined, { elderId: string; id: string }>;

export const notifyOnSharedSummary = onDocumentWritten({ document: "elders/{elderId}/summaries/{id}", region: "asia-south1" }, (event: WrittenEvent) =>
  notifyCircle("summary", event.params.elderId, event.params.id, event.data),
);

export const notifyOnHelpRequest = onDocumentWritten({ document: "elders/{elderId}/helpRequests/{id}", region: "asia-south1" }, (event: WrittenEvent) =>
  notifyCircle("help", event.params.elderId, event.params.id, event.data),
);

export const notifyOnSharedCheckin = onDocumentWritten({ document: "elders/{elderId}/checkins/{id}", region: "asia-south1" }, (event: WrittenEvent) =>
  notifyCircle("checkin", event.params.elderId, event.params.id, event.data),
);

/**
 * "Delete my account": removes everything the caller owns, then the login.
 * - Elder: the whole elders/{uid} tree (every sub-collection), their files in
 *   Storage, their users/{uid} tree, and the Auth user.
 * - Care Circle member: their membership, their users/{uid} tree, the Auth user.
 *   The elder's own data is never touched by a member's deletion.
 */
export const deleteMyAccount = onCall({ region: "asia-south1", memory: "512MiB", timeoutSeconds: 300, maxInstances: 5 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const db = getFirestore();

  const elderRef = db.doc(`elders/${uid}`);
  if ((await elderRef.get()).exists) {
    await db.recursiveDelete(elderRef);
    try {
      await getStorage().bucket().deleteFiles({ prefix: `elders/${uid}/` });
    } catch (err) {
      // No bucket or no files yet is fine; anything else is logged without personal data.
      logger.warn("storage cleanup skipped", { message: err instanceof Error ? err.message : "unknown" });
    }
  } else {
    const user = await db.doc(`users/${uid}`).get();
    const elderId = user.get("elderId");
    if (typeof elderId === "string" && elderId) await db.doc(`elders/${elderId}/members/${uid}`).delete();
  }

  await db.recursiveDelete(db.doc(`users/${uid}`));
  await getAuth().deleteUser(uid);
  logger.info("account deleted");
  return { deleted: true };
});

/**
 * Speaks a companion reply in the companion's own voice (Cloud Text-to-Speech).
 * Elder only; rate limited; the text is not stored or logged.
 * If this fails, the app falls back to the device's built-in voice.
 */
let tts: TextToSpeechClient | null = null;
export const speak = onCall<{ text?: unknown; language?: unknown }, Promise<{ audio: string; mime: string }>>(
  { region: "asia-south1", memory: "256MiB", timeoutSeconds: 20, maxInstances: 5, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const text = typeof request.data?.text === "string" ? request.data.text.trim().slice(0, MAX_SPEAK_CHARS) : "";
    if (!text) throw new HttpsError("invalid-argument", "Nothing to say.");
    const elderSnap = await getFirestore().doc(`elders/${uid}`).get();
    if (!elderSnap.exists) throw new HttpsError("permission-denied", "Only the elder can use the companion.");
    await takeAiQuota(uid, "voice");
    const voice = voiceFor(toPersona(elderSnap.get("companion")), request.data?.language);
    try {
      tts ??= new TextToSpeechClient();
      const [response] = await tts.synthesizeSpeech({
        input: { text },
        voice: { languageCode: voice.languageCode, name: voice.name, ssmlGender: voice.ssmlGender },
        audioConfig: { audioEncoding: "MP3", speakingRate: voice.speakingRate, pitch: voice.pitch },
      });
      const audio = response.audioContent ? Buffer.from(response.audioContent as Uint8Array).toString("base64") : "";
      if (!audio) throw new Error("empty audio");
      return { audio, mime: "audio/mpeg" };
    } catch (err) {
      logger.error("speak failed", { message: err instanceof Error ? err.message : "unknown" });
      throw new HttpsError("unavailable", "Voice is not available right now.");
    }
  },
);

/**
 * Issues a single-use, short-lived Gemini Live token for real-time voice.
 * The model, voice and the whole system instruction (safety rules + only the
 * elder's confirmed, AI-allowed LifeBook facts) are locked into the token on
 * the server, so the browser can neither see the API key nor change the rules.
 */
export const liveToken = onCall<{ language?: unknown }, Promise<{ token: string; model: string }>>(
  { region: "asia-south1", secrets: [GEMINI_API_KEY], memory: "256MiB", timeoutSeconds: 20, maxInstances: 5, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to talk with Pookie.");
    const language: CompanionLanguage = request.data?.language === "hi" ? "hi" : "en";
    const db = getFirestore();
    const elderSnap = await db.doc(`elders/${uid}`).get();
    if (!elderSnap.exists) throw new HttpsError("permission-denied", "Only the elder can use the companion.");
    await takeAiQuota(uid, "live");
    const elder = elderSnap.data() as { preferredName?: string; companion?: string; consent?: { aiPersonalization?: boolean } };
    const aiPersonalization = elder.consent?.aiPersonalization === true;
    const entries = aiPersonalization
      ? (await db.collection(`elders/${uid}/lifebook`).where("confirmed", "==", true).where("aiAllowed", "==", true).limit(MAX_FACTS).get()).docs.map((d) => ({ ...(d.data() as CompanionEntry), id: d.id }))
      : [];
    const persona = toPersona(elder.companion);
    const now = new Date().toLocaleString(language === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" });
    const systemInstruction = buildSystemInstruction({ preferredName: elder.preferredName ?? "", language, aiPersonalization, entries, persona, now });
    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value(), httpOptions: { apiVersion: "v1alpha" } });
      const now = Date.now();
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime: new Date(now + 30 * 60_000).toISOString(),
          newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(),
          liveConnectConstraints: {
            model: LIVE_MODEL.value(),
            config: {
              responseModalities: [Modality.AUDIO],
              systemInstruction,
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: LIVE_VOICE[persona] } } },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          },
          httpOptions: { apiVersion: "v1alpha" },
        },
      });
      if (!token.name) throw new Error("no token");
      await db.collection(`elders/${uid}/conversationMetadata`).add({ at: new Date().toISOString(), language, persona, mode: "live", personalised: entries.length > 0, model: LIVE_MODEL.value() });
      return { token: token.name, model: LIVE_MODEL.value() };
    } catch (err) {
      logger.error("liveToken failed", { message: err instanceof Error ? err.message : "unknown" });
      throw new HttpsError("unavailable", "Real-time voice is not available right now.");
    }
  },
);

/**
 * Care-team dashboard: the elders this signed-in clinician is an *active*
 * Care Circle member of. Requires the `careTeam` custom claim (granted by
 * an admin with scripts/grant-care-team.mjs). Returns ids only; every record
 * is then read by the client under the normal per-patient security rules,
 * so a care team never sees more than each patient allowed.
 */
export const careTeamPatients = onCall({ region: "asia-south1", maxInstances: 5 }, async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Sign in first.");
  if (auth.token.careTeam !== true) throw new HttpsError("permission-denied", "This account is not on a care team.");
  const email = typeof auth.token.email === "string" ? auth.token.email.toLowerCase() : "";
  if (!email || auth.token.email_verified !== true) throw new HttpsError("failed-precondition", "Verify your email first.");
  const snap = await getFirestore().collectionGroup("members").where("email", "==", email).where("status", "==", "active").limit(200).get();
  const elderIds = snap.docs.filter((d) => d.id === auth.uid).map((d) => d.ref.parent.parent?.id).filter((id): id is string => Boolean(id));
  return { elderIds };
});
