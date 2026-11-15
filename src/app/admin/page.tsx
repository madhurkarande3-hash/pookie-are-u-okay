"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import {
  EmptyState,
  ErrorNote,
  Loading,
  Notice,
  StatusBadge,
} from "@/components/ui/Feedback";
import { TextField } from "@/components/ui/Field";
import { AiDiagnostics } from "@/components/AiDiagnostics";
import {
  byAttention,
  summarisePatient,
  type PatientSummary,
} from "@/lib/careTeam/summary";
import {
  DEMO_ADMIN,
  fetchCareTeamPatients,
  hasCareTeamClaim,
  loadPatient,
} from "@/lib/careTeam/load";
import { formatDate, formatTime, toDateKey } from "@/lib/domain/dates";
import { signInEmail, signOut } from "@/lib/firebase/auth";
import { usePrefs } from "@/state/PrefsProvider";
import { useSession } from "@/state/SessionProvider";

type Gate = "signedOut" | "checking" | "denied" | "ok";

/**
 * Care-team dashboard for hospitals and home-care teams. Sign-in needs the
 * `careTeam` claim; each patient's data still follows that patient's own
 * invitation and permissions, so the team sees only what each person shared.
 */
export default function AdminPage() {
  const { t, locale } = usePrefs();
  const { mode, session, repo, demo } = useSession();
  const [gate, setGate] = useState<Gate>("signedOut");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [rows, setRows] = useState<PatientSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Firebase: an already signed-in care-team account skips the form.
  useEffect(() => {
    if (
      mode !== "firebase" ||
      session.status !== "ready" ||
      gate !== "signedOut"
    )
      return;
    setGate("checking");
    void hasCareTeamClaim().then((ok) => setGate(ok ? "ok" : "denied"));
  }, [mode, session.status, gate]);

  const load = useCallback(async () => {
    if (!repo) return;
    setLoading(true);
    setError(null);
    try {
      const today = toDateKey(new Date());
      const ids =
        mode === "firebase"
          ? await fetchCareTeamPatients()
          : session.status === "ready"
            ? [session.elderId]
            : [];
      const data = await Promise.all(
        ids.map((id) => loadPatient(repo, id, today)),
      );
      setRows(
        data
          .map((d) => summarisePatient(d, today, new Date()))
          .sort(byAttention),
      );
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [repo, mode, session]);

  useEffect(() => {
    if (gate === "ok" && session.status === "ready") void load();
  }, [gate, session.status, load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (mode === "demo") {
      if (
        email.trim().toLowerCase() !== DEMO_ADMIN.email ||
        password !== DEMO_ADMIN.password
      )
        return setLoginError(t("admin.badLogin"));
      await demo?.loadSample();
      const member =
        demo?.activeMembers().find((m) => m.permissions.receiveHelp) ??
        demo?.activeMembers()[0];
      if (member) demo?.setPersona(member.id);
      return setGate("ok");
    }
    setGate("checking");
    try {
      await signInEmail(email.trim(), password);
      setGate((await hasCareTeamClaim()) ? "ok" : "denied");
    } catch {
      setGate("signedOut");
      setLoginError(t("admin.badLogin"));
    }
  };

  return (
    <main id="main" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <PageHeader title={t("admin.title")} subtitle={t("admin.subtitle")} />
      {mode === "demo" ? (
        <Notice>
          <p className="font-bold">{t("admin.demoNote")}</p>
          <p>
            {t("admin.demoCreds", {
              email: DEMO_ADMIN.email,
              password: DEMO_ADMIN.password,
            })}
          </p>
        </Notice>
      ) : null}

      {gate === "signedOut" ? (
        <Card className="max-w-md" aria-labelledby="admin-login">
          <form onSubmit={submit} className="space-y-4">
            <h2 id="admin-login" className="text-xl font-extrabold">
              {t("admin.signIn")}
            </h2>
            <TextField
              label={t("auth.email")}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label={t("auth.password")}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit">{t("admin.signIn")}</Button>
            {loginError ? <p role="alert" className="font-bold text-danger">{loginError}</p> : null}
          </form>
        </Card>
      ) : null}

      {gate === "checking" ? <Loading /> : null}

      {gate === "denied" ? (
        <Card className="space-y-3">
          <p className="font-bold">{t("admin.denied")}</p>
          <Button
            variant="secondary"
            onClick={() => void signOut().then(() => setGate("signedOut"))}
          >
            {t("admin.signOut")}
          </Button>
        </Card>
      ) : null}

      {gate === "ok" ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon="arrow"
              busy={loading}
              onClick={() => void load()}
            >
              {t("common.retry")}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setRows(null);
                setGate("signedOut");
                if (mode === "firebase") void signOut();
              }}
            >
              {t("admin.signOut")}
            </Button>
          </div>
          {error ? (
            <ErrorNote error={error} onRetry={() => void load()} />
          ) : null}
          {loading && !rows ? <Loading /> : null}
          {rows && rows.length === 0 ? (
            <EmptyState
              icon="users"
              title={t("admin.emptyTitle")}
              body={t("admin.emptyBody")}
            />
          ) : null}
          {rows && rows.length > 0 ? (
            <div className="overflow-x-auto rounded-card border-2 border-line bg-surface">
              <table className="w-full min-w-[640px] text-left">
                <caption className="sr-only">{t("admin.tableCaption")}</caption>
                <thead className="border-b-2 border-line">
                  <tr>
                    {[
                      "admin.colPatient",
                      "admin.colHelp",
                      "admin.colDoses",
                      "admin.colCheckin",
                      "admin.colVisit",
                    ].map((k) => (
                      <th key={k} scope="col" className="p-3 font-extrabold">
                        {t(k as "admin.colPatient")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.elderId}
                      className="border-b border-line align-top last:border-0"
                    >
                      <th scope="row" className="p-3 font-extrabold">
                        {r.sharingPaused ? t("admin.paused") : r.name}
                      </th>
                      <td className="p-3">
                        {r.openHelp ? (
                          <StatusBadge tone="danger" icon="bell">
                            {t("admin.openHelp", { count: r.openHelp })}
                          </StatusBadge>
                        ) : (
                          t("admin.none")
                        )}
                      </td>
                      <td className="p-3">
                        {r.doses
                          ? t("admin.doses", {
                              taken: r.doses.taken,
                              missed: r.doses.missed,
                              unconfirmed: r.doses.unconfirmed,
                            })
                          : t("admin.notShared")}
                      </td>
                      <td className="p-3">
                        {r.lastCheckin
                          ? `${formatDate(r.lastCheckin.dateKey, locale)} · ${t(`checkin.mood.${r.lastCheckin.mood}`)}`
                          : t("admin.notShared")}
                      </td>
                      <td className="p-3">
                        {r.nextVisit
                          ? `${r.nextVisit.doctor} · ${formatDate(r.nextVisit.date, locale)} ${formatTime(r.nextVisit.time, locale)}`
                          : t("admin.none")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="text-sm text-ink-soft">{t("admin.privacy")}</p>
          {mode === "demo" ? null : <AiDiagnostics />}
        </>
      ) : null}

      <Link href="/" className="font-bold underline underline-offset-4">
        {t("admin.back")}
      </Link>
    </main>
  );
}
