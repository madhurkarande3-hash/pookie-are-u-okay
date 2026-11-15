import type {
  MedicalProfile,
  Appointment,
  CareSchedule,
  CareSummary,
  Checkin,
  CircleMember,
  DoseLog,
  ElderProfile,
  HelpRequest,
  LifebookMedia,
  LifebookEntry,
  Medication,
  MemberPermissions,
  MemberRole,
} from "@/lib/types";
import type { CircleNotice } from "@shared/circleNotices";
import type { NotifyPrefs } from "@shared/notifyPrefs";

export interface InviteInput {
  name: string;
  email: string;
  role: MemberRole;
  permissions: MemberPermissions;
}

export interface ExportBundle {
  exportedAt: string;
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
  medical?: MedicalProfile | null;
}

/**
 * Everything the UI needs from storage. Two implementations:
 * - DemoRepository: localStorage, enforces the policy in domain/permissions.
 * - FirebaseRepository: Cloud Firestore, enforced by firestore.rules.
 * All reads are one-shot (no realtime listeners) and scoped to one elder.
 */
export interface Repository {
  readonly mode: "demo" | "firebase";

  getElder(elderId: string): Promise<ElderProfile | null>;
  saveElder(profile: ElderProfile): Promise<void>;

  listCircle(elderId: string): Promise<CircleMember[]>;
  inviteMember(elderId: string, invite: InviteInput): Promise<CircleMember>;
  updateMember(
    elderId: string,
    member: CircleMember,
    patch: Partial<Pick<CircleMember, "permissions" | "status">>,
  ): Promise<void>;
  removeMember(elderId: string, member: CircleMember): Promise<void>;

  listMedications(elderId: string): Promise<Medication[]>;
  saveMedication(elderId: string, medication: Medication): Promise<void>;
  deleteMedication(elderId: string, medicationId: string): Promise<void>;
  listDoseLogs(elderId: string, dateKey: string): Promise<DoseLog[]>;
  saveDoseLog(elderId: string, log: DoseLog): Promise<void>;
  deleteDoseLog(elderId: string, logId: string): Promise<void>;

  listAppointments(elderId: string): Promise<Appointment[]>;
  saveAppointment(elderId: string, appointment: Appointment): Promise<void>;
  deleteAppointment(elderId: string, appointmentId: string): Promise<void>;

  /** Care Circle members only ever receive check-ins the elder chose to share. */
  listCheckins(elderId: string, max?: number): Promise<Checkin[]>;
  saveCheckin(elderId: string, checkin: Checkin): Promise<void>;
  deleteCheckin(elderId: string, checkinId: string): Promise<void>;

  /** Members with view access see only memories the elder shared, plus anything they suggested. */
  listLifebook(elderId: string): Promise<LifebookEntry[]>;
  /** Stores a photo or voice recording for a memory. Real server: Cloud Storage. Demo: this browser. */
  saveLifebookMedia(
    elderId: string,
    entryId: string,
    blob: Blob,
    kind: LifebookMedia["kind"],
  ): Promise<LifebookMedia>;
  /** A URL the browser can show or play. */
  lifebookMediaUrl(media: LifebookMedia): Promise<string>;
  saveLifebookEntry(elderId: string, entry: LifebookEntry): Promise<void>;
  deleteLifebookEntry(elderId: string, entryId: string): Promise<void>;

  listSchedules(elderId: string): Promise<CareSchedule[]>;
  saveSchedule(elderId: string, schedule: CareSchedule): Promise<void>;
  deleteSchedule(elderId: string, scheduleId: string): Promise<void>;

  listSummaries(elderId: string, max?: number): Promise<CareSummary[]>;
  saveSummary(elderId: string, summary: CareSummary): Promise<void>;
  deleteSummary(elderId: string, summaryId: string): Promise<void>;

  exportAll(elderId: string): Promise<ExportBundle>;
  /** Permanently deletes the elder's profile and every record under it. */
  deleteAll(elderId: string): Promise<void>;

  /** The signed-in member's own "something was shared" notices (content-free). */
  listNotices(uid: string): Promise<CircleNotice[]>;
  markNoticeRead(uid: string, noticeId: string): Promise<void>;

  /** "I'd like some help": the elder creates; members with receiveHelp read and acknowledge. */
  listHelpRequests(elderId: string, max?: number): Promise<HelpRequest[]>;
  saveHelpRequest(elderId: string, request: HelpRequest): Promise<void>;
  acknowledgeHelpRequest(elderId: string, requestId: string): Promise<void>;

  /** Each person's own reminder preferences (timezone, quiet hours, kinds, channels). Null = never saved. */
  /** Medical profile, hospitals, doctors and emergency contacts. Null = not set up. */
  getMedical(elderId: string): Promise<MedicalProfile | null>;
  saveMedical(elderId: string, profile: MedicalProfile): Promise<void>;

  getNotifyPrefs(uid: string): Promise<NotifyPrefs | null>;
  saveNotifyPrefs(uid: string, prefs: NotifyPrefs): Promise<void>;
}
