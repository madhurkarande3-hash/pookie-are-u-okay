/** Core data model. Field names match the Firestore documents one-to-one. */

export type Language = "en" | "hi";
export type PookieTheme = "sweet" | "cool";
/** Who the elder talks to. Independent of the visual theme (themes are never tied to gender or age). */
export type Companion = "pookie" | "granny" | "kaka";
export type TextSize = "normal" | "large" | "xlarge";

export type Role = "elder" | "family" | "caregiver";
export type MemberRole = Exclude<Role, "elder">;
export type MemberStatus = "invited" | "declined" | "active" | "paused";

/** What a Care Circle member may do. Every key is granted by the elder, one by one. */
export interface MemberPermissions {
  viewMedications: boolean;
  viewAppointments: boolean;
  viewCheckins: boolean;
  viewSummaries: boolean;
  viewLifebook: boolean;
  contributeLifebook: boolean;
  proposeSchedule: boolean;
  /** Add and edit medications and appointments on the elder's behalf. */
  manageCare: boolean;
  /** Be told when the elder presses "I'd like some help", and reply that they are on it. */
  receiveHelp: boolean;
}
export type PermissionKey = keyof MemberPermissions;

export interface Consent {
  /** Pookie may use confirmed LifeBook entries to personalise conversation. */
  aiPersonalization: boolean;
  /** Conversation summaries may be saved after the elder confirms each one. */
  saveSummaries: boolean;
  /** Reminders for medicines and check-ins on this device. */
  reminders: boolean;
  /** Master switch: when true no Care Circle member can read anything. */
  sharingPaused: boolean;
  updatedAt: string;
  /** Who gives consent: the elder alone, the elder with a supporter, or a lawful guardian. Absent = self. */
  decisionMode?: DecisionMode;
}

export type DecisionMode = "self" | "supported" | "guardian";

/** The person who helps with (supported) or gives (guardian) consent. Recorded, never assumed. */
export interface Guardian {
  name: string;
  relationship: string;
  /** The guardian confirmed they are legally allowed to decide for the elder. Required in guardian mode. */
  attested: boolean;
  recordedAt: string;
}

/** Wandering safety: only while Pookie is open and only with recorded consent. */
export interface SafeZone {
  enabled: boolean;
  lat: number;
  lng: number;
  radiusM: number;
  consentBy: "self" | "guardian";
  consentAt: string;
}

export interface ElderProfile {
  id: string;
  fullName: string;
  preferredName: string;
  pookie: PookieTheme;
  /** Absent on profiles created before companions existed: treated as "pookie". */
  companion?: Companion;
  /** Optional phone number, shown to active Care Circle members so they can call. */
  phone?: string;
  /** Plain words for "where am I", e.g. "your home in Ravet, Pune". */
  homeLabel?: string;
  guardian?: Guardian | null;
  safeZone?: SafeZone | null;
  language: Language;
  consent: Consent;
  onboarded: boolean;
  createdAt: string;
}

export interface CircleMember {
  /** uid for active members, lower-cased email for pending invitations. */
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  permissions: MemberPermissions;
  invitedAt: string;
}

/** The person using the app right now. */
export interface Actor {
  uid: string;
  name: string;
  role: Role;
  /** Present for family/caregiver actors only. */
  status?: MemberStatus;
  permissions?: MemberPermissions;
}

/** How often a medicine is taken. Absent on older records = every day. */
export type MedFrequency =
  | { kind: "daily" }
  /** 0 = Sunday … 6 = Saturday */
  | { kind: "weekdays"; days: number[] }
  /** Every N days counting from startDate (N ≥ 2). */
  | { kind: "interval"; everyDays: number };

/** A short recorded message from someone the elder knows, played with the reminder. */
export interface VoiceNote {
  media: LifebookMedia;
  byName: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  /** Times on each scheduled day, "HH:mm", sorted. */
  times: string[];
  /** How to take it, e.g. "after food". */
  notes: string;
  active: boolean;
  createdAt: string;
  frequency?: MedFrequency;
  /** First day it is taken ("YYYY-MM-DD"). Absent = since it was added. */
  startDate?: string;
  /** Last day it is taken, inclusive. Null/absent = ongoing. */
  endDate?: string | null;
  /** e.g. "Maa, time for your BP tablet" in her daughter's voice. */
  voiceNote?: VoiceNote | null;
}

