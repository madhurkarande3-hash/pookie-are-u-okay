"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { CircleMember, MemberPermissions, MemberRole, MemberStatus } from "@/lib/types";
import { PERMISSION_KEYS, suggestedPermissions } from "@/lib/domain/permissions";
import type { MessageKey } from "@/lib/i18n";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession, useSession } from "@/state/SessionProvider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Checkbox, ChoiceGroup } from "./ui/Choice";
import { EmptyState, ErrorNote, Loading, Notice, StatusBadge, describeError } from "./ui/Feedback";
import { TextField } from "./ui/Field";
import type { IconName } from "./ui/Icon";

const STATUS_VIEW: Record<MemberStatus, { tone: "ok" | "warn" | "neutral"; icon: IconName; label: MessageKey }> = {
  active: { tone: "ok", icon: "check", label: "circle.status.active" },
  invited: { tone: "neutral", icon: "clock", label: "circle.status.invited" },
  declined: { tone: "warn", icon: "cross", label: "circle.status.declined" },
  paused: { tone: "warn", icon: "pause", label: "circle.status.paused" },
};

function PermissionEditor({ value, onChange }: { value: MemberPermissions; onChange: (next: MemberPermissions) => void }) {
  const { t } = usePrefs();
  return (
    <fieldset>
      <legend className="font-extrabold">{t("circle.permissions")}</legend>
      {PERMISSION_KEYS.map((key) => (
        <Checkbox key={key} label={t(`perm.${key}`)} checked={value[key]} onChange={(checked) => onChange({ ...value, [key]: checked })} />
      ))}
    </fieldset>
  );
}

function MemberCard({ member, onChanged }: { member: CircleMember; onChanged: () => void }) {
  const { t } = usePrefs();
  const { repo, elderId } = useReadySession();
  const { demo } = useSession();
  const router = useRouter();
  const [permissions, setPermissions] = useState(member.permissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const status = STATUS_VIEW[member.status];
  const dirty = PERMISSION_KEYS.some((k) => permissions[k] !== member.permissions[k]);

  const run = async (work: () => Promise<void> | void) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-extrabold">{member.name}</p>
          <p className="text-sm text-ink-soft">
            {t(`role.${member.role}`)} · {member.email}
          </p>
        </div>
        <StatusBadge tone={status.tone} icon={status.icon}>
          {t(status.label)}
        </StatusBadge>
      </div>

      <details className="rounded-2xl border border-line p-3">
        <summary className="min-h-[2.5rem] cursor-pointer font-bold text-primary-strong">{t("circle.editPermissions")}</summary>
        <div className="space-y-3 pt-2">
          <PermissionEditor value={permissions} onChange={setPermissions} />
          <Button disabled={!dirty} busy={busy} onClick={() => run(() => repo.updateMember(elderId, member, { permissions }))}>
            {t("common.save")}
          </Button>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        {member.status === "active" ? (
          <Button variant="secondary" icon="pause" busy={busy} onClick={() => run(() => repo.updateMember(elderId, member, { status: "paused" }))}>
            {t("circle.pause")}
          </Button>
        ) : null}
        {member.status === "paused" ? (
          <Button variant="secondary" icon="play" busy={busy} onClick={() => run(() => repo.updateMember(elderId, member, { status: "active" }))}>
            {t("circle.resume")}
          </Button>
        ) : null}
        {demo && member.status === "invited" ? (
          <>
            <Button variant="secondary" icon="check" busy={busy} onClick={() => run(() => demo.simulateAcceptance(member.id))}>
              {t("circle.simulateAccept")}
            </Button>
            <Button variant="secondary" icon="cross" busy={busy} onClick={() => run(() => demo.simulateDecline(member.id))}>
              {t("circle.simulateDecline")}
            </Button>
          </>
        ) : null}
        {demo && member.status === "active" ? (
          <Button variant="secondary" icon="users" onClick={() => {
              demo.setPersona(member.id);
              router.push("/family");
            }}>
            {t("circle.viewAs", { name: member.name })}
          </Button>
        ) : null}
        {confirmRemove ? (
          <>
            <Button variant="danger" icon="trash" busy={busy} onClick={() => run(() => repo.removeMember(elderId, member))}>
              {t("circle.confirmRemove", { name: member.name })}
            </Button>
            <Button variant="quiet" onClick={() => setConfirmRemove(false)}>
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <Button variant="danger" icon="trash" onClick={() => setConfirmRemove(true)}>
            {t("circle.remove")}
          </Button>
        )}
      </div>
      {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
    </Card>
  );
}

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const { t } = usePrefs();
  const { repo, elderId } = useReadySession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("family");
  const [permissions, setPermissions] = useState<MemberPermissions>(suggestedPermissions("family"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await repo.inviteMember(elderId, { name, email, role, permissions });
      setName("");
      setEmail("");
      setPermissions(suggestedPermissions(role));
      onInvited();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <h3 className="text-lg font-extrabold">{t("circle.inviteTitle")}</h3>
        <TextField label={t("circle.name")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={80} required />
        <TextField label={t("circle.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" inputMode="email" required />
        <ChoiceGroup
          legend={t("circle.role")}
          columns="grid-cols-2"
          value={role}
          onChange={(next) => {
            setRole(next);
            setPermissions(suggestedPermissions(next));
          }}
          options={[
            { value: "family", label: t("role.family") },
            { value: "caregiver", label: t("role.caregiver") },
          ]}
        />
        <PermissionEditor value={permissions} onChange={setPermissions} />
        {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
        <Button type="submit" icon="plus" busy={busy}>
          {t("circle.invite")}
        </Button>
        <p className="text-sm text-ink-soft">{repo.mode === "demo" ? t("circle.inviteNoteDemo") : t("circle.inviteNoteLive")}</p>
      </form>
    </Card>
  );
}

/** Invite, grant, pause and revoke. Used in onboarding and on the Care Circle page. */
export function CircleManager() {
  const { t } = usePrefs();
  const { repo, elderId } = useReadySession();
  const circle = useAsyncData(() => repo.listCircle(elderId), [repo, elderId]);

  return (
    <div className="space-y-4">
      <Notice icon="shield">
        <p>{t("circle.privacyNote")}</p>
      </Notice>
      {circle.loading ? <Loading /> : null}
      {circle.error ? <ErrorNote error={circle.error} onRetry={circle.reload} /> : null}
      {circle.data && circle.data.length === 0 ? <EmptyState icon="users" title={t("circle.emptyTitle")} body={t("circle.emptyBody")} /> : null}
      {circle.data && circle.data.length > 0 ? (
        <ul className="space-y-3">
          {circle.data.map((member) => (
            <MemberCard key={`${member.id}:${member.status}:${JSON.stringify(member.permissions)}`} member={member} onChanged={circle.reload} />
          ))}
        </ul>
      ) : null}
      <InviteForm onInvited={circle.reload} />
    </div>
  );
}
