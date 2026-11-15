/**
 * Fictional sample data for Demo Mode, so a first-time viewer (or a judge)
 * can see every screen filled in. Every name and detail here is invented;
 * no real person's information is used.
 */
import type {
  Appointment,
  CareSchedule,
  CareSummary,
  Checkin,
  CircleMember,
  DoseLog,
  ElderProfile,
  LifebookEntry,
  Medication,
} from "@/lib/types";
import { addDays, toDateKey } from "@/lib/domain/dates";
import { doseLogId } from "@/lib/domain/medication";
import { NO_PERMISSIONS } from "@/lib/domain/permissions";

export const SAMPLE_ELDER_NAME = "Asha";

export interface SampleData {
  elder: ElderProfile;
  circle: CircleMember[];
  medications: Medication[];
  doseLogs: DoseLog[];
  appointments: Appointment[];
  checkins: Checkin[];
  lifebook: LifebookEntry[];
  schedules: CareSchedule[];
  summaries: CareSummary[];
}

export function buildSample(elderId: string, now: Date): SampleData {
  const today = toDateKey(now);
  const yesterday = addDays(today, -1);
  const iso = (dateKey: string, time = "09:00") =>
    new Date(`${dateKey}T${time}:00`).toISOString();
  const elderSource = {
    type: "self" as const,
    byUid: elderId,
    byName: SAMPLE_ELDER_NAME,
  };
  const consent = {
    aiPersonalization: true,
    saveSummaries: true,
    reminders: true,
    sharingPaused: false,
    updatedAt: now.toISOString(),
  };

  const elder: ElderProfile = {
    id: elderId,
    fullName: "Asha Kulkarni",
    preferredName: SAMPLE_ELDER_NAME,
    pookie: "sweet",
    companion: "granny",
    language: "en",
    phone: "+91 90000 00000",
    consent,
    onboarded: true,
    createdAt: iso(addDays(today, -30)),
  };

  const circle: CircleMember[] = [
    {
      id: "priya.sample@example.com",
      name: "Priya",
      email: "priya.sample@example.com",
      role: "family",
      status: "active",
      invitedAt: iso(addDays(today, -20)),
      permissions: {
        ...NO_PERMISSIONS,
        viewMedications: true,
        viewAppointments: true,
        viewCheckins: true,
        viewSummaries: true,
        viewLifebook: true,
        contributeLifebook: true,
        proposeSchedule: true,
        receiveHelp: true,
      },
    },
    {
      id: "ravi.sample@example.com",
      name: "Ravi",
      email: "ravi.sample@example.com",
      role: "caregiver",
      status: "active",
      invitedAt: iso(addDays(today, -15)),
      permissions: {
        ...NO_PERMISSIONS,
        viewMedications: true,
        viewAppointments: true,
        manageCare: true,
        receiveHelp: true,
      },
    },
    {
      id: "arjun.sample@example.com",
      name: "Arjun",
      email: "arjun.sample@example.com",
      role: "family",
      status: "invited",
      invitedAt: iso(addDays(today, -1)),
      permissions: { ...NO_PERMISSIONS, viewAppointments: true },
    },
  ];

  const base = {
    notes: "",
    active: true,
    createdAt: iso(addDays(today, -30)),
    startDate: addDays(today, -30),
    endDate: null,
  };
  const medications: Medication[] = [
    {
      ...base,
      id: "med-amlodipine",
      name: "Amlodipine",
      dose: "5 mg, 1 tablet",
      times: ["08:00"],
      notes: "After breakfast",
      frequency: { kind: "daily" },
    },
    {
      ...base,
      id: "med-metformin",
      name: "Metformin",
      dose: "500 mg",
      times: ["08:30", "20:30"],
      notes: "With food",
      frequency: { kind: "daily" },
    },
    {
      ...base,
      id: "med-vitd",
      name: "Vitamin D",
      dose: "1 capsule",
      times: ["10:00"],
      frequency: { kind: "weekdays", days: [0] },
    },
  ];
  const log = (
    medId: string,
    dateKey: string,
    time: string,
    status: DoseLog["status"],
  ): DoseLog => ({
    id: doseLogId(dateKey, medId, time),
    medicationId: medId,
    dateKey,
    time,
    status,
    confirmedAt: iso(dateKey, time),
  });
  const doseLogs: DoseLog[] = [
    log("med-amlodipine", yesterday, "08:00", "taken"),
    log("med-metformin", yesterday, "08:30", "taken"),
    log("med-metformin", yesterday, "20:30", "missed"),
  ];

  const appointments: Appointment[] = [
    {
      id: "appt-heart",
      doctor: "Dr. Mehta (heart clinic)",
      date: addDays(today, 3),
      time: "11:00",
      location: "City Care Hospital, 2nd floor",
      notes: "Ask about the evening dizziness",
      prep: "Bring the last blood test report and the medicine list",
      remind: true,
      status: "scheduled",
      shareWithCircle: true,
      createdAt: iso(addDays(today, -5)),
    },
    {
      id: "appt-eyes",
      doctor: "Eye check-up",
      date: addDays(today, 12),
      time: "16:30",
      location: "Vision Plus, Kothrud",
      notes: "",
      prep: "",
      remind: true,
      status: "scheduled",
      shareWithCircle: false,
      createdAt: iso(addDays(today, -2)),
    },
    {
      id: "appt-gp",
      doctor: "Dr. Joshi (family doctor)",
      date: addDays(today, -10),
      time: "10:00",
      location: "",
      notes: "Routine visit",
      prep: "",
      remind: false,
      status: "completed",
      shareWithCircle: true,
      createdAt: iso(addDays(today, -20)),
    },
  ];

  const checkins: Checkin[] = [
    {
      id: "chk-1",
      dateKey: yesterday,
      createdAt: iso(yesterday, "09:10"),
      mood: 4,
      sleep: 3,
      energy: 4,
      assistance: "none",
      note: "Nice walk with Rohan.",
      shareWithCircle: true,
      scheduleId: "sched-morning",
    },
    {
      id: "chk-2",
      dateKey: yesterday,
      createdAt: iso(yesterday, "20:05"),
      mood: 3,
      sleep: 3,
      energy: 2,
      assistance: "little",
      note: "A bit tired.",
      shareWithCircle: false,
      scheduleId: "sched-evening",
    },
  ];

  const sched = (
    id: string,
    label: string,
    time: string,
    status: CareSchedule["status"],
    by: CareSchedule["proposedBy"],
  ): CareSchedule => ({
    id,
    label,
    time,
    status,
    proposedBy: by,
    originalTime: null,
    createdAt: iso(addDays(today, -20)),
    decidedAt: status === "proposed" ? null : iso(addDays(today, -20)),
    onDate: null,
  });
  const elderBy = {
    uid: elderId,
    name: SAMPLE_ELDER_NAME,
    role: "elder" as const,
  };
  const schedules: CareSchedule[] = [
    sched("sched-morning", "Morning check-in", "09:00", "accepted", elderBy),
    sched(
      "sched-afternoon",
      "Afternoon check-in",
      "14:00",
      "accepted",
      elderBy,
    ),
    sched("sched-evening", "Evening check-in", "20:00", "accepted", elderBy),
    sched("sched-call", "Video call with Priya", "19:30", "proposed", {
      uid: "priya.sample@example.com",
      name: "Priya",
      role: "family",
    }),
  ];

  const memory = (
    id: string,
    category: LifebookEntry["category"],
    title: string,
    detail: string,
    extra: Partial<LifebookEntry> = {},
  ): LifebookEntry => ({
    id,
    category,
    title,
    detail,
    source: elderSource,
    confirmed: true,
    aiAllowed: true,
    shareWithCircle: true,
    createdAt: iso(addDays(today, -25)),
    updatedAt: iso(addDays(today, -25)),
    ...extra,
  });
  const lifebook: LifebookEntry[] = [
    memory(
      "lb-priya",
      "people",
      "Priya",
      "My daughter. Lives in Bengaluru and calls every Sunday.",
      { relationship: "daughter" },
    ),
    memory(
      "lb-rohan",
      "people",
      "Rohan",
      "My grandson. Loves cricket and my besan laddoos.",
      { relationship: "grandson" },
    ),
    memory(
      "lb-wedding",
      "stories",
      "Our wedding in Nashik",
      "It rained all day and everyone danced anyway.",
      { when: "1978", people: [] },
    ),
    memory(
      "lb-songs",
      "favorites",
      "Old Hindi film songs",
      "Especially the ones my husband used to hum on Sunday mornings.",
    ),
    memory(
      "lb-walk",
      "everyday",
      "Morning walk in the park",
      "After tea, around 7. Sometimes Rohan joins.",
    ),
    memory(
      "lb-anniv",
      "milestones",
      "Wedding anniversary",
      "We always went to the temple and then had kulfi.",
      { when: "12 May" },
    ),
    memory(
      "lb-home",
      "places",
      "Our home in Pune",
      "We moved here when Priya was little. The neem tree is still there.",
      { when: "since 1982", shareWithCircle: false },
    ),
    memory(
      "lb-cricket",
      "stories",
      "Rohan's first cricket match",
      "Asha watched Rohan's first school match and cheered the loudest.",
      {
        confirmed: false,
        aiAllowed: false,
        shareWithCircle: false,
        people: ["lb-rohan"],
        source: {
          type: "circle",
          byUid: "priya.sample@example.com",
          byName: "Priya",
        },
      },
    ),
  ];

  const summaries: CareSummary[] = [
    {
      id: "sum-1",
      dateKey: yesterday,
      createdAt: iso(yesterday, "09:20"),
      feeling: "good",
      note: "Talked about the garden and Rohan's match.",
      exchanges: 6,
      shared: true,
      scheduleId: "sched-morning",
    },
  ];

  return {
    elder,
    circle,
    medications,
    doseLogs,
    appointments,
    checkins,
    lifebook,
    schedules,
    summaries,
  };
}

