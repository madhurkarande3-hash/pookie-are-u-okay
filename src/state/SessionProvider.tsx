"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Actor, CircleMember, ElderProfile } from "@/lib/types";
import type { Repository } from "@/lib/data/repository";
import { DEMO_ELDER_ID, DemoRepository } from "@/lib/data/demoRepository";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { AuthUser } from "@/lib/firebase/auth";

const DEMO_PERSONA_KEY = "pookie.demo.persona";

export type Session =
  | { status: "loading" }
  | { status: "signedOut" }
  /** Signed in, but not yet an elder or a Care Circle member. */
  | { status: "needsSetup"; user: AuthUser }
  | { status: "ready"; actor: Actor; elderId: string };

interface SessionContextValue {
  mode: "demo" | "firebase";
  session: Session;
  repo: Repository | null;
  /** The elder this session is about (null until onboarding creates it, or when access is paused). */
  elder: ElderProfile | null;
  elderLoaded: boolean;
  saveElder: (profile: ElderProfile) => Promise<void>;
  /** Re-reads the account, membership and elder profile. */
  refresh: () => Promise<void>;
  /** Demo Mode only. */
  demo: {
    personaId: string;
    setPersona: (id: string) => void;
    activeMembers: () => CircleMember[];
    simulateAcceptance: (memberId: string) => void;
    simulateDecline: (memberId: string) => void;
    /** Fills Demo Mode with fictional sample data and signs in as the elder. */
    loadSample: () => Promise<void>;
  } | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function memberActor(member: CircleMember): Actor {
  return { uid: member.id, name: member.name, role: member.role, status: member.status, permissions: member.permissions };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const mode = isFirebaseConfigured ? "firebase" : "demo";
  const [session, setSession] = useState<Session>({ status: "loading" });
  const [repo, setRepo] = useState<Repository | null>(null);
  const [elder, setElder] = useState<ElderProfile | null>(null);
  const [elderLoaded, setElderLoaded] = useState(false);
  const [personaId, setPersonaId] = useState("elder");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  // Repositories read the current actor through this ref so they never go stale.
  const actorRef = useRef<Actor | null>(null);
  actorRef.current = session.status === "ready" ? session.actor : null;
  const demoRepoRef = useRef<DemoRepository | null>(null);

  const loadElder = useCallback(async (repository: Repository, elderId: string) => {
    try {
      setElder(await repository.getElder(elderId));
    } catch {
      setElder(null); // e.g. a member whose access is paused
    } finally {
      setElderLoaded(true);
    }
  }, []);

  const resolveDemo = useCallback(
    (persona: string) => {
      const demoRepo = demoRepoRef.current;
      if (!demoRepo) return;
      const profile = demoRepo.peekElder();
      const member = persona === "elder" ? null : demoRepo.peekMember(persona);
      const actor: Actor = member ? memberActor(member) : { uid: DEMO_ELDER_ID, name: profile?.preferredName ?? "", role: "elder" };
      actorRef.current = actor;
      setSession({ status: "ready", actor, elderId: DEMO_ELDER_ID });
      void loadElder(demoRepo, DEMO_ELDER_ID);
    },
    [loadElder],
  );

  const resolveFirebase = useCallback(
    async (user: AuthUser | null) => {
      if (!user) {
        setSession({ status: "signedOut" });
        setElder(null);
        setElderLoaded(true);
        return;
      }
      const auth = await import("@/lib/firebase/auth");
      const { FirebaseRepository } = await import("@/lib/data/firebaseRepository");
      const repository = new FirebaseRepository(() => actorRef.current);
      setRepo(repository);
      try {
        const record = await auth.getUserRecord(user.uid);
        if (!record) {
          setSession({ status: "needsSetup", user });
          setElderLoaded(true);
          return;
        }
        let actor: Actor;
        if (record.role === "elder") {
          actor = { uid: user.uid, name: record.name, role: "elder" };
        } else {
          const membership = await auth.getMembership(record.elderId, user.uid);
          if (!membership) {
            setSession({ status: "needsSetup", user });
            setElderLoaded(true);
            return;
          }
          actor = memberActor(membership);
        }
        actorRef.current = actor;
        setSession({ status: "ready", actor, elderId: record.elderId });
        await loadElder(repository, record.elderId);
      } catch {
        setSession({ status: "needsSetup", user });
        setElderLoaded(true);
      }
    },
    [loadElder],
  );

  useEffect(() => {
    if (mode === "demo") {
      const demoRepo = new DemoRepository(window.localStorage, () => actorRef.current);
      demoRepoRef.current = demoRepo;
      setRepo(demoRepo);
      const stored = window.localStorage.getItem(DEMO_PERSONA_KEY) ?? "elder";
      const persona = stored !== "elder" && demoRepo.peekMember(stored)?.status === "active" ? stored : "elder";
      setPersonaId(persona);
      resolveDemo(persona);
      return undefined;
    }
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void import("@/lib/firebase/auth").then((auth) => {
      if (cancelled) return;
      unsubscribe = auth.subscribeAuth((user) => {
        setAuthUser(user);
        void resolveFirebase(user);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [mode, resolveDemo, resolveFirebase]);

  const refresh = useCallback(async () => {
    if (mode === "demo") resolveDemo(personaId);
    else await resolveFirebase(authUser);
  }, [mode, personaId, authUser, resolveDemo, resolveFirebase]);

  const saveElder = useCallback(
    async (profile: ElderProfile) => {
      if (!repo) return;
      await repo.saveElder(profile);
      setElder(profile);
      if (session.status === "ready" && session.actor.role === "elder" && session.actor.name !== profile.preferredName) {
        setSession({ ...session, actor: { ...session.actor, name: profile.preferredName } });
      }
    },
    [repo, session],
  );

  const demo = useMemo<SessionContextValue["demo"]>(() => {
    if (mode !== "demo") return null;
    return {
      personaId,
      setPersona: (id: string) => {
        window.localStorage.setItem(DEMO_PERSONA_KEY, id);
        setPersonaId(id);
        resolveDemo(id);
      },
      activeMembers: () => demoRepoRef.current?.peekCircle().filter((m) => m.status === "active") ?? [],
      simulateAcceptance: (memberId: string) => demoRepoRef.current?.simulateAcceptance(memberId),
      simulateDecline: (memberId: string) => demoRepoRef.current?.simulateDecline(memberId),
      loadSample: async () => {
        demoRepoRef.current?.loadSample();
        window.localStorage.setItem(DEMO_PERSONA_KEY, "elder");
        setPersonaId("elder");
        resolveDemo("elder");
      },
    };
  }, [mode, personaId, resolveDemo]);

  const value = useMemo<SessionContextValue>(
    () => ({ mode, session, repo, elder, elderLoaded, saveElder, refresh, demo }),
    [mode, session, repo, elder, elderLoaded, saveElder, refresh, demo],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

/** For screens that only render once a session exists (inside the app shell). */
export function useReadySession(): { actor: Actor; elderId: string; repo: Repository; elder: ElderProfile | null } {
  const { session, repo, elder } = useSession();
  if (session.status !== "ready" || !repo) throw new Error("Session is not ready");
  return { actor: session.actor, elderId: session.elderId, repo, elder };
}
