/**
 * Firestore Security Rules tests. Needs the Firestore emulator (Java):
 *   npm run test:rules
 * These prove the backend — not just the UI — enforces Pookie's access rules.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, query, collection, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

const ELDER = "elder-asha";
const PRIYA = "priya-uid";
const RAVI = "ravi-uid";
const STRANGER = "stranger-uid";

const none = { viewMedications: false, viewAppointments: false, viewCheckins: false, viewSummaries: false, viewLifebook: false, contributeLifebook: false, proposeSchedule: false, manageCare: false, receiveHelp: false };
const elderDoc = (consent: Record<string, boolean> = {}) => ({
  id: ELDER,
  fullName: "Asha Rao",
  preferredName: "Asha",
  pookie: "sweet",
  language: "en",
  onboarded: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  consent: { aiPersonalization: false, saveSummaries: true, reminders: false, sharingPaused: false, updatedAt: "", ...consent },
});
const medication = { id: "m1", name: "Metformin", dose: "500 mg", times: ["08:00"], notes: "", active: true, createdAt: "" };
const checkin = (shareWithCircle: boolean) => ({ dateKey: "2026-06-10", createdAt: "x", mood: 4, sleep: 3, energy: 3, assistance: "none", note: "", shareWithCircle, scheduleId: null });

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-pookie",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "elders", ELDER), elderDoc());
    await setDoc(doc(db, "elders", ELDER, "members", PRIYA), { name: "Priya", email: "priya@example.com", role: "family", status: "active", permissions: { ...none, viewMedications: true, viewCheckins: true, proposeSchedule: true, contributeLifebook: true } });
    await setDoc(doc(db, "elders", ELDER, "members", RAVI), { name: "Ravi", email: "ravi@example.com", role: "caregiver", status: "paused", permissions: { ...none, viewMedications: true, manageCare: true } });
    await setDoc(doc(db, "elders", ELDER, "medications", "m1"), medication);
    await setDoc(doc(db, "elders", ELDER, "checkins", "private"), checkin(false));
    await setDoc(doc(db, "elders", ELDER, "checkins", "shared"), checkin(true));
  });
});

const as = (uid: string, email?: string) => env.authenticatedContext(uid, email ? { email, email_verified: true } : {}).firestore();

describe("ownership and strangers", () => {
  it("lets the elder read and write their own data", async () => {
    await assertSucceeds(getDoc(doc(as(ELDER), "elders", ELDER, "medications", "m1")));
    await assertSucceeds(setDoc(doc(as(ELDER), "elders", ELDER, "medications", "m2"), { ...medication, id: "m2" }));
  });

  it("denies signed-out users and strangers everything", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "elders", ELDER)));
    await assertFails(getDoc(doc(as(STRANGER), "elders", ELDER)));
    await assertFails(getDoc(doc(as(STRANGER), "elders", ELDER, "medications", "m1")));
  });

  it("rejects invalid medication data even from the elder", async () => {
    await assertFails(setDoc(doc(as(ELDER), "elders", ELDER, "medications", "bad"), { ...medication, name: "" }));
    await assertFails(setDoc(doc(as(ELDER), "elders", ELDER, "medications", "bad"), { ...medication, times: [] }));
  });
});

describe("Care Circle permissions", () => {
  it("allows exactly what was granted", async () => {
    await assertSucceeds(getDoc(doc(as(PRIYA), "elders", ELDER, "medications", "m1")));
    await assertFails(setDoc(doc(as(PRIYA), "elders", ELDER, "medications", "m2"), { ...medication, id: "m2" }));
    await assertFails(getDocs(collection(as(PRIYA), "elders", ELDER, "appointments")));
  });

  it("gives a paused member nothing", async () => {
    await assertFails(getDoc(doc(as(RAVI), "elders", ELDER, "medications", "m1")));
  });

  it("gives nobody anything while the elder has paused all sharing", async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "elders", ELDER), { "consent.sharingPaused": true }));
    await assertFails(getDoc(doc(as(PRIYA), "elders", ELDER, "medications", "m1")));
  });

  it("only shows check-ins the elder chose to share", async () => {
    await assertSucceeds(getDocs(query(collection(as(PRIYA), "elders", ELDER, "checkins"), where("shareWithCircle", "==", true))));
    await assertFails(getDoc(doc(as(PRIYA), "elders", ELDER, "checkins", "private")));
    await assertFails(getDocs(collection(as(PRIYA), "elders", ELDER, "checkins")));
  });

  it("does not let a member change their own permissions", async () => {
    await assertFails(updateDoc(doc(as(PRIYA), "elders", ELDER, "members", PRIYA), { "permissions.manageCare": true }));
  });
});

describe("medication confirmation", () => {
  const log = { medicationId: "m1", dateKey: "2026-06-10", time: "08:00", status: "taken", confirmedAt: "x" };
  it("only the elder can say a dose was taken or missed", async () => {
    await assertSucceeds(setDoc(doc(as(ELDER), "elders", ELDER, "doseLogs", "l1"), log));
    await assertFails(setDoc(doc(as(PRIYA), "elders", ELDER, "doseLogs", "l2"), log));
  });
  it("has no stored 'unconfirmed' status — silence is never written", async () => {
    await assertFails(setDoc(doc(as(ELDER), "elders", ELDER, "doseLogs", "l3"), { ...log, status: "unconfirmed" }));
  });
});

describe("care schedules", () => {
  const proposal = (status: string, uid = PRIYA) => ({ label: "Morning check-in", time: "09:00", status, proposedBy: { uid, name: "Priya", role: "family" }, originalTime: null, createdAt: "x", decidedAt: null });
  it("lets a permitted member propose but not accept", async () => {
    await assertSucceeds(setDoc(doc(as(PRIYA), "elders", ELDER, "schedules", "s1"), proposal("proposed")));
    await assertFails(setDoc(doc(as(PRIYA), "elders", ELDER, "schedules", "s2"), proposal("accepted")));
    await assertFails(updateDoc(doc(as(PRIYA), "elders", ELDER, "schedules", "s1"), { status: "accepted" }));
  });
  it("lets only the elder decide", async () => {
    await assertSucceeds(setDoc(doc(as(PRIYA), "elders", ELDER, "schedules", "s1"), proposal("proposed")));
    await assertSucceeds(updateDoc(doc(as(ELDER), "elders", ELDER, "schedules", "s1"), { status: "accepted" }));
  });
});

describe("LifeBook", () => {
  const entry = (overrides: Record<string, unknown>) => ({ category: "people", title: "Meera", detail: "Daughter", confirmed: false, aiAllowed: true, createdAt: "x", updatedAt: "x", source: { type: "circle", byUid: PRIYA, byName: "Priya" }, ...overrides });
  it("accepts contributions only as unconfirmed and attributed", async () => {
    await assertSucceeds(setDoc(doc(as(PRIYA), "elders", ELDER, "lifebook", "e1"), entry({})));
    await assertFails(setDoc(doc(as(PRIYA), "elders", ELDER, "lifebook", "e2"), entry({ confirmed: true })));
    await assertFails(setDoc(doc(as(PRIYA), "elders", ELDER, "lifebook", "e3"), entry({ source: { type: "circle", byUid: ELDER, byName: "Asha" } })));
  });
  it("lets only the elder confirm or delete", async () => {
    await assertSucceeds(setDoc(doc(as(PRIYA), "elders", ELDER, "lifebook", "e1"), entry({})));
    await assertFails(updateDoc(doc(as(PRIYA), "elders", ELDER, "lifebook", "e1"), { confirmed: true }));
    await assertSucceeds(updateDoc(doc(as(ELDER), "elders", ELDER, "lifebook", "e1"), { confirmed: true }));
    await assertFails(deleteDoc(doc(as(PRIYA), "elders", ELDER, "lifebook", "e1")));
  });
});

describe("summaries and notices", () => {
  const summary = { dateKey: "2026-06-10", createdAt: "x", feeling: "good", note: "", exchanges: 3, shared: false, scheduleId: null };
  it("saves a summary only with the elder's consent", async () => {
    await assertSucceeds(setDoc(doc(as(ELDER), "elders", ELDER, "summaries", "s1"), summary));
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "elders", ELDER), { "consent.saveSummaries": false }));
    await assertFails(setDoc(doc(as(ELDER), "elders", ELDER, "summaries", "s2"), summary));
  });
  it("lets no client forge a notice, and only the owner read one", async () => {
    await assertFails(setDoc(doc(as(PRIYA), "users", PRIYA, "notices", "n1"), { read: false }));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users", PRIYA, "notices", "n1"), { elderId: ELDER, kind: "checkin", read: false }));
    await assertSucceeds(getDoc(doc(as(PRIYA), "users", PRIYA, "notices", "n1")));
    await assertSucceeds(updateDoc(doc(as(PRIYA), "users", PRIYA, "notices", "n1"), { read: true }));
    await assertFails(getDoc(doc(as(STRANGER), "users", PRIYA, "notices", "n1")));
  });
});

describe("joining by invitation", () => {
  const NEW = "meera-uid";
  const email = "meera@example.com";
  const perms = { ...none, viewMedications: true };
  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "elders", ELDER, "invites", email), { email, name: "Meera", role: "family", status: "pending", permissions: perms }));
  });

  it("accepts an invitee who joins with exactly the offered role and permissions", async () => {
    const db = as(NEW, email);
    const batch = writeBatch(db);
    batch.update(doc(db, "elders", ELDER, "invites", email), { status: "accepted", acceptedAt: "x" });
    batch.set(doc(db, "elders", ELDER, "members", NEW), { name: "Meera", email, role: "family", status: "active", permissions: perms });
    await assertSucceeds(batch.commit());
  });

  it("rejects joining with more permissions than offered", async () => {
    const db = as(NEW, email);
    const batch = writeBatch(db);
    batch.update(doc(db, "elders", ELDER, "invites", email), { status: "accepted", acceptedAt: "x" });
    batch.set(doc(db, "elders", ELDER, "members", NEW), { name: "Meera", email, role: "family", status: "active", permissions: { ...perms, manageCare: true } });
    await assertFails(batch.commit());
  });

  it("rejects someone with a different email", async () => {
    const db = as(STRANGER, "other@example.com");
    await assertFails(setDoc(doc(db, "elders", ELDER, "members", STRANGER), { name: "X", email: "other@example.com", role: "family", status: "active", permissions: perms }));
  });
});

describe("help requests", () => {
  const req = { createdAt: "x", message: "Call me?", status: "open", acknowledgedBy: null, acknowledgedAt: null };
  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "elders", ELDER, "members", PRIYA), { "permissions.receiveHelp": true }));
  });
  it("only the elder creates one, and only as open", async () => {
    await assertSucceeds(setDoc(doc(as(ELDER), "elders", ELDER, "helpRequests", "h1"), req));
    await assertFails(setDoc(doc(as(PRIYA), "elders", ELDER, "helpRequests", "h2"), req));
    await assertFails(setDoc(doc(as(ELDER), "elders", ELDER, "helpRequests", "h3"), { ...req, status: "acknowledged" }));
  });
  it("a permitted member may only acknowledge it as themselves", async () => {
    await assertSucceeds(setDoc(doc(as(ELDER), "elders", ELDER, "helpRequests", "h1"), req));
    await assertFails(updateDoc(doc(as(PRIYA), "elders", ELDER, "helpRequests", "h1"), { status: "acknowledged", acknowledgedBy: { uid: RAVI, name: "Ravi" }, acknowledgedAt: "x" }));
    await assertFails(updateDoc(doc(as(PRIYA), "elders", ELDER, "helpRequests", "h1"), { message: "changed" }));
    await assertSucceeds(updateDoc(doc(as(PRIYA), "elders", ELDER, "helpRequests", "h1"), { status: "acknowledged", acknowledgedBy: { uid: PRIYA, name: "Priya" }, acknowledgedAt: "x" }));
  });
  it("is hidden from members without the permission", async () => {
    await assertSucceeds(setDoc(doc(as(ELDER), "elders", ELDER, "helpRequests", "h1"), req));
    await assertFails(getDoc(doc(as(RAVI), "elders", ELDER, "helpRequests", "h1")));
  });
});

describe("appointment visibility", () => {
  const visit = (shareWithCircle: boolean) => ({ doctor: "Dr. Mehta", date: "2026-06-10", time: "11:00", location: "", notes: "", prep: "", remind: true, status: "scheduled", shareWithCircle, createdAt: "x" });
  it("viewers read only shared visits", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "elders", ELDER, "members", PRIYA), { "permissions.viewAppointments": true });
      await setDoc(doc(ctx.firestore(), "elders", ELDER, "appointments", "open"), visit(true));
      await setDoc(doc(ctx.firestore(), "elders", ELDER, "appointments", "private"), visit(false));
    });
    await assertSucceeds(getDoc(doc(as(PRIYA), "elders", ELDER, "appointments", "open")));
    await assertFails(getDoc(doc(as(PRIYA), "elders", ELDER, "appointments", "private")));
  });
});

describe("reminder preferences", () => {
  const prefs = { timezone: "Asia/Kolkata", quietStart: "21:30", quietEnd: "07:00", kinds: { medicine: true, checkin: true, appointment: true, circle: true }, channels: { push: false, email: false }, updatedAt: "x" };
  it("are private to their owner and validated", async () => {
    await assertSucceeds(setDoc(doc(as(PRIYA), "users", PRIYA, "settings", "notify"), prefs));
    await assertFails(getDoc(doc(as(ELDER), "users", PRIYA, "settings", "notify")));
    await assertFails(setDoc(doc(as(PRIYA), "users", PRIYA, "settings", "notify"), { ...prefs, quietStart: "late" }));
  });
});

describe("declining an invitation", () => {
  const email = "meera@example.com";
  it("lets the invitee decline but not grant themselves anything", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "elders", ELDER, "invites", email), { email, name: "Meera", role: "family", status: "pending", permissions: none }));
    const db = as("meera-uid", email);
    await assertFails(updateDoc(doc(db, "elders", ELDER, "invites", email), { status: "declined", permissions: { ...none, manageCare: true } }));
    await assertSucceeds(updateDoc(doc(db, "elders", ELDER, "invites", email), { status: "declined", declinedAt: "x" }));
  });
});

describe("LifeBook sharing and media", () => {
  const memory = (shareWithCircle: boolean) => ({ category: "people", title: "Meera", detail: "Daughter", confirmed: true, aiAllowed: true, shareWithCircle, createdAt: "x", updatedAt: "x", source: { type: "self", byUid: ELDER, byName: "Asha" } });
  it("viewers read only shared memories", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "elders", ELDER, "members", PRIYA), { "permissions.viewLifebook": true });
      await setDoc(doc(ctx.firestore(), "elders", ELDER, "lifebook", "shared"), memory(true));
      await setDoc(doc(ctx.firestore(), "elders", ELDER, "lifebook", "private"), memory(false));
    });
    await assertSucceeds(getDoc(doc(as(PRIYA), "elders", ELDER, "lifebook", "shared")));
    await assertFails(getDoc(doc(as(PRIYA), "elders", ELDER, "lifebook", "private")));
  });
  it("rejects media pointing outside the elder's folder", async () => {
    await assertFails(setDoc(doc(as(ELDER), "elders", ELDER, "lifebook", "p"), { ...memory(false), category: "photos", media: { kind: "photo", contentType: "image/jpeg", path: "elders/someone-else/media/x.jpg" } }));
    await assertSucceeds(setDoc(doc(as(ELDER), "elders", ELDER, "lifebook", "p"), { ...memory(false), category: "photos", media: { kind: "photo", contentType: "image/jpeg", path: `elders/${ELDER}/media/${ELDER}/p.jpg` } }));
  });
});
