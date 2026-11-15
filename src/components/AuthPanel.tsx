"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { AuthUser, PendingInvite } from "@/lib/firebase/auth";
import { usePrefs } from "@/state/PrefsProvider";
import { useSession } from "@/state/SessionProvider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Loading, Notice } from "./ui/Feedback";
import { TextField } from "./ui/Field";

const loadAuth = () => import("@/lib/firebase/auth");

/** Email/password and Google sign-in (Firebase Authentication). */
export function SignInForm() {
  const { t } = usePrefs();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const attempt = async (work: (auth: Awaited<ReturnType<typeof loadAuth>>) => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await work(await loadAuth());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void attempt((auth) => (creating ? auth.signUpEmail(name.trim(), email.trim(), password) : auth.signInEmail(email.trim(), password)));
  };

  const sendReset = (e: FormEvent) => {
    e.preventDefault();
    void attempt(async (auth) => {
      await auth.sendPasswordReset(email.trim());
      setResetSent(true);
    });
  };

  if (resetting) {
    return (
      <Card className="w-full max-w-md text-left">
        <form onSubmit={sendReset} className="space-y-4">
          <h2 className="text-xl font-extrabold">{t("auth.resetTitle")}</h2>
          <p className="text-ink-soft">{t("auth.resetBody")}</p>
          <TextField label={t("auth.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          {resetSent ? (
            <p role="status" className="font-bold text-ok">
              {t("auth.resetSent")}
            </p>
          ) : null}
          {failed ? <p role="alert" className="font-bold text-danger">{t("auth.failed")}</p> : null}
          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" busy={busy}>
              {t("auth.resetSend")}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setResetting(false);
                setResetSent(false);
              }}
            >
              {t("auth.resetBack")}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md text-left">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-xl font-extrabold">{creating ? t("auth.createTitle") : t("auth.signInTitle")}</h2>
        {creating ? <TextField label={t("auth.name")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required /> : null}
        <TextField label={t("auth.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <TextField label={t("auth.password")} hint={creating ? t("auth.passwordHint") : undefined} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={creating ? "new-password" : "current-password"} minLength={8} required />
        {failed ? <p role="alert" className="font-bold text-danger">{t("auth.failed")}</p> : null}
        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" busy={busy}>
            {creating ? t("auth.create") : t("auth.signIn")}
          </Button>
          <Button variant="secondary" size="lg" busy={busy} onClick={() => void attempt((auth) => auth.signInGoogle())}>
            {t("auth.google")}
          </Button>
          <Button variant="quiet" onClick={() => setCreating((v) => !v)}>
            {creating ? t("auth.haveAccount") : t("auth.needAccount")}
          </Button>
          {creating ? null : (
            <Button variant="quiet" onClick={() => setResetting(true)}>
              {t("auth.forgot")}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

/** First sign-in: start as the elder, or accept a Care Circle invitation. */
export function AccountSetup({ user, onElderChosen, onJoined }: { user: AuthUser; onElderChosen: () => void; onJoined: () => void }) {
  const { t } = usePrefs();
  const { refresh } = useSession();
  const [invites, setInvites] = useState<PendingInvite[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [verified, setVerified] = useState(user.emailVerified);

  useEffect(() => {
    if (!verified) {
      setInvites([]);
      return;
    }
    let cancelled = false;
    loadAuth()
      .then((auth) => auth.findInvites(user.email))
      .then((found) => !cancelled && setInvites(found))
      .catch(() => !cancelled && setInvites([]));
    return () => {
      cancelled = true;
    };
  }, [user.email, verified]);

  const run = async (work: (auth: Awaited<ReturnType<typeof loadAuth>>) => Promise<void>, done?: () => void) => {
    setBusy(true);
    setFailed(false);
    try {
      await work(await loadAuth());
      await refresh();
      done?.();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-4 text-left">
      {!verified ? (
        <Notice tone="warn">
          <p className="font-bold">{t("auth.verifyTitle")}</p>
          <p>{t("auth.verifyBody", { email: user.email })}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" busy={busy} onClick={() => void loadAuth().then(async (auth) => setVerified(await auth.refreshUser()))}>
              {t("auth.verifyCheck")}
            </Button>
            <Button variant="quiet" onClick={() => void loadAuth().then((auth) => auth.resendVerification())}>
              {t("auth.verifyResend")}
            </Button>
          </div>
        </Notice>
      ) : null}

      <Card className="space-y-3">
        <h2 className="text-xl font-extrabold">{t("setup.elderTitle")}</h2>
        <p className="text-ink-soft">{t("setup.elderBody")}</p>
        <Button size="lg" busy={busy} onClick={() => void run((auth) => auth.setUserRecord(user.uid, { role: "elder", elderId: user.uid, name: user.name }), onElderChosen)}>
          {t("setup.elderAction")}
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-extrabold">{t("setup.inviteTitle")}</h2>
        {invites === null ? <Loading /> : null}
        {invites && invites.length === 0 ? <p className="text-ink-soft">{t("setup.noInvites", { email: user.email })}</p> : null}
        {invites?.map((invite) => (
          <div key={invite.elderId} className="space-y-2 rounded-2xl border border-line p-3">
            <p className="font-bold">{t("setup.inviteFrom", { name: invite.elderName || t("setup.someone"), role: t(`role.${invite.role}`) })}</p>
            <div className="flex flex-wrap gap-2">
              <Button busy={busy} icon="check" onClick={() => void run((auth) => auth.acceptInvite(user, invite), onJoined)}>
                {t("setup.accept")}
              </Button>
              <Button
                variant="secondary"
                busy={busy}
                icon="cross"
                onClick={() => void run((auth) => auth.declineInvite(invite), () => setInvites((list) => list?.filter((i) => i.elderId !== invite.elderId) ?? null))}
              >
                {t("setup.decline")}
              </Button>
            </div>
          </div>
        ))}
      </Card>

      {failed ? <p role="alert" className="font-bold text-danger">{t("error.generic")}</p> : null}
      <Button variant="quiet" onClick={() => void loadAuth().then((auth) => auth.signOut())}>
        {t("settings.signOut")}
      </Button>
    </div>
  );
}
