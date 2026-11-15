/**
 * Creates FICTIONAL demo accounts and data in a Firebase project or the emulators.
 * Never use real people's information here.
 *
 *   cd functions
 *   DEMO_PASSWORD='choose-a-strong-one' GCLOUD_PROJECT=<project-id> node scripts/seed-demo.mjs
 *   (emulators: also set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099)
 *
 * Accounts (all @example.com, email-verified):
 *   asha.demo@example.com   — the elder
 *   priya.demo@example.com  — family member (daughter)
 *   ravi.demo@example.com   — caregiver
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 10) {
  console.error("Set DEMO_PASSWORD (10+ characters).");
  process.exit(1);
}

initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const auth = getAuth();
const db = getFirestore();

async function user(email, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName, emailVerified: true });
    return existing.uid;
  } catch {
    return (await auth.createUser({ email, password, displayName, emailVerified: true })).uid;
  }
}

const none = { viewMedications: false, viewAppointments: false, viewCheckins: false, viewSummaries: false, viewLifebook: false, contributeLifebook: false, proposeSchedule: false, manageCare: false, receiveHelp: false };
const today = new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const now = new Date().toISOString();

const elderId = await user("asha.demo@example.com", "Asha");
const priyaId = await user("priya.demo@example.com", "Priya");
const raviId = await user("ravi.demo@example.com", "Ravi");

const batch = db.batch();
const e = (path) => db.doc(`elders/${elderId}/${path}`);
batch.set(db.doc(`elders/${elderId}`), {
  id: elderId, fullName: "Asha Kulkarni", preferredName: "Asha", pookie: "sweet", companion: "granny", language: "en", phone: "+91 90000 00000",
  consent: { aiPersonalization: true, saveSummaries: true, reminders: true, sharingPaused: false, updatedAt: now }, onboarded: true, createdAt: now,
});
batch.set(db.doc(`users/${elderId}`), { role: "elder", elderId, name: "Asha" });
batch.set(db.doc(`users/${priyaId}`), { role: "family", elderId, name: "Priya" });
batch.set(db.doc(`users/${raviId}`), { role: "caregiver", elderId, name: "Ravi" });
batch.set(e(`members/${priyaId}`), { name: "Priya", email: "priya.demo@example.com", role: "family", status: "active", invitedAt: now,
  permissions: { ...none, viewMedications: true, viewAppointments: true, viewCheckins: true, viewSummaries: true, viewLifebook: true, contributeLifebook: true, proposeSchedule: true, receiveHelp: true } });
batch.set(e(`members/${raviId}`), { name: "Ravi", email: "ravi.demo@example.com", role: "caregiver", status: "active", invitedAt: now,
  permissions: { ...none, viewMedications: true, viewAppointments: true, manageCare: true, receiveHelp: true } });
const med = { notes: "", active: true, createdAt: now, startDate: addDays(-30), endDate: null, frequency: { kind: "daily" } };
batch.set(e("medications/med-amlodipine"), { ...med, id: "med-amlodipine", name: "Amlodipine", dose: "5 mg, 1 tablet", times: ["08:00"], notes: "After breakfast" });
batch.set(e("medications/med-metformin"), { ...med, id: "med-metformin", name: "Metformin", dose: "500 mg", times: ["08:30", "20:30"], notes: "With food" });
batch.set(e("appointments/appt-heart"), { id: "appt-heart", doctor: "Dr. Mehta (heart clinic)", date: addDays(3), time: "11:00", location: "City Care Hospital", notes: "", prep: "Bring the last blood test report", remind: true, status: "scheduled", shareWithCircle: true, createdAt: now });
for (const [id, label, time] of [["sched-morning", "Morning check-in", "09:00"], ["sched-afternoon", "Afternoon check-in", "14:00"], ["sched-evening", "Evening check-in", "20:00"]]) {
  batch.set(e(`schedules/${id}`), { id, label, time, status: "accepted", proposedBy: { uid: elderId, name: "Asha", role: "elder" }, originalTime: null, createdAt: now, decidedAt: now, onDate: null });
}
const mem = (id, category, title, detail, extra = {}) =>
  batch.set(e(`lifebook/${id}`), { id, category, title, detail, when: "", relationship: "", people: [], media: null, history: [], confirmed: true, aiAllowed: true, shareWithCircle: true, createdAt: now, updatedAt: now, source: { type: "self", byUid: elderId, byName: "Asha" }, ...extra });
mem("lb-priya", "people", "Priya", "My daughter. Lives in Bengaluru and calls every Sunday.", { relationship: "daughter" });
mem("lb-rohan", "people", "Rohan", "My grandson. Loves cricket.", { relationship: "grandson" });
mem("lb-walk", "everyday", "Morning walk in the park", "After tea, around 7.");
mem("lb-songs", "favorites", "Old Hindi film songs", "The ones my husband used to hum on Sunday mornings.");
await batch.commit();
console.log(`Seeded fictional demo data for elder ${elderId} (${today}).`);
