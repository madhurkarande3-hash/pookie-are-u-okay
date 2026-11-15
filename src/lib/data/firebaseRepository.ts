import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";
import type {
  Actor,
  Appointment,
  CareSchedule,
  CareSummary,
  Checkin,
  CircleMember,
  DoseLog,
  ElderProfile,
  HelpRequest,
  LifebookEntry,
  LifebookMedia,
  Medication,
} from "@/lib/types";
import { getFirebase } from "@/lib/firebase/client";
import type { CircleNotice } from "@shared/circleNotices";
import { sanitizeNotifyPrefs, type NotifyPrefs } from "@shared/notifyPrefs";
import type { ExportBundle, InviteInput, Repository } from "./repository";
import {
  sanitizeAppointment,
  sanitizeCheckin,
  sanitizeHelpRequest,
  sanitizeInvite,
  sanitizeLifebookEntry,
  sanitizeMedication,
  sanitizeSchedule,
  sanitizeSummary,
} from "./sanitize";

type Sub = "members" | "invites" | "medications" | "doseLogs" | "appointments" | "checkins" | "lifebook" | "schedules" | "summaries" | "helpRequests";

/**
 * Cloud Firestore storage. Access control lives in firestore.rules; the
 * queries here are shaped so they satisfy those rules (e.g. Care Circle
 * members always filter on `shareWithCircle == true`).
 */
export class FirebaseRepository implements Repository {
  readonly mode = "firebase" as const;
  private readonly db: Firestore;

  constructor(private readonly getActor: () => Actor | null) {
    this.db = getFirebase().db;
  }

  private get isElder(): boolean {
    return this.getActor()?.role === "elder";
  }

  private col(elderId: string, sub: Sub) {
    return collection(this.db, "elders", elderId, sub);
  }

  private async list<T extends { id: string }>(elderId: string, sub: Sub, ...constraints: QueryConstraint[]): Promise<T[]> {
    const snap = await getDocs(query(this.col(elderId, sub), ...constraints));
    return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
  }

  private async put(elderId: string, sub: Sub, item: { id: string }): Promise<void> {
    await setDoc(doc(this.db, "elders", elderId, sub, item.id), item as DocumentData);
  }

  private async remove(elderId: string, sub: Sub, id: string): Promise<void> {
    await deleteDoc(doc(this.db, "elders", elderId, sub, id));
  }

  async getElder(elderId: string): Promise<ElderProfile | null> {
    const snap = await getDoc(doc(this.db, "elders", elderId));
    return snap.exists() ? ({ ...(snap.data() as ElderProfile), id: snap.id }) : null;
  }

  async saveElder(profile: ElderProfile): Promise<void> {
    await setDoc(doc(this.db, "elders", profile.id), profile);
  }

  async listCircle(elderId: string): Promise<CircleMember[]> {
    const actor = this.getActor();
    if (!this.isElder) {
      if (!actor) return [];
      const own = await getDoc(doc(this.db, "elders", elderId, "members", actor.uid));
      return own.exists() ? [{ ...(own.data() as CircleMember), id: own.id }] : [];
    }
    const [members, invites] = await Promise.all([
      this.list<CircleMember>(elderId, "members"),
      this.list<CircleMember & { status: string }>(elderId, "invites", where("status", "in", ["pending", "declined"])),
    ]);
    return [...members, ...invites.map((i) => ({ ...i, status: i.status === "declined" ? ("declined" as const) : ("invited" as const) }))];
  }

  async inviteMember(elderId: string, invite: InviteInput): Promise<CircleMember> {
    const clean = sanitizeInvite(invite);
    const elder = await this.getElder(elderId);
    const invitedAt = new Date().toISOString();
    // Stored with status "pending"; surfaced to the UI as an "invited" member.
    await setDoc(doc(this.db, "elders", elderId, "invites", clean.email), {
      ...clean,
      elderId,
      elderName: elder?.preferredName ?? "",
      status: "pending",
      invitedAt,
    });
    return { ...clean, id: clean.email, status: "invited", invitedAt };
  }

  async updateMember(elderId: string, member: CircleMember, patch: Partial<Pick<CircleMember, "permissions" | "status">>): Promise<void> {
    if (member.status === "invited") {
      if (patch.permissions) await updateDoc(doc(this.db, "elders", elderId, "invites", member.id), { permissions: patch.permissions });
      return;
    }
    await updateDoc(doc(this.db, "elders", elderId, "members", member.id), patch);
  }

