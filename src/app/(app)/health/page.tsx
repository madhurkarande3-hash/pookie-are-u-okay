"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, PageHeader, Section } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import {
  EmptyState,
  ErrorNote,
  Loading,
  Notice,
} from "@/components/ui/Feedback";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePolicy } from "@/hooks/usePolicy";
import { newId } from "@/lib/domain/dates";
import {
  BLOOD_GROUPS,
  emptyMedical,
  searchHospitals,
  telHref,
} from "@/lib/domain/medical";
import type { MedicalProfile } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

/**
 * Health hub: medical profile, emergency contacts, hospitals and doctors,
 * linked to medicines and appointments. Everything is entered by people —
 * Pookie never invents a hospital, doctor, service or instruction, and none
 * of this is sent to the AI.
 */
export default function HealthPage() {
  const { t } = usePrefs();
  const { repo, elderId } = useReadySession();
  const allowed = usePolicy();
  const canRead = allowed("medical:read");
  const canWrite = allowed("medical:write");
  const data = useAsyncData(
    () => (canRead ? repo.getMedical(elderId) : Promise.resolve(null)),
    [repo, elderId, canRead],
  );
  const [draft, setDraft] = useState<MedicalProfile | null>(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (data.data !== undefined) setDraft(data.data ?? emptyMedical());
  }, [data.data]);

  if (!canRead)
    return (
      <EmptyState
        icon="shield"
        title={t("error.noAccessTitle")}
        body={t("error.noAccessBody")}
      />
    );
  if (data.loading && !draft) return <Loading />;
  if (data.error) return <ErrorNote error={data.error} onRetry={data.reload} />;
  if (!draft) return null;

  const set = (patch: Partial<MedicalProfile>) => {
    setDraft({ ...draft, ...patch });
    setState("idle");
  };
  const ro = !canWrite;
  const save = async () => {
    setState("busy");
    setError(null);
    try {
      await repo.saveMedical(elderId, draft);
      setState("saved");
      data.reload();
    } catch (e) {
      setError(e);
      setState("idle");
    }
  };

  return (
    <>
      <PageHeader title={t("health.title")} subtitle={t("health.subtitle")} />
      <ButtonLink
        href="/emergency"
        size="lg"
        variant="danger"
        icon="bell"
        className="w-full"
      >
        {t("emergency.open")}
      </ButtonLink>
      <div className="grid gap-3 sm:grid-cols-2">
        <ButtonLink href="/medications" variant="secondary" icon="pill">
          {t("nav.medicines")}
        </ButtonLink>
        <ButtonLink href="/appointments" variant="secondary" icon="calendar">
          {t("health.visits")}
        </ButtonLink>
      </div>

      <Section title={t("health.profile")} id="health-profile">
        <Card className="space-y-4">
          <SelectField
            label={t("health.blood")}
            value={draft.bloodGroup}
            disabled={ro}
            onChange={(e) => set({ bloodGroup: e.target.value })}
          >
            <option value="">{t("health.unknown")}</option>
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </SelectField>
          <TextArea
            label={t("health.allergies")}
            value={draft.allergies}
            readOnly={ro}
            maxLength={500}
            onChange={(e) => set({ allergies: e.target.value })}
          />
          <TextArea
            label={t("health.conditions")}
            value={draft.conditions}
            readOnly={ro}
            maxLength={500}
            onChange={(e) => set({ conditions: e.target.value })}
          />
          <TextArea
            label={t("health.instructions")}
            hint={t("health.instructionsHint")}
            value={draft.instructions}
            readOnly={ro}
            maxLength={1000}
            onChange={(e) => set({ instructions: e.target.value })}
          />
        </Card>
      </Section>

      <Section title={t("health.contacts")} id="health-contacts">
        <ul className="space-y-3">
          {draft.emergencyContacts.map((c, i) => (
            <Card as="li" key={c.id} className="grid gap-3 sm:grid-cols-3">
              <TextField
                label={t("health.name")}
                value={c.name}
                readOnly={ro}
                required
                onChange={(e) =>
                  set({
                    emergencyContacts: draft.emergencyContacts.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
              <TextField
                label={t("decide.relationship")}
                value={c.relationship}
                readOnly={ro}
                onChange={(e) =>
                  set({
                    emergencyContacts: draft.emergencyContacts.map((x, j) =>
                      j === i ? { ...x, relationship: e.target.value } : x,
                    ),
                  })
                }
              />
              <TextField
                label={t("profile.phone")}
                type="tel"
                value={c.phone}
                readOnly={ro}
                required
                onChange={(e) =>
                  set({
                    emergencyContacts: draft.emergencyContacts.map((x, j) =>
                      j === i ? { ...x, phone: e.target.value } : x,
                    ),
                  })
                }
              />
              <div className="flex flex-wrap gap-2 sm:col-span-3">
                {c.phone ? (
                  <ButtonLink
                    href={telHref(c.phone)}
                    variant="secondary"
                    icon="bell"
                  >
                    {t("health.call", { name: c.name })}
                  </ButtonLink>
                ) : null}
                {canWrite ? (
                  <Button
                    variant="quiet"
                    icon="trash"
                    onClick={() =>
                      set({
                        emergencyContacts: draft.emergencyContacts.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                  >
                    {t("common.delete")}
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </ul>
        {canWrite && draft.emergencyContacts.length < 10 ? (
          <Button
            variant="secondary"
            icon="plus"
            onClick={() =>
              set({
                emergencyContacts: [
                  ...draft.emergencyContacts,
                  { id: newId(), name: "", relationship: "", phone: "" },
                ],
              })
            }
          >
            {t("health.addContact")}
          </Button>
        ) : null}
      </Section>

      <Section title={t("health.hospitals")} id="health-hospitals">
        <Notice>
          <p>{t("health.manualNote")}</p>
        </Notice>
        {draft.hospitals.length > 2 ? (
          <TextField
            label={t("health.search")}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
        <ul className="space-y-3">
          {searchHospitals(draft.hospitals, query).map((h) => {
            const i = draft.hospitals.findIndex((x) => x.id === h.id);
            const upd = (patch: Partial<typeof h>) =>
              set({
                hospitals: draft.hospitals.map((x, j) =>
                  j === i ? { ...x, ...patch } : x,
                ),
              });
            return (
              <Card as="li" key={h.id} className="space-y-3">
                <p className="text-sm font-bold text-ink-soft">
                  {t("health.sourceManual")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label={t("health.hospitalName")}
                    value={h.name}
                    readOnly={ro}
                    required
                    onChange={(e) => upd({ name: e.target.value })}
                  />
                  <TextField
                    label={t("health.address")}
                    value={h.address}
                    readOnly={ro}
                    onChange={(e) => upd({ address: e.target.value })}
                  />
                  <TextField
                    label={t("profile.phone")}
                    type="tel"
                    value={h.phone}
                    readOnly={ro}
                    onChange={(e) => upd({ phone: e.target.value })}
                  />
                  <TextField
                    label={t("health.emergencyPhone")}
                    type="tel"
                    value={h.emergencyPhone}
                    readOnly={ro}
                    onChange={(e) => upd({ emergencyPhone: e.target.value })}
                  />
                  <TextField
                    label={t("health.departments")}
                    value={h.departments}
                    readOnly={ro}
                    onChange={(e) => upd({ departments: e.target.value })}
                  />
                  <TextField
                    label={t("health.notes")}
                    value={h.notes}
                    readOnly={ro}
                    onChange={(e) => upd({ notes: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox
                    label={t("health.preferred")}
                    checked={draft.preferredHospitalId === h.id}
                    onChange={(on) =>
                      !ro && set({ preferredHospitalId: on ? h.id : null })
                    }
                  />
                  {h.phone ? (
                    <ButtonLink href={telHref(h.phone)} variant="secondary">
                      {t("health.callHospital")}
                    </ButtonLink>
                  ) : null}
                  {canWrite ? (
                    <Button
                      variant="quiet"
                      icon="trash"
                      onClick={() =>
                        set({
                          hospitals: draft.hospitals.filter(
                            (x) => x.id !== h.id,
                          ),
                          doctors: draft.doctors.map((d) =>
                            d.hospitalId === h.id
                              ? { ...d, hospitalId: null }
                              : d,
                          ),
                        })
                      }
                    >
                      {t("common.delete")}
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </ul>
        {canWrite ? (
          <Button
            variant="secondary"
            icon="plus"
            onClick={() =>
              set({
                hospitals: [
                  ...draft.hospitals,
                  {
                    id: newId(),
                    name: "",
                    address: "",
                    phone: "",
                    emergencyPhone: "",
                    departments: "",
                    notes: "",
                    source: "manual",
                  },
                ],
              })
            }
          >
            {t("health.addHospital")}
          </Button>
        ) : null}
      </Section>

      <Section title={t("health.doctors")} id="health-doctors">
        <ul className="space-y-3">
          {draft.doctors.map((d, i) => {
            const upd = (patch: Partial<typeof d>) =>
              set({
                doctors: draft.doctors.map((x, j) =>
                  j === i ? { ...x, ...patch } : x,
                ),
              });
            return (
              <Card as="li" key={d.id} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label={t("health.doctorName")}
                    value={d.name}
                    readOnly={ro}
                    required
                    onChange={(e) => upd({ name: e.target.value })}
                  />
                  <TextField
                    label={t("health.specialty")}
                    value={d.specialty}
                    readOnly={ro}
                    onChange={(e) => upd({ specialty: e.target.value })}
                  />
                  <SelectField
                    label={t("health.affiliation")}
                    value={d.hospitalId ?? ""}
                    disabled={ro}
                    onChange={(e) =>
                      upd({ hospitalId: e.target.value || null })
                    }
                  >
                    <option value="">{t("health.none")}</option>
                    {draft.hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name || t("health.unnamed")}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label={t("profile.phone")}
                    type="tel"
                    value={d.phone}
                    readOnly={ro}
                    onChange={(e) => upd({ phone: e.target.value })}
                  />
                  <TextField
                    label={t("health.notes")}
                    value={d.notes}
                    readOnly={ro}
                    className="sm:col-span-2"
                    onChange={(e) => upd({ notes: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox
                    label={t("health.preferredDoctor")}
                    checked={draft.preferredDoctorId === d.id}
                    onChange={(on) =>
                      !ro && set({ preferredDoctorId: on ? d.id : null })
                    }
                  />
                  {canWrite ? (
                    <Button
                      variant="quiet"
                      icon="trash"
                      onClick={() =>
                        set({
                          doctors: draft.doctors.filter((_, j) => j !== i),
                        })
                      }
                    >
                      {t("common.delete")}
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </ul>
        {canWrite ? (
          <Button
            variant="secondary"
            icon="plus"
            onClick={() =>
              set({
                doctors: [
                  ...draft.doctors,
                  {
                    id: newId(),
                    name: "",
                    specialty: "",
                    hospitalId: draft.preferredHospitalId,
                    phone: "",
                    notes: "",
                  },
                ],
              })
            }
          >
            {t("health.addDoctor")}
          </Button>
        ) : null}
      </Section>

      {canWrite ? (
        <div className="sticky bottom-24 z-30 space-y-2 rounded-card bg-surface p-3 shadow-card">
          <Button
            size="lg"
            className="w-full"
            busy={state === "busy"}
            onClick={() => void save()}
          >
            {t("health.save")}
          </Button>
          {state === "saved" ? (
            <p role="status" className="text-center font-bold">
              {t("health.saved")}
            </p>
          ) : null}
          {error ? <ErrorNote error={error} /> : null}
        </div>
      ) : null}
      <p className="text-sm text-ink-soft">{t("health.privacy")}</p>
    </>
  );
}