/** Only an explicit action by the elder creates a log. Silence never does. */
export type DoseLogStatus = "taken" | "missed";
export interface DoseLog {
  /** `${dateKey}_${medicationId}_${time}` — one log per scheduled dose. */
  id: string;
  medicationId: string;
  dateKey: string;
  time: string;
  status: DoseLogStatus;
  confirmedAt: string;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled";
export interface Appointment {
  id: string;
  doctor: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  /** What to do beforehand, e.g. "fasting from 10 pm", "bring last reports". */
  prep?: string;
  remind: boolean;
  /** Absent on older records = scheduled. */
  status?: AppointmentStatus;
  /** Visible to members who may view appointments. Members who manage care always see it. Absent = shared. */
  shareWithCircle?: boolean;
  createdAt: string;
}

export type Scale = 1 | 2 | 3 | 4 | 5;
export type AssistanceLevel = "none" | "little" | "lot";
export interface Checkin {
  id: string;
  dateKey: string;
  createdAt: string;
  mood: Scale;
  sleep: Scale;
  energy: Scale;
  assistance: AssistanceLevel;
  note: string;
  shareWithCircle: boolean;
  scheduleId: string | null;
}

export type LifebookCategory = "people" | "stories" | "favorites" | "everyday" | "milestones" | "places" | "photos" | "voice";
export interface LifebookSource {
  type: "self" | "circle";
  byUid: string;
  byName: string;
}
/** A photo or voice recording attached to a memory. */
export interface LifebookMedia {
  kind: "photo" | "audio";
  contentType: string;
  /** Cloud Storage path (real server). */
  path?: string;
  /** Inline data (Demo Mode only; stays in this browser). */
  dataUrl?: string;
}

/** One earlier version of a corrected memory, kept so corrections are visible. */
export interface LifebookRevision {
  at: string;
  byName: string;
  title: string;
  detail: string;
}

export interface LifebookEntry {
  /** For people: a number to call from Simple Mode. */
  phone?: string;
  id: string;
  category: LifebookCategory;
  title: string;
  detail: string;
  /** Free-form "when": a date, a year or "every Sunday". */
  when?: string;
  /** For people: how they are related ("daughter", "school friend"). */
  relationship?: string;
  /** Ids of "people" entries this memory is about. */
  people?: string[];
  media?: LifebookMedia | null;
  /** Visible to members allowed to view the LifeBook. Absent on older entries = shared. */
  shareWithCircle?: boolean;
  /** Earlier versions, newest first (at most 10). */
  history?: LifebookRevision[];
  source: LifebookSource;
  /** Entries from the Care Circle stay unconfirmed until the elder approves them. */
  confirmed: boolean;
  /** The elder may keep an entry in the book but out of AI conversation. */
  aiAllowed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ScheduleStatus = "proposed" | "accepted" | "declined" | "paused";
export interface CareSchedule {
  id: string;
  label: string;
  time: string;
  status: ScheduleStatus;
  proposedBy: { uid: string; name: string; role: Role };
  /** Set when the elder accepted with a different time than proposed. */
  originalTime: string | null;
  createdAt: string;
  decidedAt: string | null;
  /** A one-off check-in for this day only ("YYYY-MM-DD"), e.g. a follow-up. Absent/null = every day. */
  onDate?: string | null;
}

/** Sent only when the elder presses "I'd like some help". Never created automatically. */
export type HelpStatus = "open" | "acknowledged" | "resolved";
export interface HelpRequest {
  id: string;
  /** "help" = the elder pressed the button; "safezone" = left the safe area they agreed to. Absent = help. */
  kind?: "help" | "safezone";
  createdAt: string;
  /** Optional words from the elder, written for their Care Circle. */
  message: string;
  status: HelpStatus;
  acknowledgedBy: { uid: string; name: string } | null;
  acknowledgedAt: string | null;
}

export type Feeling = "good" | "okay" | "low";
/** Structured, elder-confirmed record of a conversation. Never a transcript. */
export interface CareSummary {
  id: string;
  dateKey: string;
  createdAt: string;
  feeling: Feeling;
  note: string;
  exchanges: number;
  shared: boolean;
  scheduleId: string | null;
}

export class PermissionError extends Error {
  constructor(action: string) {
    super(`Not permitted: ${action}`);
    this.name = "PermissionError";
  }
}
export class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Healthcare details the elder (or someone with manageCare) keeps. Never sent to AI. */
export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

/** Entered by hand; Pookie never invents hospitals, services or schedules. */
export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  departments: string;
  notes: string;
  /** Where this came from. Only "manual" exists today; verified listings would be labelled separately. */
  source: "manual";
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  hospitalId: string | null;
  phone: string;
  notes: string;
}

export interface MedicalProfile {
  bloodGroup: string;
  allergies: string;
  conditions: string;
  /** e.g. "Carries an inhaler". Written by the elder or care team, as given by their doctor. */
  instructions: string;
  emergencyContacts: EmergencyContact[];
  hospitals: Hospital[];
  doctors: Doctor[];
  preferredHospitalId: string | null;
  preferredDoctorId: string | null;
  updatedAt: string;
}