  async removeMember(elderId: string, member: CircleMember): Promise<void> {
    const batch = writeBatch(this.db);
    if (member.status !== "invited") batch.delete(doc(this.db, "elders", elderId, "members", member.id));
    // Removing the invitation too means a revoked member cannot re-join with it.
    batch.delete(doc(this.db, "elders", elderId, "invites", member.email));
    await batch.commit();
  }

  listMedications(elderId: string): Promise<Medication[]> {
    return this.list<Medication>(elderId, "medications", orderBy("name"));
  }
  saveMedication(elderId: string, medication: Medication): Promise<void> {
    return this.put(elderId, "medications", sanitizeMedication(medication));
  }
  deleteMedication(elderId: string, medicationId: string): Promise<void> {
    return this.remove(elderId, "medications", medicationId);
  }
  listDoseLogs(elderId: string, dateKey: string): Promise<DoseLog[]> {
    return this.list<DoseLog>(elderId, "doseLogs", where("dateKey", "==", dateKey));
  }
  saveDoseLog(elderId: string, log: DoseLog): Promise<void> {
    return this.put(elderId, "doseLogs", log);
  }
  deleteDoseLog(elderId: string, logId: string): Promise<void> {
    return this.remove(elderId, "doseLogs", logId);
  }

  listAppointments(elderId: string): Promise<Appointment[]> {
    const actor = this.getActor();
    const seesAll = this.isElder || actor?.permissions?.manageCare === true;
    const shared = seesAll ? [] : [where("shareWithCircle", "==", true)];
    return this.list<Appointment>(elderId, "appointments", ...shared, orderBy("date"), orderBy("time"));
  }
  saveAppointment(elderId: string, appointment: Appointment): Promise<void> {
    return this.put(elderId, "appointments", sanitizeAppointment(appointment));
  }
  deleteAppointment(elderId: string, appointmentId: string): Promise<void> {
    return this.remove(elderId, "appointments", appointmentId);
  }

  listCheckins(elderId: string, max = 30): Promise<Checkin[]> {
    const shared = this.isElder ? [] : [where("shareWithCircle", "==", true)];
    return this.list<Checkin>(elderId, "checkins", ...shared, orderBy("createdAt", "desc"), limit(max));
  }
  saveCheckin(elderId: string, checkin: Checkin): Promise<void> {
    return this.put(elderId, "checkins", sanitizeCheckin(checkin));
  }
  deleteCheckin(elderId: string, checkinId: string): Promise<void> {
    return this.remove(elderId, "checkins", checkinId);
  }