/** Fictional healthcare details for Demo Mode. Labelled so nobody mistakes them for a real listing. */
export function buildSampleMedical(
  now: Date,
): import("@/lib/types").MedicalProfile {
  return {
    bloodGroup: "B+",
    allergies: "Penicillin (sample)",
    conditions: "High blood pressure (sample)",
    instructions: "Keeps reading glasses by the bed. (sample)",
    emergencyContacts: [
      {
        id: "ec-priya",
        name: "Priya",
        relationship: "Daughter",
        phone: "+91 90000 00001",
      },
      {
        id: "ec-ravi",
        name: "Ravi",
        relationship: "Son",
        phone: "+91 90000 00002",
      },
    ],
    hospitals: [
      {
        id: "h-sample",
        name: "Sample City Hospital (fictional)",
        address: "Example Road, Pune",
        phone: "+91 20 0000 0000",
        emergencyPhone: "+91 20 0000 0001",
        departments: "Cardiology, General medicine",
        notes: "Demo entry — not a real hospital.",
        source: "manual",
      },
    ],
    doctors: [
      {
        id: "d-rao",
        name: "Dr Meera Rao (fictional)",
        specialty: "Cardiologist",
        hospitalId: "h-sample",
        phone: "+91 20 0000 0002",
        notes: "",
      },
    ],
    preferredHospitalId: "h-sample",
    preferredDoctorId: "d-rao",
    updatedAt: now.toISOString(),
  };
}
