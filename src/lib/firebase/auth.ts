import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
} from "firebase/auth";
import { collectionGroup, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import type { CircleMember, MemberPermissions, MemberRole, Role } from "@/lib/types";
import { getFirebase } from "./client";

export interface AuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/** users/{uid}: which elder this account belongs to, and in what role. Grants nothing by itself. */
export interface UserRecord {
  role: Role;
  elderId: string;
  name: string;
}

export interface PendingInvite {
  elderId: string;
  elderName: string;
  email: string;
  name: string;
  role: MemberRole;
  permissions: MemberPermissions;
  invitedAt: string;
}

export function subscribeAuth(onChange: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(getFirebase().auth, (u) =>
    onChange(u ? { uid: u.uid, email: (u.email ?? "").toLowerCase(), emailVerified: u.emailVerified, name: u.displayName ?? "" } : null),
  );
}

export async function signInEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebase().auth, email, password);
}

export async function signUpEmail(name: string, email: string, password: string): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(getFirebase().auth, email, password);
  await updateProfile(user, { displayName: name });
  await sendEmailVerification(user);
}

/** Sends Firebase's password-reset email. Errors for unknown emails are swallowed so the UI never reveals who has an account. */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getFirebase().auth, email);
  } catch (err) {
    const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
    if (code !== "auth/user-not-found" && code !== "auth/invalid-email") throw err;
  }
}

export async function signInGoogle(): Promise<void> {
  await signInWithPopup(getFirebase().auth, new GoogleAuthProvider());
}

export async function resendVerification(): Promise<void> {
  const user = getFirebase().auth.currentUser;
  if (user) await sendEmailVerification(user);
}

/** Refreshes the ID token so a just-verified email is visible to security rules. */
export async function refreshUser(): Promise<boolean> {
  const user = getFirebase().auth.currentUser;
  if (!user) return false;
  await user.reload();
  await user.getIdToken(true);
  return user.emailVerified;
}

export async function signOut(): Promise<void> {
  await fbSignOut(getFirebase().auth);
}

export async function getUserRecord(uid: string): Promise<UserRecord | null> {
  const snap = await getDoc(doc(getFirebase().db, "users", uid));
  return snap.exists() ? (snap.data() as UserRecord) : null;
}

export async function setUserRecord(uid: string, record: UserRecord): Promise<void> {
  await setDoc(doc(getFirebase().db, "users", uid), record);
}

export async function getMembership(elderId: string, uid: string): Promise<CircleMember | null> {
  const snap = await getDoc(doc(getFirebase().db, "elders", elderId, "members", uid));
  return snap.exists() ? ({ ...(snap.data() as CircleMember), id: snap.id }) : null;
}

/** Invitations addressed to this (verified) email address, across all elders. */
export async function findInvites(email: string): Promise<PendingInvite[]> {
  const q = query(collectionGroup(getFirebase().db, "invites"), where("email", "==", email), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as PendingInvite);
}

/** Declines an invitation. The elder sees it as declined and can remove it; nothing else changes. */
export async function declineInvite(invite: PendingInvite): Promise<void> {
  const { db } = getFirebase();
  await updateDoc(doc(db, "elders", invite.elderId, "invites", invite.email), { status: "declined", declinedAt: new Date().toISOString() });
}

/**
 * Accepts an invitation atomically. The rules only allow the membership to be
 * created together with flipping the invite from "pending" to "accepted", and
 * only with exactly the role and permissions the elder chose.
 */
export async function acceptInvite(user: AuthUser, invite: PendingInvite): Promise<void> {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  const member: CircleMember = {
    id: user.uid,
    name: invite.name,
    email: invite.email,
    role: invite.role,
    status: "active",
    permissions: invite.permissions,
    invitedAt: invite.invitedAt,
  };
  batch.set(doc(db, "elders", invite.elderId, "members", user.uid), member);
  batch.update(doc(db, "elders", invite.elderId, "invites", invite.email), { status: "accepted", acceptedAt: new Date().toISOString() });
  batch.set(doc(db, "users", user.uid), { role: invite.role, elderId: invite.elderId, name: invite.name } satisfies UserRecord);
  await batch.commit();
}
