import type {
  MedicalProfile,
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
import { PermissionError, ValidationError } from "@/lib/types";
import { DEMO_MAX_MEDIA_BYTES } from "@/lib/domain/lifebook";
import { buildSampleMedical, buildSample } from "./demoSample";
import { can, type Action } from "@/lib/domain/permissions";
import { sanitizeNotifyPrefs, type NotifyPrefs } from "@shared/notifyPrefs";
import {
  shouldNotify,
  buildNotice,
  noticeRecipients,
  type CircleNotice,
  type NoticeKind,
} from "@shared/circleNotices";
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
  sanitizeMedical,
} from "./sanitize";

export const DEMO_ELDER_ID = "demo-elder";
export const DEMO_STORAGE_KEY = "pookie.demo.v1";

interface DemoDb {
  elder: ElderProfile | null;
  circle: CircleMember[];
  medications: Medication[];
  doseLogs: DoseLog[];
  appointments: Appointment[];
  checkins: Checkin[];
  lifebook: LifebookEntry[];
  schedules: CareSchedule[];
  summaries: CareSummary[];
  helpRequests: HelpRequest[];
  /** Demo stand-in for users/{uid}/notices, keyed by member id. */
  notices: Record<string, CircleNotice[]>;
  /** Demo stand-in for users/{uid}/settings/notify. */
  notifyPrefs: Record<string, NotifyPrefs>;
  medical?: MedicalProfile | null;
}

const EMPTY_DB: DemoDb = {
  elder: null,
  circle: [],
  medications: [],
  doseLogs: [],
  appointments: [],
  checkins: [],
  lifebook: [],
  schedules: [],
  summaries: [],
  helpRequests: [],
  notices: {},
  notifyPrefs: {},
};

/** Anything with getItem/setItem/removeItem (window.localStorage, or a Map-backed fake in tests). */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type WithId = { id: string };
const upsert = <T extends WithId>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];
const without = <T extends WithId>(list: T[], id: string): T[] =>
  list.filter((x) => x.id !== id);