  async listLifebook(elderId: string): Promise<LifebookEntry[]> {
    const actor = this.getActor();
    if (this.isElder) return this.list<LifebookEntry>(elderId, "lifebook", orderBy("createdAt", "desc"));
    // Two queries the rules can each prove safe: shared memories (viewers) and own suggestions (contributors).
    const queries: Promise<LifebookEntry[]>[] = [];
    if (actor?.permissions?.viewLifebook) queries.push(this.list<LifebookEntry>(elderId, "lifebook", where("shareWithCircle", "==", true), orderBy("createdAt", "desc")));
    if (actor?.permissions?.contributeLifebook) queries.push(this.list<LifebookEntry>(elderId, "lifebook", where("source.byUid", "==", actor.uid), orderBy("createdAt", "desc")));
    const merged = new Map((await Promise.all(queries)).flat().map((e) => [e.id, e]));
    return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  saveLifebookEntry(elderId: string, entry: LifebookEntry): Promise<void> {
    const clean = sanitizeLifebookEntry(entry);
    const actor = this.getActor();
    const toStore: LifebookEntry =
      this.isElder || !actor ? clean : { ...clean, confirmed: false, source: { type: "circle", byUid: actor.uid, byName: actor.name } };
    return this.put(elderId, "lifebook", toStore);
  }
  async deleteLifebookEntry(elderId: string, entryId: string): Promise<void> {
    const snap = await getDoc(doc(this.db, "elders", elderId, "lifebook", entryId));
    const path = (snap.data() as LifebookEntry | undefined)?.media?.path;
    await this.remove(elderId, "lifebook", entryId);
    if (path) {
      const { ref, deleteObject } = await import("firebase/storage");
      // The memory is gone either way; a leftover file is removed with the account.
      await deleteObject(ref(getFirebase().storage, path)).catch(() => undefined);
    }
  }

  listSchedules(elderId: string): Promise<CareSchedule[]> {
    return this.list<CareSchedule>(elderId, "schedules", orderBy("time"));
  }
  saveSchedule(elderId: string, schedule: CareSchedule): Promise<void> {
    return this.put(elderId, "schedules", sanitizeSchedule(schedule));
  }
  deleteSchedule(elderId: string, scheduleId: string): Promise<void> {
    return this.remove(elderId, "schedules", scheduleId);
  }

  listSummaries(elderId: string, max = 30): Promise<CareSummary[]> {
    const shared = this.isElder ? [] : [where("shared", "==", true)];
    return this.list<CareSummary>(elderId, "summaries", ...shared, orderBy("createdAt", "desc"), limit(max));
  }
  saveSummary(elderId: string, summary: CareSummary): Promise<void> {
    return this.put(elderId, "summaries", sanitizeSummary(summary));
  }
  deleteSummary(elderId: string, summaryId: string): Promise<void> {
    return this.remove(elderId, "summaries", summaryId);
  }

  async saveLifebookMedia(elderId: string, entryId: string, blob: Blob, kind: LifebookMedia["kind"]): Promise<LifebookMedia> {
    const { ref, uploadBytes } = await import("firebase/storage");
    const uid = this.getActor()?.uid ?? "unknown";
    const ext = blob.type.startsWith("image/") ? "jpg" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
    const path = `elders/${elderId}/media/${uid}/${entryId}.${ext}`;
    await uploadBytes(ref(getFirebase().storage, path), blob, { contentType: blob.type });
    return { kind, contentType: blob.type, path };
  }
  async lifebookMediaUrl(media: LifebookMedia): Promise<string> {
    if (!media.path) return media.dataUrl ?? "";
    const { ref, getDownloadURL } = await import("firebase/storage");
    return getDownloadURL(ref(getFirebase().storage, media.path));
  }

  listHelpRequests(elderId: string, max = 20): Promise<HelpRequest[]> {
    return this.list<HelpRequest>(elderId, "helpRequests", orderBy("createdAt", "desc"), limit(max));
  }
  saveHelpRequest(elderId: string, request: HelpRequest): Promise<void> {
    return this.put(elderId, "helpRequests", sanitizeHelpRequest(request));
  }
  async acknowledgeHelpRequest(elderId: string, requestId: string): Promise<void> {
    const actor = this.getActor();
    if (!actor) return;
    await updateDoc(doc(this.db, "elders", elderId, "helpRequests", requestId), {
      status: "acknowledged",
      acknowledgedBy: { uid: actor.uid, name: actor.name.slice(0, 80) },
      acknowledgedAt: new Date().toISOString(),
    });
  }

  async exportAll(elderId: string): Promise<ExportBundle> {
    const [elder, circle, medications, doseLogs, appointments, checkins, lifebook, schedules, summaries, helpRequests] = await Promise.all([
      this.getElder(elderId),
      this.listCircle(elderId),
      this.listMedications(elderId),
      this.list<DoseLog>(elderId, "doseLogs"),
      this.listAppointments(elderId),
      this.list<Checkin>(elderId, "checkins"),
      this.listLifebook(elderId),
      this.listSchedules(elderId),
      this.list<CareSummary>(elderId, "summaries"),
      this.list<HelpRequest>(elderId, "helpRequests"),
    ]);
    return { exportedAt: new Date().toISOString(), elder, circle, medications, doseLogs, appointments, checkins, lifebook, schedules, summaries, helpRequests };
  }

  /**
   * Deletes every record, uploaded file and the login itself. Done by the
   * `deleteMyAccount` Cloud Function: a browser cannot delete its own Auth
   * user after a while without re-authenticating, and the server can remove
   * Storage files and nested collections in one pass.
   */
  async deleteAll(_elderId: string): Promise<void> {
    const [{ httpsCallable }, { getFirebase }] = await Promise.all([import("firebase/functions"), import("@/lib/firebase/client")]);
    await httpsCallable(getFirebase().functions, "deleteMyAccount")({});
  }

  async listNotices(uid: string): Promise<CircleNotice[]> {
    const snap = await getDocs(query(collection(this.db, "users", uid, "notices"), orderBy("createdAt", "desc"), limit(20)));
    return snap.docs.map((d) => ({ ...(d.data() as CircleNotice), id: d.id }));
  }

  async markNoticeRead(uid: string, noticeId: string): Promise<void> {
    await updateDoc(doc(this.db, "users", uid, "notices", noticeId), { read: true });
  }

  async getNotifyPrefs(uid: string): Promise<NotifyPrefs | null> {
    const snap = await getDoc(doc(this.db, "users", uid, "settings", "notify"));
    return snap.exists() ? sanitizeNotifyPrefs(snap.data()) : null;
  }

  async saveNotifyPrefs(uid: string, prefs: NotifyPrefs): Promise<void> {
    await setDoc(doc(this.db, "users", uid, "settings", "notify"), sanitizeNotifyPrefs(prefs));
  }
}
