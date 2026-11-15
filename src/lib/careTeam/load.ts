import type { Repository } from "@/lib/data/repository";
import type { PatientData } from "./summary";

/** A read that the patient's sharing rules refuse becomes null, never an error for the whole dashboard. */
async function allowed<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/** Loads one patient's dashboard data. Every read goes through the normal per-patient permissions. */
export async function loadPatient(repo: Repository, elderId: string, todayKey: string): Promise<PatientData> {
  const [elder, medications, doseLogs, help, checkins, appointments] = await Promise.all([
    allowed(() => repo.getElder(elderId)),
    allowed(() => repo.listMedications(elderId)),
    allowed(() => repo.listDoseLogs(elderId, todayKey)),
    allowed(() => repo.listHelpRequests(elderId, 20)),
    allowed(() => repo.listCheckins(elderId, 1)),
    allowed(() => repo.listAppointments(elderId)),
  ]);
  return { elderId, elder, medications, doseLogs, help, checkins, appointments };
}

/** Firebase mode: asks the server which patients this care-team account may see. */
export async function fetchCareTeamPatients(): Promise<string[]> {
  const [{ httpsCallable }, { getFirebase }] = await Promise.all([import("firebase/functions"), import("@/lib/firebase/client")]);
  const call = httpsCallable<Record<string, never>, { elderIds: string[] }>(getFirebase().functions, "careTeamPatients");
  const res = await call({});
  return res.data.elderIds;
}

/** Firebase mode: true when the signed-in account carries the careTeam claim. */
export async function hasCareTeamClaim(): Promise<boolean> {
  const { getFirebase } = await import("@/lib/firebase/client");
  const user = getFirebase().auth.currentUser;
  if (!user) return false;
  const token = await user.getIdTokenResult(true);
  return token.claims.careTeam === true;
}

export const DEMO_ADMIN = { email: "care@demo.pookie", password: "demo-care-team" } as const;