const newestFirst = <T extends { createdAt: string }>(list: T[]): T[] =>
  [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/**
 * Demo Mode storage. Nothing leaves the browser. It applies the same access
 * policy as the backend rules so the family/caregiver views behave truthfully.
 */
export class DemoRepository implements Repository {
  readonly mode = "demo" as const;

  constructor(
    private readonly store: KeyValueStore,
    private readonly getActor: () => Actor | null,
  ) {}

  private read(): DemoDb {
    try {
      const raw = this.store.getItem(DEMO_STORAGE_KEY);
      return raw
        ? { ...EMPTY_DB, ...(JSON.parse(raw) as Partial<DemoDb>) }
        : { ...EMPTY_DB };
    } catch {
      return { ...EMPTY_DB };
    }
  }

  private write(db: DemoDb): void {
    this.store.setItem(DEMO_STORAGE_KEY, JSON.stringify(db));
  }

  private allowed(action: Action, db: DemoDb): boolean {
    return can(this.getActor(), action, {
      sharingPaused: db.elder?.consent.sharingPaused ?? false,
    });
  }

  private guard(action: Action, db: DemoDb): void {
    if (!this.allowed(action, db)) throw new PermissionError(action);
  }

  private mutate(action: Action, change: (db: DemoDb) => DemoDb): void {
    const db = this.read();
    this.guard(action, db);
    this.write(change(db));
  }

  async getElder(): Promise<ElderProfile | null> {
    const db = this.read();
    if (!db.elder) return null;
    this.guard("elder:read", db);
    return db.elder;
  }

  async saveElder(profile: ElderProfile): Promise<void> {
    this.mutate("elder:write", (db) => ({ ...db, elder: profile }));
  }

  async listCircle(): Promise<CircleMember[]> {
    const db = this.read();
    const actor = this.getActor();
    if (actor?.role === "elder") return db.circle;
    // A member may see only their own membership record.
    return db.circle.filter((m) => m.id === actor?.uid);
  }

  async inviteMember(
    _elderId: string,
    invite: InviteInput,
  ): Promise<CircleMember> {
    const clean = sanitizeInvite(invite);
    const member: CircleMember = {
      ...clean,
      id: clean.email,
      status: "invited",
      invitedAt: new Date().toISOString(),
    };
    this.mutate("circle:manage", (db) => ({
      ...db,
      circle: upsert(db.circle, member),
    }));
    return member;
  }

  async updateMember(
    _elderId: string,
    member: CircleMember,
    patch: Partial<Pick<CircleMember, "permissions" | "status">>,
  ): Promise<void> {
    this.mutate("circle:manage", (db) => ({
      ...db,
      circle: upsert(db.circle, { ...member, ...patch }),
    }));
  }

  async removeMember(_elderId: string, member: CircleMember): Promise<void> {
    this.mutate("circle:manage", (db) => ({
      ...db,
      circle: without(db.circle, member.id),
    }));
  }

  async listMedications(): Promise<Medication[]> {
    const db = this.read();
    this.guard("medications:read", db);
    return db.medications;
  }
  async saveMedication(
    _elderId: string,
    medication: Medication,
  ): Promise<void> {
    const clean = sanitizeMedication(medication);
    this.mutate("medications:write", (db) => ({
      ...db,
      medications: upsert(db.medications, clean),
    }));
  }
  async deleteMedication(
    _elderId: string,
    medicationId: string,
  ): Promise<void> {
    this.mutate("medications:write", (db) => ({
      ...db,
      medications: without(db.medications, medicationId),
      doseLogs: db.doseLogs.filter((l) => l.medicationId !== medicationId),
    }));
  }
  async listDoseLogs(_elderId: string, dateKey: string): Promise<DoseLog[]> {
    const db = this.read();
    this.guard("medications:read", db);
    return db.doseLogs.filter((l) => l.dateKey === dateKey);
  }
  async saveDoseLog(_elderId: string, log: DoseLog): Promise<void> {
    this.mutate("doses:confirm", (db) => ({
      ...db,
      doseLogs: upsert(db.doseLogs, log),
    }));
  }
  async deleteDoseLog(_elderId: string, logId: string): Promise<void> {
    this.mutate("doses:confirm", (db) => ({
      ...db,
      doseLogs: without(db.doseLogs, logId),
    }));
  }

  async listAppointments(): Promise<Appointment[]> {
    const db = this.read();
    this.guard("appointments:read", db);
    // Members who only view appointments see the ones the elder shared; managers see all.
    const all = this.allowed("appointments:write", db);
    return db.appointments
      .filter((a) => all || a.shareWithCircle !== false)
      .sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
      );
  }
  async saveAppointment(
    _elderId: string,
    appointment: Appointment,
  ): Promise<void> {
    const clean = sanitizeAppointment(appointment);
    this.mutate("appointments:write", (db) => ({
      ...db,
      appointments: upsert(db.appointments, clean),
    }));
  }
  async deleteAppointment(
    _elderId: string,
    appointmentId: string,
  ): Promise<void> {
    this.mutate("appointments:write", (db) => ({
      ...db,
      appointments: without(db.appointments, appointmentId),
    }));
  }

  async listCheckins(_elderId: string, max = 30): Promise<Checkin[]> {
    const db = this.read();
    if (this.allowed("checkins:read", db))
      return newestFirst(db.checkins).slice(0, max);
    this.guard("checkins:readShared", db);
    return newestFirst(db.checkins.filter((c) => c.shareWithCircle)).slice(
      0,
      max,
    );
  }
  async saveCheckin(_elderId: string, checkin: Checkin): Promise<void> {
    const clean = sanitizeCheckin(checkin);
    this.mutate("checkins:write", (db) => {
      const before = db.checkins.find((c) => c.id === clean.id);
      return this.withNotices(
        { ...db, checkins: upsert(db.checkins, clean) },
        "checkin",
        before,
        clean,
      );
    });
  }
  async deleteCheckin(_elderId: string, checkinId: string): Promise<void> {
    this.mutate("checkins:write", (db) => ({
      ...db,
      checkins: without(db.checkins, checkinId),
    }));
  }

  async listLifebook(): Promise<LifebookEntry[]> {
    const db = this.read();
    // The elder sees everything; viewers see shared memories plus their own suggestions.
    if (this.allowed("lifebook:write", db)) return newestFirst(db.lifebook);
    const viewerUid = this.getActor()?.uid;
    if (this.allowed("lifebook:read", db))
      return newestFirst(
        db.lifebook.filter(
          (e) => e.shareWithCircle !== false || e.source.byUid === viewerUid,
        ),
      );
    // Contributors without read access still see what they themselves added.
    this.guard("lifebook:contribute", db);
    const uid = this.getActor()?.uid;
    return newestFirst(db.lifebook.filter((e) => e.source.byUid === uid));
  }
  async saveLifebookEntry(
    _elderId: string,
    entry: LifebookEntry,
  ): Promise<void> {
    const clean = sanitizeLifebookEntry(entry);
    const db = this.read();
    const actor = this.getActor();
    if (this.allowed("lifebook:write", db)) {
      this.write({ ...db, lifebook: upsert(db.lifebook, clean) });
      return;
    }
    this.guard("lifebook:contribute", db);
    // Contributions are always new, attributed, and wait for the elder's confirmation.
    if (!actor || db.lifebook.some((e) => e.id === clean.id))
      throw new PermissionError("lifebook:write");
    const contribution: LifebookEntry = {
      ...clean,
      confirmed: false,
      source: { type: "circle", byUid: actor.uid, byName: actor.name },
    };
    this.write({ ...db, lifebook: [...db.lifebook, contribution] });
  }
  async saveLifebookMedia(
    _elderId: string,
    _entryId: string,
    blob: Blob,
    kind: LifebookMedia["kind"],
  ): Promise<LifebookMedia> {
    const db = this.read();
    if (!this.allowed("lifebook:write", db))
      this.guard("lifebook:contribute", db);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    if (dataUrl.length > DEMO_MAX_MEDIA_BYTES)
      throw new ValidationError("media", "mediaTooBig");
    return { kind, contentType: blob.type, dataUrl };
  }
  async lifebookMediaUrl(media: LifebookMedia): Promise<string> {
    return media.dataUrl ?? "";
  }
  async deleteLifebookEntry(_elderId: string, entryId: string): Promise<void> {
    this.mutate("lifebook:write", (db) => ({
      ...db,
      lifebook: without(db.lifebook, entryId),
    }));
  }

  async listSchedules(): Promise<CareSchedule[]> {
    const db = this.read();
    this.guard("schedules:read", db);
    return [...db.schedules].sort((a, b) => a.time.localeCompare(b.time));
  }
  async saveSchedule(_elderId: string, schedule: CareSchedule): Promise<void> {
    const clean = sanitizeSchedule(schedule);
    const db = this.read();
    const actor = this.getActor();
    if (this.allowed("schedules:decide", db)) {
      this.write({ ...db, schedules: upsert(db.schedules, clean) });
      return;
    }
    this.guard("schedules:propose", db);
    const isNewProposal =
      clean.status === "proposed" &&
      clean.proposedBy.uid === actor?.uid &&
      !db.schedules.some((s) => s.id === clean.id);
    if (!isNewProposal) throw new PermissionError("schedules:decide");
    this.write({ ...db, schedules: [...db.schedules, clean] });
  }
  async deleteSchedule(_elderId: string, scheduleId: string): Promise<void> {
    this.mutate("schedules:decide", (db) => ({
      ...db,
      schedules: without(db.schedules, scheduleId),
    }));
  }

  async listSummaries(_elderId: string, max = 30): Promise<CareSummary[]> {
    const db = this.read();
    if (this.allowed("summaries:read", db))
      return newestFirst(db.summaries).slice(0, max);
    this.guard("summaries:readShared", db);
    return newestFirst(db.summaries.filter((s) => s.shared)).slice(0, max);
  }
  async saveSummary(_elderId: string, summary: CareSummary): Promise<void> {
    const clean = sanitizeSummary(summary);
    const db = this.read();
    this.guard("summaries:write", db);
    if (!db.elder?.consent.saveSummaries)
      throw new PermissionError("summaries:write (no consent)");
    const before = db.summaries.find((x) => x.id === clean.id);
    this.write(
      this.withNotices(
        { ...db, summaries: upsert(db.summaries, clean) },
        "summary",
        before,
        clean,
      ),
    );
  }
  async deleteSummary(_elderId: string, summaryId: string): Promise<void> {
    this.mutate("summaries:write", (db) => ({
      ...db,
      summaries: without(db.summaries, summaryId),
    }));
  }

  async listHelpRequests(_elderId: string, max = 20): Promise<HelpRequest[]> {
    const db = this.read();
    if (!this.allowed("help:request", db)) this.guard("help:read", db);
    return newestFirst(db.helpRequests).slice(0, max);
  }
  async saveHelpRequest(_elderId: string, request: HelpRequest): Promise<void> {
    const clean = sanitizeHelpRequest(request);
    this.mutate("help:request", (db) => {
      const before = db.helpRequests.find((r) => r.id === clean.id);
      return this.withNotices(
        { ...db, helpRequests: upsert(db.helpRequests, clean) },
        "help",
        before,
        clean,
      );
    });
  }
  async acknowledgeHelpRequest(
    _elderId: string,
    requestId: string,
  ): Promise<void> {
    const actor = this.getActor();
    this.mutate("help:acknowledge", (db) => {
      const current = db.helpRequests.find((r) => r.id === requestId);
      if (!actor || !current || current.status !== "open")
        throw new PermissionError("help:acknowledge");
      const updated: HelpRequest = {
        ...current,
        status: "acknowledged",
        acknowledgedBy: { uid: actor.uid, name: actor.name },
        acknowledgedAt: new Date().toISOString(),
      };
      return { ...db, helpRequests: upsert(db.helpRequests, updated) };
    });
  }

  /** Mirrors the notifyOn* Cloud Functions (same shared module). */
  private withNotices(
    db: DemoDb,
    kind: NoticeKind,
    before: Checkin | CareSummary | HelpRequest | undefined,
    after: Checkin | CareSummary | HelpRequest,
  ): DemoDb {
    if (
      !db.elder ||
      !shouldNotify(
        kind,
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      )
    )
      return db;
    const recipients = noticeRecipients(
      kind,
      db.circle,
      db.elder.consent.sharingPaused,
    );
    if (recipients.length === 0) return db;
    const dateKey =
      "dateKey" in after ? after.dateKey : after.createdAt.slice(0, 10);
    const notice = buildNotice({
      elderId: db.elder.id,
      elderName: db.elder.preferredName,
      kind,
      recordId: after.id,
      dateKey,
      now: new Date(),
    });
    const notices = { ...db.notices };
    for (const uid of recipients)
      notices[uid] = upsert(notices[uid] ?? [], notice);
    return { ...db, notices };
  }

  async listNotices(uid: string): Promise<CircleNotice[]> {
    if (this.getActor()?.uid !== uid) throw new PermissionError("notices:read");
    return newestFirst(this.read().notices[uid] ?? []);
  }

  async markNoticeRead(uid: string, noticeId: string): Promise<void> {
    if (this.getActor()?.uid !== uid)
      throw new PermissionError("notices:update");
    const db = this.read();
    const list = db.notices[uid] ?? [];
    this.write({
      ...db,
      notices: {
        ...db.notices,
        [uid]: list.map((n) => (n.id === noticeId ? { ...n, read: true } : n)),
      },
    });
  }

  async getMedical(): Promise<MedicalProfile | null> {
    const db = this.read();
    this.guard("medical:read", db);
    return db.medical ?? null;
  }

  async saveMedical(_elderId: string, profile: MedicalProfile): Promise<void> {
    const clean = sanitizeMedical(profile);
    this.mutate("medical:write", (db) => ({ ...db, medical: clean }));
  }

  async getNotifyPrefs(uid: string): Promise<NotifyPrefs | null> {
    if (this.getActor()?.uid !== uid) throw new PermissionError("prefs:read");
    return this.read().notifyPrefs[uid] ?? null;
  }

  async saveNotifyPrefs(uid: string, prefs: NotifyPrefs): Promise<void> {
    if (this.getActor()?.uid !== uid) throw new PermissionError("prefs:write");
    const db = this.read();
    this.write({
      ...db,
      notifyPrefs: { ...db.notifyPrefs, [uid]: sanitizeNotifyPrefs(prefs) },
    });
  }

  async exportAll(): Promise<ExportBundle> {
    const db = this.read();
    this.guard("elder:write", db);
    // Notices belong to members, not to the elder's export.
    const { notices: _notices, notifyPrefs: _prefs, ...data } = db;
    return { exportedAt: new Date().toISOString(), ...data };
  }

  async deleteAll(): Promise<void> {
    const db = this.read();
    if (db.elder) this.guard("elder:write", db);
    this.store.removeItem(DEMO_STORAGE_KEY);
  }

  /** Demo only: stands in for the invited person accepting. No email is ever sent. */
  simulateAcceptance(memberId: string): void {
    this.mutate("circle:manage", (db) => ({
      ...db,
      circle: db.circle.map((m) =>
        m.id === memberId && m.status === "invited"
          ? { ...m, status: "active" as const }
          : m,
      ),
    }));
  }

  /** Demo only: replaces everything with fictional sample data (see demoSample.ts). */
  loadSample(now = new Date()): void {
    const sample = buildSample(DEMO_ELDER_ID, now);
    this.write({
      ...EMPTY_DB,
      ...sample,
      helpRequests: [],
      notices: {},
      notifyPrefs: {},
      medical: buildSampleMedical(now),
    });
  }

  /** Demo only: stands in for the invited person declining. */
  simulateDecline(memberId: string): void {
    this.mutate("circle:manage", (db) => ({
      ...db,
      circle: db.circle.map((m) =>
        m.id === memberId && m.status === "invited"
          ? { ...m, status: "declined" as const }
          : m,
      ),
    }));
  }

  /** Demo only: membership record used to "view as" a Care Circle member. */
  peekMember(memberId: string): CircleMember | null {
    return this.read().circle.find((m) => m.id === memberId) ?? null;
  }

  peekElder(): ElderProfile | null {
    return this.read().elder;
  }

  peekCircle(): CircleMember[] {
    return this.read().circle;
  }
}
